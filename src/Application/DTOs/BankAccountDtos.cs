using System;

namespace CoopIS.Application.DTOs;

public record BankAccountDto(
    Guid Id,
    string BankName,
    string AccountNumber,
    string AccountName,
    decimal CurrentBalance,
    bool IsPrimary,
    DateTime? LastReconciledAt,
    DateTime CreatedAt,
    DateTime UpdatedAt
);

public record CreateBankAccountRequest(
    string BankName,
    string AccountNumber,
    string AccountName,
    decimal InitialBalance,
    bool IsPrimary
);

public record AdjustBankBalanceRequest(
    decimal NewBalance,
    string? Reason,
    bool MarkReconciled = true
);

public record LiquiditySummaryDto(
    decimal TotalBankBalance,
    decimal PrimaryBankBalance,
    decimal ReserveCushionPercent,
    decimal ReserveCushionAmount,
    decimal AvailableLiquidCash,
    decimal QueuedLoanDemands,
    decimal NetUnallocatedCash,
    int ActiveBankAccountsCount,
    string? PrimaryBankName,
    string? PrimaryAccountNumber
);

