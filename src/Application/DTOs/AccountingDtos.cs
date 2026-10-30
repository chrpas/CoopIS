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
    decimal TotalLatePenalties = 0.00m
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
    decimal TotalPrincipalRepayments = 0.00m
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
