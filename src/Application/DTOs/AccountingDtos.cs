using System;
using System.Collections.Generic;

namespace CoopIS.Application.DTOs;

public record BalanceSheetDto(
    DateTime AsOfDate,
    decimal CashInBank,
    decimal AccountsReceivable,
    decimal TotalAssets,
    decimal SalariesHonorariaPayable,
    decimal TotalLiabilities,
    decimal CommonShareCapital,
    decimal NetRetainedSurplus,
    decimal TotalEquity,
    decimal TotalLiabilitiesAndEquity,
    decimal TotalDistributableInterest,
    int ActiveLoansCount,
    decimal TotalLatePenalties = 0.00m,
    decimal TotalLatePenaltiesPaid = 0.00m,
    decimal TotalAccruedLatePenalties = 0.00m,
    decimal RemainingPrincipalReceivable = 0.00m,
    decimal LoanInterestIncome = 0.00m,
    decimal NetBankInterest = 0.00m,
    decimal DividendPool = 0.00m,
    decimal PatronagePool = 0.00m,
    decimal DividendWeightPercent = 65m,
    decimal PatronageWeightPercent = 30m,
    decimal ManagementWeightPercent = 5m,
    decimal StatementCashInBank = 0.00m
);

public record FundReconciliationDto(
    DateTime AsOfDate,
    decimal TotalContributions,
    decimal TotalLoanReceipts,
    decimal NetBankInterest,
    decimal TotalLoanDisbursements,
    decimal BookBalance,
    decimal CashInBank,
    decimal Variance,
    bool IsReconciled,
    DateTime? LatestStatementDate,
    decimal TotalLatePenalties = 0.00m,
    decimal TotalPrincipalRepayments = 0.00m,
    decimal TotalLatePenaltiesPaid = 0.00m,
    decimal TotalAccruedLatePenalties = 0.00m
);

public record CreateBankReconRequest(
    Guid? CutoffId,
    DateTime StatementDate,
    decimal CashInBank,
    decimal BankGrossInterest,
    decimal? WithholdingTax,
    string? Notes
);

public record BankReconciliationDto(
    Guid Id,
    Guid? CutoffId,
    string? CutoffLabel,
    DateTime StatementDate,
    decimal CashInBank,
    decimal BankGrossInterest,
    decimal WithholdingTax,
    decimal NetBankInterest,
    decimal ReconciledVariance,
    string? Notes,
    DateTime CreatedAt
);
