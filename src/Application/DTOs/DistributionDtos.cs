using System;
using System.Collections.Generic;
using CoopIS.Domain.Enums;

namespace CoopIS.Application.DTOs;

public record UpdateMemberCarryoverRequest(
    CarryoverMode CarryoverMode,
    bool CarryoverCapital = false,
    bool CarryoverDividend = false,
    bool CarryoverPatronage = false,
    decimal? CustomCarryoverAmount = null
);

public record MemberAllocationDto(
    Guid MemberId,
    string MemberCode,
    string MemberName,
    string Email,
    decimal TotalContribution,
    decimal ContributionRatio,
    decimal DividendEarned,
    decimal TotalLoansBorrowed,
    decimal LoanRatio,
    decimal PatronageEarned,
    decimal TotalSurplusEarned,
    decimal NetSavingsCredited,
    CarryoverMode CarryoverMode = CarryoverMode.None,
    bool CarryoverCapital = false,
    bool CarryoverDividend = false,
    bool CarryoverPatronage = false,
    decimal CarriedOverAmount = 0.00m,
    decimal NetCashPayout = 0.00m
);

public record DistributionPreviewDto(
    int FiscalYear,
    decimal TotalDistributableInterest,
    decimal LoanInterestIncome,
    decimal LatePenaltiesIncome,
    decimal NetBankInterestIncome,
    decimal DividendPool,
    decimal PatronagePool,
    decimal ManagementPool,
    decimal GrandTotalContributions,
    decimal GrandTotalLoanVolume,
    int TotalMembersCount,
    int ContributingMembersCount,
    int BorrowingMembersCount,
    bool IsAlreadyFinalized,
    DateTime? FinalizedAt,
    List<MemberAllocationDto> Allocations,
    decimal DividendWeightPercent = 65m,
    decimal PatronageWeightPercent = 30m,
    decimal ManagementWeightPercent = 5m,
    decimal TotalGrossEntitlement = 0.00m,
    decimal TotalCarriedOverAmount = 0.00m,
    decimal TotalNetCashPayout = 0.00m,
    decimal PrimaryBankBalance = 0.00m,
    bool HasLiquidityShortfall = false,
    decimal LiquidityShortfallAmount = 0.00m
);

public record MemberSoaContributionItemDto(
    string CutoffLabel,
    DateTime CutoffDate,
    decimal Amount,
    string PaymentChannel
);

public record MemberSoaLoanItemDto(
    string LoanReference,
    DateTime OriginationDate,
    decimal PrincipalAmount,
    decimal InterestRate,
    decimal InterestEarned,
    string Status,
    decimal PrincipalPaid,
    decimal RemainingBalance
);

public record MemberStatementOfAccountDto(
    Guid MemberId,
    string MemberCode,
    string MemberName,
    string Email,
    string? Phone,
    string Status,
    int FiscalYear,
    DateTime AsOfDate,
    decimal TotalContributions,
    decimal ContributionRatio,
    decimal DividendEarned,
    decimal TotalLoansBorrowed,
    decimal LoanRatio,
    decimal PatronageEarned,
    decimal TotalSurplusEarned,
    decimal NetSavingsCredited,
    bool IsFinalized,
    List<MemberSoaContributionItemDto> Contributions,
    List<MemberSoaLoanItemDto> Loans,
    decimal CarriedOverAmount = 0.00m,
    decimal NetCashPayout = 0.00m
);
