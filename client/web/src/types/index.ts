export type UserRole = "Admin" | "User" | "Member";

export interface User {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  memberId?: string | null;
  memberCode?: string | null;
  memberName?: string | null;
}

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  memberId?: string | null;
  memberCode?: string | null;
  memberName?: string | null;
  createdAt: string;
}

export interface CreateUserPayload {
  username: string;
  email: string;
  password: string;
  role: UserRole;
  memberId?: string | null;
}

export interface UpdateUserRolePayload {
  role?: UserRole;
  isActive?: boolean;
  memberId?: string | null;
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
  lanAddress?: string | null;
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
  linkedUsername?: string | null;
  linkedUserId?: string | null;
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
  linkedUsername?: string | null;
  linkedUserId?: string | null;
}

export interface MemberCutoffIndicator {
  cutoffId: string;
  label: string;
  cutoffNumber?: number;
  cutoffDate: string;
  dueDateWithGrace?: string;
  fiscalYear: number;
  status: "CONTRIBUTED" | "ON_TIME" | "LATE" | "CONTRIBUTED_LATE" | "OVERDUE" | "GRACE_PERIOD" | "UPCOMING" | string;
  amount?: number | null;
  paymentChannel?: PaymentChannel | null;
  paymentDate?: string | null;
  recordedAt?: string | null;
  daysLate: number;
  penaltyAmount: number;
}

export interface MemberStatementResponse {
  memberId: string;
  memberCode: string;
  fullName?: string;
  memberName?: string;
  email: string;
  totalAccumulated?: number;
  totalAccumulatedCapital?: number;
  onTimeCount?: number;
  onTimeRemittancesCount?: number;
  overdueCount?: number;
  overdueMissedCutoffsCount?: number;
  contributedCount?: number;
  totalContributedCutoffsCount?: number;
  totalPenalties?: number;
  totalContributionPenalties?: number;
  schedule?: MemberCutoffIndicator[];
  cutoffSchedule?: MemberCutoffIndicator[];
  remittanceLedger: MemberContributionItem[];
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
  principalPaid?: number;
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
  status: "PENDING" | "PAID" | "OVERDUE" | "UPCOMING";
  latePenaltyPaid?: number;
  accruedPenalty?: number;
  isDelayed?: boolean;
  daysOverdue?: number;
  paymentDate?: string | null;
  paymentChannel?: PaymentChannel | null;
  notes?: string | null;
}

export interface RecordRepaymentPayload {
  cutoffId: string;
  principalPaid: number;
  latePenaltyPaid?: number;
  paymentDate?: string;
  paymentChannel?: PaymentChannel;
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
  paymentChannel?: PaymentChannel | null;
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
  totalShareCapital?: number;
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
  totalLatePenaltiesPaid?: number;
  totalAccruedLatePenalties?: number;
  remainingPrincipalReceivable?: number;
  loanInterestIncome?: number;
  netBankInterest?: number;
  dividendPool?: number;
  patronagePool?: number;
  dividendWeightPercent?: number;
  patronageWeightPercent?: number;
  managementWeightPercent?: number;
  statementCashInBank?: number;
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
  totalLatePenaltiesPaid?: number;
  totalAccruedLatePenalties?: number;
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
  dividendWeightPercent?: number;
  patronageWeightPercent?: number;
  managementWeightPercent?: number;
}

export interface LoanPolicySnapshot {
  gracePeriodDays: number;
  contributionGracePeriodDays?: number;
  latePenaltyRatePercent: number;
  standardLoanInterestRatePercent: number;
  effectiveFromUtc: string;
}

export interface DistributionWeightSnapshot {
  effectiveFromFiscalYear: number;
  dividendWeightPercent: number;
  patronageWeightPercent: number;
  managementWeightPercent: number;
  updatedAtUtc: string;
}

export interface FinancialPolicyResponse {
  currentActiveFiscalYear: number;
  activeLoanPolicy: LoanPolicySnapshot;
  loanPolicyHistory: LoanPolicySnapshot[];
  currentYearDistributionWeights: DistributionWeightSnapshot;
  nextYearDistributionWeights: DistributionWeightSnapshot;
  distributionWeightHistory: DistributionWeightSnapshot[];
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

export interface BankAccount {
  id: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  currentBalance: number;
  isPrimary: boolean;
  lastReconciledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateBankAccountPayload {
  bankName: string;
  accountNumber: string;
  accountName: string;
  initialBalance: number;
  isPrimary: boolean;
}

export interface AdjustBankBalancePayload {
  newBalance: number;
  reason?: string;
  markReconciled?: boolean;
}

export interface LiquiditySummary {
  totalBankBalance: number;
  primaryBankBalance: number;
  reserveCushionPercent: number;
  reserveCushionAmount: number;
  availableLiquidCash: number;
  queuedLoanDemands: number;
  netUnallocatedCash: number;
  activeBankAccountsCount: number;
  primaryBankName?: string | null;
  primaryAccountNumber?: string | null;
}

export type LoanQueueStatus =
  | "Queued"
  | "UnderReview"
  | "ReadyForFunding"
  | "Disbursed"
  | "Cancelled"
  | "Rejected";

export interface LoanQueueEntry {
  id: string;
  queueNumber: number;
  memberId: string;
  memberName: string;
  memberCode: string;
  desiredPrincipal: number;
  termMonths: number;
  cutoffsCount: number;
  estimatedCutoffPayment: number;
  purpose: string;
  status: LoanQueueStatus;
  requestedAt: string;
  readyAt: string | null;
  coMakerMemberId: string | null;
  coMakerMemberName?: string | null;
  disbursedLoanId?: string | null;
  disbursedLoanReference?: string | null;
  disbursedAt?: string | null;
  adminNotes?: string | null;
  queuePosition: number;
  canBeFunded: boolean;
}

export interface MyQueueStatus {
  activeEntry: LoanQueueEntry | null;
  queuePosition: number;
  totalActiveInQueue: number;
  estimatedLiquidReserve: number;
  estimatedFundingCutoff: string | null;
  hasActiveEntry: boolean;
}

export interface ApplyLoanQueuePayload {
  memberId?: string;
  desiredPrincipal: number;
  purpose: string;
  coMakerMemberId?: string | null;
}

export interface CoMakerOption {
  id: string;
  memberCode: string;
  firstName: string;
  lastName: string;
  displayName: string;
}
