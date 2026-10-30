using System;
using System.Collections.Generic;

namespace CoopIS.Application.DTOs;

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
    decimal NetSavingsCredited
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
    List<MemberAllocationDto> Allocations
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
    List<MemberSoaLoanItemDto> Loans
);
