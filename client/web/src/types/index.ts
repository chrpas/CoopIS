export type UserRole = "Admin" | "User";

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
}

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface UpdateUserRolePayload {
  role?: UserRole;
  isActive?: boolean;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export enum RemoteAccessStatusState {
  Disabled = "Disabled",
  Starting = "Starting",
  Running = "Running",
  Stopped = "Stopped",
  Error = "Error",
  NgrokNotFound = "NgrokNotFound",
}

export interface RemoteAccessStatus {
  state: RemoteAccessStatusState;
  publicUrl?: string | null;
  localAddress?: string | null;
  startedAt?: string | null;
  errorMessage?: string | null;
}

export interface RemoteAccessSettings {
  enabled: boolean;
  ngrokPath: string;
  hasAuthtoken: boolean;
  autoStart: boolean;
  ngrokVersion?: string | null;
  isNgrokDetected: boolean;
}

export interface UpdateRemoteAccessSettingsRequest {
  ngrokPath?: string;
  authtoken?: string;
  autoStart?: boolean;
}

export type MemberStatus = "ACTIVE" | "INACTIVE" | "SUSPENDED";
export type LoanStatus = "PENDING_APPROVAL" | "APPROVED" | "ACTIVE" | "PAID" | "DEFAULTED";
export type PaymentChannel = "PAYROLL_DEDUCTION" | "CASH" | "BANK_TRANSFER";

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface Member {
  id: string;
  memberCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  status: MemberStatus;
  createdAt: string;
  updatedAt?: string;
  totalContributions?: number;
  activeLoansCount?: number;
}

export interface MemberContributionItem {
  id: string;
  cutoffId: string;
  cutoffLabel: string;
  cutoffDate: string;
  amount: number;
  paymentChannel: PaymentChannel;
  createdAt: string;
}

export interface MemberLoanSummary {
  id: string;
  loanReference: string;
  originationDate: string;
  principalAmount: number;
  interestRate: number;
  releasedAmount: number;
  cutoffPaymentAmount: number;
  termMonths: number;
  cutoffsCount: number;
  status: LoanStatus;
  principalPaid: number;
  remainingBalance: number;
  createdAt: string;
}

export interface MemberDetail {
  id: string;
  memberCode: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  status: MemberStatus;
  createdAt: string;
  updatedAt: string;
  totalShareContributions: number;
  totalContributionsCount: number;
  lastContributionDate?: string | null;
  contributions: MemberContributionItem[];
  totalActiveLoanBalance: number;
  activeLoansCount: number;
  loans: MemberLoanSummary[];
}

export interface CreateMemberPayload {
  memberCode?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  status?: MemberStatus;
}

export interface UpdateMemberPayload {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  status: MemberStatus;
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
  totalLatePenalties?: number;
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
  latePenaltyPaid?: number;
  accruedPenalty?: number;
  isDelayed?: boolean;
  daysOverdue?: number;
  paymentDate?: string | null;
  notes?: string | null;
}

export interface RecordRepaymentPayload {
  cutoffId: string;
  principalPaid: number;
  latePenaltyPaid?: number;
  paymentDate?: string;
  notes?: string;
}

export interface LoanRepaymentResponse {
  id: string;
  loanId: string;
  cutoffId: string;
  cutoffLabel: string;
  cutoffDate: string;
  principalPaid: number;
  latePenaltyPaid: number;
  totalPaidThisEntry: number;
  remainingLoanBalance: number;
  isDelayed: boolean;
  daysOverdue: number;
  paymentDate?: string | null;
  recordedAt: string;
  loanStatus: string;
  notes?: string | null;
}

export interface CutoffPenaltyDetail {
  repaymentId?: string;
  cutoffId: string;
  cutoffLabel: string;
  cutoffDate: string;
  dueDateWithGrace: string;
  scheduledPrincipal: number;
  principalPaid: number;
  remainingBalance: number;
  latePenaltyPaid: number;
  accruedPenalty: number;
  isDelayed: boolean;
  isOverdue: boolean;
  daysLate: number;
  paymentDate?: string | null;
  status: string;
}

export interface LoanPenaltySummary {
  loanId: string;
  loanReference: string;
  memberId: string;
  memberName: string;
  principalAmount: number;
  totalPrincipalPaid: number;
  remainingPrincipal: number;
  totalLatePenaltiesPaid: number;
  totalAccruedPenalties: number;
  outstandingPenalties: number;
  totalCutoffs: number;
  paidCutoffsCount: number;
  overdueCutoffsCount: number;
  gracePeriodDays: number;
  penaltiesBreakdown: CutoffPenaltyDetail[];
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

export interface CutoffMemberContribution {
  memberId: string;
  memberCode: string;
  memberName: string;
  email: string;
  status: MemberStatus;
  cutoffId: string;
  cutoffLabel: string;
  contributionId?: string | null;
  amount: number;
  paymentChannel: PaymentChannel;
  recordedAt?: string | null;
}

export interface BatchContributionItem {
  memberId: string;
  cutoffId: string;
  amount: number;
  paymentChannel?: PaymentChannel;
}

export interface BatchContributionResult {
  totalProcessed: number;
  createdCount: number;
  updatedCount: number;
  totalAmountBatch: number;
  message: string;
}

export interface MemberContributionSummary {
  memberId: string;
  memberCode: string;
  memberName: string;
  totalContribution: number;
  contributionsCount: number;
  lastContributionDate?: string | null;
}

export interface ContributionSummary {
  grandTotalShareCapital: number;
  activeContributingMembersCount: number;
  totalMembersCount: number;
  averageContributionPerMember: number;
  memberContributions: MemberContributionSummary[];
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

export interface BalanceSheet {
  asOfDate: string;
  cashInBank: number;
  accountsReceivable: number;
  totalAssets: number;
  salariesHonorariaPayable: number;
  totalLiabilities: number;
  commonShareCapital: number;
  netRetainedSurplus: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  totalDistributableInterest: number;
  activeLoansCount: number;
  totalLatePenalties?: number;
}

export interface FundReconciliation {
  asOfDate: string;
  totalContributions: number;
  totalLoanReceipts: number;
  netBankInterest: number;
  totalLoanDisbursements: number;
  bookBalance: number;
  cashInBank: number;
  variance: number;
  isReconciled: boolean;
  latestStatementDate?: string | null;
  totalLatePenalties?: number;
  totalPrincipalRepayments?: number;
}

export interface CreateBankReconPayload {
  cutoffId?: string | null;
  statementDate: string;
  cashInBank: number;
  bankGrossInterest: number;
  withholdingTax?: number;
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

export interface MemberAllocation {
  memberId: string;
  memberCode: string;
  memberName: string;
  email: string;
  totalContribution: number;
  contributionRatio: number;
  dividendEarned: number;
  totalLoansBorrowed: number;
  loanRatio: number;
  patronageEarned: number;
  totalSurplusEarned: number;
  netSavingsCredited: number;
}

export interface DistributionPreview {
  fiscalYear: number;
  totalDistributableInterest: number;
  loanInterestIncome: number;
  latePenaltiesIncome: number;
  netBankInterestIncome: number;
  dividendPool: number;
  patronagePool: number;
  managementPool: number;
  grandTotalContributions: number;
  grandTotalLoanVolume: number;
  totalMembersCount: number;
  contributingMembersCount: number;
  borrowingMembersCount: number;
  isAlreadyFinalized: boolean;
  finalizedAt?: string | null;
  allocations: MemberAllocation[];
}

export interface MemberSoaContributionItem {
  cutoffLabel: string;
  cutoffDate: string;
  amount: number;
  paymentChannel: string;
}

export interface MemberSoaLoanItem {
  loanReference: string;
  originationDate: string;
  principalAmount: number;
  interestRate: number;
  interestEarned: number;
  status: string;
  principalPaid: number;
  remainingBalance: number;
}

export interface MemberStatementOfAccount {
  memberId: string;
  memberCode: string;
  memberName: string;
  email: string;
  phone?: string | null;
  status: string;
  fiscalYear: number;
  asOfDate: string;
  totalContributions: number;
  contributionRatio: number;
  dividendEarned: number;
  totalLoansBorrowed: number;
  loanRatio: number;
  patronageEarned: number;
  totalSurplusEarned: number;
  netSavingsCredited: number;
  isFinalized: boolean;
  contributions: MemberSoaContributionItem[];
  loans: MemberSoaLoanItem[];
}
