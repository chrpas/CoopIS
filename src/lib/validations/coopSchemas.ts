import { z } from "zod";

export const memberStatusEnum = z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]);
export const paymentChannelEnum = z.enum(["PAYROLL_DEDUCTION", "CASH", "BANK_TRANSFER"]);
export const loanStatusEnum = z.enum(["PENDING_APPROVAL", "APPROVED", "ACTIVE", "PAID", "DEFAULTED"]);

// Decimal / monetary string validator with up to 14 total digits and 2 decimal places
export const decimalString14_2 = z
  .string()
  .regex(/^\d{1,12}(\.\d{1,2})?$/, "Must be a valid decimal amount with up to 14 digits and 2 decimal places");

// Ratio decimal validator with up to 10 total digits and 8 decimal places (0.00000000 to 1.00000000)
export const ratioDecimalString10_8 = z
  .string()
  .regex(/^0(\.\d{1,8})?$|^1(\.0{1,8})?$/, "Must be a valid decimal ratio between 0 and 1 with up to 8 decimal places");

export const memberSchema = z.object({
  id: z.string().uuid().optional(),
  memberCode: z.string().min(3).max(32),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  status: memberStatusEnum.default("ACTIVE"),
});

export const cutoffPeriodSchema = z.object({
  id: z.string().uuid().optional(),
  cutoffDate: z.coerce.date(),
  label: z.string().min(3).max(50),
  fiscalYear: z.number().int().min(2000).max(2100),
  isClosed: z.boolean().default(false),
});

export const contributionSchema = z.object({
  id: z.string().uuid().optional(),
  memberId: z.string().uuid(),
  cutoffId: z.string().uuid(),
  amount: decimalString14_2,
  paymentChannel: paymentChannelEnum,
});

export const loanSchema = z.object({
  id: z.string().uuid().optional(),
  loanReference: z.string().min(3).max(50),
  memberId: z.string().uuid(),
  originationDate: z.coerce.date(),
  principalAmount: decimalString14_2,
  interestRate: z.string().regex(/^\d{1}(\.\d{1,4})?$/).default("0.0500"),
  interestEarned: decimalString14_2,
  releasedAmount: decimalString14_2,
  termMonths: z.number().int().positive(),
  cutoffsCount: z.number().int().positive(),
  cutoffPaymentAmount: decimalString14_2,
  status: loanStatusEnum.default("PENDING_APPROVAL"),
  approvedBy: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const loanRepaymentSchema = z.object({
  id: z.string().uuid().optional(),
  loanId: z.string().uuid(),
  cutoffId: z.string().uuid(),
  principalPaid: decimalString14_2.default("0.00"),
  latePenaltyPaid: decimalString14_2.default("0.00"),
});

export const bankReconciliationSchema = z.object({
  id: z.string().uuid().optional(),
  cutoffId: z.string().uuid().optional().nullable(),
  statementDate: z.coerce.date(),
  cashInBank: decimalString14_2,
  bankGrossInterest: decimalString14_2.default("0.00"),
  withholdingTax: decimalString14_2.default("0.00"),
  netBankInterest: decimalString14_2.default("0.00"),
  reconciledVariance: decimalString14_2.default("0.00"),
  notes: z.string().optional().nullable(),
});

export const surplusDistributionSchema = z.object({
  id: z.string().uuid().optional(),
  fiscalYear: z.number().int().min(2000).max(2100),
  totalInterestIncome: decimalString14_2,
  dividendPool: decimalString14_2, // 65% of net interest
  patronagePool: decimalString14_2, // 30% of net interest
  managementPool: decimalString14_2, // 5% of net interest
  isFinalized: z.boolean().default(false),
  finalizedAt: z.coerce.date().optional().nullable(),
});

export const memberSurplusLedgerSchema = z.object({
  id: z.string().uuid().optional(),
  distributionId: z.string().uuid(),
  memberId: z.string().uuid(),
  totalContribution: decimalString14_2,
  contributionRatio: ratioDecimalString10_8,
  dividendEarned: decimalString14_2,
  totalLoansBorrowed: decimalString14_2,
  loanRatio: ratioDecimalString10_8,
  patronageEarned: decimalString14_2,
  netSavingsCredited: decimalString14_2,
});

export type MemberInput = z.infer<typeof memberSchema>;
export type CutoffPeriodInput = z.infer<typeof cutoffPeriodSchema>;
export type ContributionInput = z.infer<typeof contributionSchema>;
export type LoanInput = z.infer<typeof loanSchema>;
export type LoanRepaymentInput = z.infer<typeof loanRepaymentSchema>;
export type BankReconciliationInput = z.infer<typeof bankReconciliationSchema>;
export type SurplusDistributionInput = z.infer<typeof surplusDistributionSchema>;
export type MemberSurplusLedgerInput = z.infer<typeof memberSurplusLedgerSchema>;
