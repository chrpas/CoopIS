/**
 * Frontend Core Lending Calculation Service
 * Path: client/web/src/lib/services/loan-service.ts
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
 */

export interface LoanTier {
  minAmount: number;
  maxAmount: number;
  termMonths: number;
  cutoffsCount: number;
  description: string;
}

export const COOP_LOAN_TIERS: readonly LoanTier[] = [
  { minAmount: 1, maxAmount: 5000, termMonths: 2, cutoffsCount: 4, description: "Tier 1: Up to ₱5,000 (2 mos / 4 cutoffs)" },
  { minAmount: 5001, maxAmount: 15000, termMonths: 3, cutoffsCount: 6, description: "Tier 2: ₱5,001 - ₱15,000 (3 mos / 6 cutoffs)" },
  { minAmount: 15001, maxAmount: 25000, termMonths: 4, cutoffsCount: 8, description: "Tier 3: ₱15,001 - ₱25,000 (4 mos / 8 cutoffs)" },
  { minAmount: 25001, maxAmount: 35000, termMonths: 5, cutoffsCount: 10, description: "Tier 4: ₱25,001 - ₱35,000 (5 mos / 10 cutoffs)" },
  { minAmount: 35001, maxAmount: 50000, termMonths: 6, cutoffsCount: 12, description: "Tier 5: ₱35,001 - ₱50,000 (6 mos / 12 cutoffs)" },
  { minAmount: 50001, maxAmount: 70000, termMonths: 7, cutoffsCount: 14, description: "Tier 6: ₱50,001 - ₱70,000 (7 mos / 14 cutoffs)" },
  { minAmount: 70001, maxAmount: 80000, termMonths: 8, cutoffsCount: 16, description: "Tier 7: ₱70,001 - ₱80,000 (8 mos / 16 cutoffs)" },
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

export interface ProjectedAmortizationItem {
  installmentNumber: number;
  cutoffDate: string;
  cutoffLabel: string;
  scheduledPrincipal: number;
  scheduledInterestUpfront: number;
  totalPayment: number;
  remainingPrincipal: number;
}

export function getLoanTier(principal: number): LoanTier {
  if (principal < MIN_LOAN_AMOUNT) {
    throw new Error(`Principal amount must be at least ₱${MIN_LOAN_AMOUNT.toLocaleString()}.`);
  }
  if (principal > MAX_LOAN_AMOUNT) {
    throw new Error(`Principal amount cannot exceed ₱${MAX_LOAN_AMOUNT.toLocaleString()}.`);
  }

  const tier = COOP_LOAN_TIERS.find(
    (t) => principal >= t.minAmount && principal <= t.maxAmount
  );

  if (!tier) {
    throw new Error(`No matching tier found for ₱${principal.toLocaleString()}.`);
  }

  return tier;
}

export function calculateLoanTerms(principal: number): LoanCalculationResult {
  const safeAmount = Math.max(MIN_LOAN_AMOUNT, Math.min(principal, MAX_LOAN_AMOUNT));
  const tier = getLoanTier(safeAmount);

  const roundedPrincipal = Math.round(safeAmount * 100) / 100;
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

export function projectAmortizationSchedule(
  principal: number,
  originationDate: Date = new Date()
): ProjectedAmortizationItem[] {
  const calculation = calculateLoanTerms(principal);
  const count = calculation.cutoffsCount;

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  let year = originationDate.getFullYear();
  let month = originationDate.getMonth();
  let isMidMonth = originationDate.getDate() <= 15;

  const schedule: ProjectedAmortizationItem[] = [];
  let remaining = calculation.principalAmount;
  let totalScheduled = 0;

  for (let i = 0; i < count; i++) {
    const isLast = i === count - 1;
    let scheduledPrincipal = calculation.cutoffPaymentAmount;

    if (isLast) {
      scheduledPrincipal = Math.round((calculation.principalAmount - totalScheduled) * 100) / 100;
    }

    totalScheduled += scheduledPrincipal;
    remaining = Math.max(0, Math.round((remaining - scheduledPrincipal) * 100) / 100);

    let cutoffLabel: string;
    let cutoffIso: string;

    if (isMidMonth) {
      cutoffLabel = `${monthNames[month]}-15`;
      cutoffIso = new Date(Date.UTC(year, month, 15)).toISOString();
      isMidMonth = false;
    } else {
      const lastDay = new Date(Date.UTC(year, month + 1, 0)).getDate();
      cutoffLabel = `${monthNames[month]}-${lastDay}`;
      cutoffIso = new Date(Date.UTC(year, month, lastDay)).toISOString();
      isMidMonth = true;
      month += 1;
      if (month > 11) {
        month = 0;
        year += 1;
      }
    }

    schedule.push({
      installmentNumber: i + 1,
      cutoffDate: cutoffIso,
      cutoffLabel,
      scheduledPrincipal,
      scheduledInterestUpfront: i === 0 ? calculation.interestEarned : 0,
      totalPayment: scheduledPrincipal,
      remainingPrincipal: remaining,
    });
  }

  return schedule;
}
