export type UserRole = "Admin" | "User";

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export type MemberStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type LoanStatus = "PENDING_APPROVAL" | "APPROVED" | "ACTIVE" | "PAID" | "DEFAULTED";
export type PaymentChannel = "PAYROLL_DEDUCTION" | "CASH" | "BANK_TRANSFER";

export interface Member {
  id: string;
  memberCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  status: MemberStatus;
  createdAt: string;
}

export interface CutoffPeriod {
  id: string;
  cutoffDate: string;
  label: string;
  fiscalYear: number;
  isClosed: boolean;
}

export interface Loan {
  id: string;
  loanReference: string;
  memberId: string;
  memberName: string;
  originationDate: string;
  principalAmount: number;
  interestRate: number;
  interestEarned: number;
  releasedAmount: number;
  termMonths: number;
  cutoffsCount: number;
  cutoffPaymentAmount: number;
  status: LoanStatus;
  approvedBy?: string | null;
  approverName?: string | null;
  notes?: string | null;
  createdAt: string;
  totalRepayments: number;
}

export interface AmortizationScheduleItem {
  installmentNumber: number;
  cutoffId: string;
  cutoffLabel: string;
  cutoffDate: string;
  scheduledPrincipal: number;
  principalPaid: number;
  remainingBalance: number;
  status: "PENDING" | "PAID" | "OVERDUE";
}


export interface Contribution {
  id: string;
  memberId: string;
  memberName: string;
  memberCode: string;
  cutoffId: string;
  cutoffLabel: string;
  amount: number;
  paymentChannel: PaymentChannel;
  createdAt: string;
}

export interface BankReconciliation {
  id: string;
  cutoffId?: string | null;
  cutoffLabel?: string | null;
  statementDate: string;
  cashInBank: number;
  bankGrossInterest: number;
  withholdingTax: number;
  netBankInterest: number;
  reconciledVariance: number;
  notes?: string | null;
}

export interface SurplusDistribution {
  id: string;
  fiscalYear: number;
  totalInterestIncome: number;
  dividendPool: number;
  patronagePool: number;
  managementPool: number;
  isFinalized: boolean;
  finalizedAt?: string | null;
  memberLedgers?: MemberSurplusLedger[];
}

export interface MemberSurplusLedger {
  id: string;
  distributionId: string;
  memberId: string;
  totalContribution: number;
  contributionRatio: number;
  dividendEarned: number;
  totalLoansBorrowed: number;
  loanRatio: number;
  patronageEarned: number;
  netSavingsCredited: number;
  member?: Member;
}
