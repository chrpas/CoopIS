using System;
using System.Collections.Generic;
using CoopIS.Domain.Enums;

namespace CoopIS.Application.DTOs;

public record PagedResult<T>(
    IReadOnlyList<T> Items,
    int TotalCount,
    int Page,
    int PageSize,
    int TotalPages
);

public class MemberQueryParams
{
    public string? Search { get; set; }
    public MemberStatus? Status { get; set; }
    public string? SortBy { get; set; } = "lastName";
    public string? SortOrder { get; set; } = "asc";
    public int Page { get; set; } = 1;
    public int PageSize { get; set; } = 10;
}

public record MemberDto(
    Guid Id,
    string MemberCode,
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    MemberStatus Status,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    decimal TotalContributions = 0,
    int ActiveLoansCount = 0
);

public record MemberContributionItemDto(
    Guid Id,
    Guid CutoffId,
    string CutoffLabel,
    DateTime CutoffDate,
    decimal Amount,
    PaymentChannel PaymentChannel,
    DateTime CreatedAt
);

public record MemberLoanSummaryDto(
    Guid Id,
    string LoanReference,
    DateTime OriginationDate,
    decimal PrincipalAmount,
    decimal InterestRate,
    decimal ReleasedAmount,
    decimal CutoffPaymentAmount,
    int TermMonths,
    int CutoffsCount,
    LoanStatus Status,
    decimal PrincipalPaid,
    decimal RemainingBalance,
    DateTime CreatedAt
);

public record MemberDetailDto(
    Guid Id,
    string MemberCode,
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    MemberStatus Status,
    DateTime CreatedAt,
    DateTime UpdatedAt,
    decimal TotalShareContributions,
    int TotalContributionsCount,
    DateTime? LastContributionDate,
    List<MemberContributionItemDto> Contributions,
    decimal TotalActiveLoanBalance,
    int ActiveLoansCount,
    List<MemberLoanSummaryDto> Loans
);

public record CreateMemberRequest(
    string? MemberCode,
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    MemberStatus Status = MemberStatus.ACTIVE
);

public record UpdateMemberRequest(
    string FirstName,
    string LastName,
    string Email,
    string? Phone,
    MemberStatus Status
);

public record UpdateMemberStatusRequest(
    MemberStatus Status,
    string? Reason = null
);
