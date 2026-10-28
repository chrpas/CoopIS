/**
 * Core Lending Calculation Service & Server Actions
 * Path: src/lib/services/loan-service.ts
 *
 * Implements the Cooperative's Lending Business Rules:
 * 1. Term Tiering Logic:
 *    - <= 5,000 PHP: 2 months (4 cutoffs)
 *    - 5,001 - 15,000 PHP: 3 months (6 cutoffs)
 *    - 15,001 - 25,000 PHP: 4 months (8 cutoffs)
 *    - 25,001 - 35,000 PHP: 5 months (10 cutoffs)
 *    - 35,001 - 50,000 PHP: 6 months (12 cutoffs)
 *    - 50,001 - 70,000 PHP: 7 months (14 cutoffs)
 *    - 70,001 - 80,000 PHP: 8 months (16 cutoffs)
 *
 * 2. Mathematical Calculations:
 *    - Upfront Interest = Principal * 5% (0.0500)
 *    - Released Amount = Principal - Upfront Interest
 *    - Cutoff Payment = Principal / Number of Cutoffs
 *
 * 3. Schedule Generation & Server Action Persistence:
 *    - Schedules expected amortization entries across consecutive future cutoffs.
 */

import { prisma } from "../prisma";

export interface LoanTier {
  minAmount: number;
  maxAmount: number;
  termMonths: number;
  cutoffsCount: number;
  description: string;
}

export const COOP_LOAN_TIERS: readonly LoanTier[] = [
  { minAmount: 1, maxAmount: 5000, termMonths: 2, cutoffsCount: 4, description: "Tier 1: Up to ₱5,000 (2 months / 4 cutoffs)" },
  { minAmount: 5001, maxAmount: 15000, termMonths: 3, cutoffsCount: 6, description: "Tier 2: ₱5,001 - ₱15,000 (3 months / 6 cutoffs)" },
  { minAmount: 15001, maxAmount: 25000, termMonths: 4, cutoffsCount: 8, description: "Tier 3: ₱15,001 - ₱25,000 (4 months / 8 cutoffs)" },
  { minAmount: 25001, maxAmount: 35000, termMonths: 5, cutoffsCount: 10, description: "Tier 4: ₱25,001 - ₱35,000 (5 months / 10 cutoffs)" },
  { minAmount: 35001, maxAmount: 50000, termMonths: 6, cutoffsCount: 12, description: "Tier 5: ₱35,001 - ₱50,000 (6 months / 12 cutoffs)" },
  { minAmount: 50001, maxAmount: 70000, termMonths: 7, cutoffsCount: 14, description: "Tier 6: ₱50,001 - ₱70,000 (7 months / 14 cutoffs)" },
  { minAmount: 70001, maxAmount: 80000, termMonths: 8, cutoffsCount: 16, description: "Tier 7: ₱70,001 - ₱80,000 (8 months / 16 cutoffs)" },
] as const;

export const FIXED_INTEREST_RATE = 0.05; // 5% flat upfront interest
export const MIN_LOAN_AMOUNT = 1000;
export const MAX_LOAN_AMOUNT = 80000;

export interface LoanCalculationResult {
  principalAmount: number;
  interestRate: number;
  termMonths: number;
  cutoffsCount: number;
  interestEarned: number; // Upfront interest
  releasedAmount: number; // Net proceeds
  cutoffPaymentAmount: number; // Bi-monthly amortization
  tierDescription: string;
}

export interface AmortizationScheduleItem {
  installmentNumber: number;
  cutoffId?: string;
  cutoffDate: Date;
  cutoffLabel: string;
  scheduledPrincipal: number;
  scheduledInterestUpfront: number; // 0 for installments since interest is 100% upfront
  totalPayment: number;
  remainingPrincipal: number;
}

/**
 * Resolves the loan tier based on the principal amount.
 * Throws an error if the amount exceeds maximum policy limit (80,000 PHP) or is less than minimum.
 */
export function getLoanTier(principal: number): LoanTier {
  if (principal < MIN_LOAN_AMOUNT) {
    throw new Error(`Principal amount must be at least ₱${MIN_LOAN_AMOUNT.toLocaleString()}.`);
  }
  if (principal > MAX_LOAN_AMOUNT) {
    throw new Error(`Principal amount cannot exceed the cooperative lending limit of ₱${MAX_LOAN_AMOUNT.toLocaleString()}.`);
  }

  const tier = COOP_LOAN_TIERS.find(
    (t) => principal >= t.minAmount && principal <= t.maxAmount
  );

  if (!tier) {
    throw new Error(`No matching term tier found for loan amount ₱${principal.toLocaleString()}.`);
  }

  return tier;
}

/**
 * Computes exact loan terms and deductions according to the cooperative's policy.
 * - Upfront Interest = Principal * 5% (0.05)
 * - Released Amount = Principal - Upfront Interest
 * - Cutoff Payment = Principal / Number of Cutoffs
 */
export function calculateLoanTerms(principal: number): LoanCalculationResult {
  const tier = getLoanTier(principal);
  const roundedPrincipal = Math.round(principal * 100) / 100;
  const interestEarned = Math.round(roundedPrincipal * FIXED_INTEREST_RATE * 100) / 100;
  const releasedAmount = Math.round((roundedPrincipal - interestEarned) * 100) / 100;
  const cutoffPaymentAmount = Math.round((roundedPrincipal / tier.cutoffsCount) * 100) / 100;

  return {
    principalAmount: roundedPrincipal,
    interestRate: FIXED_INTEREST_RATE,
    termMonths: tier.termMonths,
    cutoffsCount: tier.cutoffsCount,
    interestEarned,
    releasedAmount,
    cutoffPaymentAmount,
    tierDescription: tier.description,
  };
}

/**
 * Generates projected semi-monthly cutoff dates if cutoffs are not pre-loaded from DB.
 */
export function projectSemiMonthlyCutoffs(startDate: Date, count: number): Array<{ cutoffDate: Date; label: string }> {
  const cutoffs: Array<{ cutoffDate: Date; label: string }> = [];
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  let year = startDate.getFullYear();
  let month = startDate.getMonth(); // 0-indexed
  let isMidMonth = startDate.getDate() <= 15;

  for (let i = 0; i < count; i++) {
    let cutoffDate: Date;
    let label: string;

    if (isMidMonth) {
      cutoffDate = new Date(Date.UTC(year, month, 15));
      label = `${monthNames[month]}-15`;
      isMidMonth = false;
    } else {
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getDate();
      cutoffDate = new Date(Date.UTC(year, month, lastDay));
      label = `${monthNames[month]}-${lastDay}`;
      isMidMonth = true;
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }

    cutoffs.push({ cutoffDate, label });
  }

  return cutoffs;
}

/**
 * Generates the expected amortization schedule entries for the loan across consecutive cutoffs.
 * Handles rounding reconciliation on the final installment.
 */
export function generateAmortizationSchedule(
  principal: number,
  originationDate: Date = new Date(),
  cutoffPeriods?: Array<{ id: string; cutoffDate: Date; label: string }>
): AmortizationScheduleItem[] {
  const calculation = calculateLoanTerms(principal);
  const count = calculation.cutoffsCount;
  const projected = cutoffPeriods && cutoffPeriods.length >= count
    ? cutoffPeriods.slice(0, count)
    : projectSemiMonthlyCutoffs(originationDate, count);

  const schedule: AmortizationScheduleItem[] = [];
  let remainingPrincipal = calculation.principalAmount;
  let totalScheduledPrincipal = 0;

  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    let scheduledPrincipal = calculation.cutoffPaymentAmount;

    // Reconcile penny discrepancies on final installment
    if (isLast) {
      scheduledPrincipal = Math.round((calculation.principalAmount - totalScheduledPrincipal) * 100) / 100;
    }

    totalScheduledPrincipal += scheduledPrincipal;
    remainingPrincipal = Math.max(0, Math.round((remainingPrincipal - scheduledPrincipal) * 100) / 100);

    const cutoffInfo = projected[i];

    schedule.push({
      installmentNumber: i + 1,
      cutoffId: "id" in cutoffInfo ? (cutoffInfo as { id: string }).id : undefined,
      cutoffDate: cutoffInfo.cutoffDate,
      cutoffLabel: cutoffInfo.label,
      scheduledPrincipal,
      scheduledInterestUpfront: i === 0 ? calculation.interestEarned : 0,
      totalPayment: scheduledPrincipal,
      remainingPrincipal,
    });
  }

  return schedule;
}

export interface OriginateLoanInput {
  memberId: string;
  principalAmount: number;
  originationDate?: Date | string;
  loanReference?: string;
  notes?: string;
  approvedBy?: string;
}

/**
 * Server Action / Persistence Service
 * Persists an approved or pending loan and automatically schedules expected amortization
 * entries across consecutive future cutoff periods.
 */
export async function originateLoanServerAction(input: OriginateLoanInput) {
  const originationDate = input.originationDate
    ? new Date(input.originationDate)
    : new Date();

  const terms = calculateLoanTerms(input.principalAmount);
  const loanRef = input.loanReference || `LN-${originationDate.getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  // 1. Verify Member status
  // @ts-ignore - Prisma models
  const member = await prisma.member.findUnique({
    where: { id: input.memberId },
  });

  if (!member) {
    throw new Error(`Member with ID "${input.memberId}" was not found.`);
  }

  if (member.status !== "ACTIVE") {
    throw new Error(`Cannot originate loan for member with status "${member.status}". Member must be ACTIVE.`);
  }

  // 2. Fetch consecutive future cutoff periods
  // @ts-ignore - Prisma models
  const cutoffs = await prisma.cutoffPeriod.findMany({
    where: {
      cutoffDate: {
        gte: originationDate,
      },
      isClosed: false,
    },
    orderBy: {
      cutoffDate: "asc",
    },
    take: terms.cutoffsCount,
  });

  if (cutoffs.length < terms.cutoffsCount) {
    // If future cutoffs not pre-populated, generate schedule logically
    console.warn(`Only ${cutoffs.length} of ${terms.cutoffsCount} cutoffs found in DB. Amortizations will be projected.`);
  }

  const schedule = generateAmortizationSchedule(
    terms.principalAmount,
    originationDate,
    cutoffs.map((c: { id: string; cutoffDate: Date; label: string }) => ({
      id: c.id,
      cutoffDate: new Date(c.cutoffDate),
      label: c.label,
    }))
  );

  // 3. Persist the Loan and Schedule within an atomic transaction
  // @ts-ignore - Prisma transaction
  const result = await prisma.$transaction(async (tx: any) => {
    const loan = await tx.loan.create({
      data: {
        loanReference: loanRef,
        memberId: input.memberId,
        originationDate,
        principalAmount: terms.principalAmount.toFixed(2),
        interestRate: terms.interestRate.toFixed(4),
        interestEarned: terms.interestEarned.toFixed(2),
        releasedAmount: terms.releasedAmount.toFixed(2),
        termMonths: terms.termMonths,
        cutoffsCount: terms.cutoffsCount,
        cutoffPaymentAmount: terms.cutoffPaymentAmount.toFixed(2),
        status: input.approvedBy ? "APPROVED" : "PENDING_APPROVAL",
        approvedBy: input.approvedBy || null,
        notes: input.notes || `Originated with ${terms.tierDescription}`,
      },
    });

    // Schedule amortization entries across consecutive cutoffs if available
    const repaymentEntries = [];
    for (const item of schedule) {
      if (item.cutoffId) {
        const repayment = await tx.loanRepayment.create({
          data: {
            loanId: loan.id,
            cutoffId: item.cutoffId,
            principalPaid: "0.00", // Scheduled, pending actual cutoff payroll deduction
            latePenaltyPaid: "0.00",
          },
        });
        repaymentEntries.push(repayment);
      }
    }

    return {
      loan,
      repaymentEntries,
      schedule,
      terms,
    };
  });

  return {
    success: true,
    loan: result.loan,
    schedule: result.schedule,
    terms: result.terms,
    message: `Loan ${loanRef} originated successfully for ₱${terms.principalAmount.toLocaleString()}. Payout: ₱${terms.releasedAmount.toLocaleString()} after 5% upfront interest (₱${terms.interestEarned.toLocaleString()}).`,
  };
}
