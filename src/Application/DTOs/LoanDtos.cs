using System;
using CoopIS.Domain.Enums;

namespace CoopIS.Application.DTOs;

public record CreateLoanRequest(
    string LoanReference,
    Guid MemberId,
    DateTime OriginationDate,
    decimal PrincipalAmount,
    decimal InterestRate,
    int TermMonths,
    int CutoffsCount,
    string? Notes
);

public record UpdateLoanStatusRequest(
    LoanStatus Status,
    Guid? ApprovedBy,
    string? Notes
);

public record LoanResponseDto(
    Guid Id,
    string LoanReference,
    Guid MemberId,
    string MemberName,
    DateTime OriginationDate,
    decimal PrincipalAmount,
    decimal InterestRate,
    decimal InterestEarned,
    decimal ReleasedAmount,
    int TermMonths,
    int CutoffsCount,
    decimal CutoffPaymentAmount,
    LoanStatus Status,
    Guid? ApprovedBy,
    string? ApproverName,
    string? Notes,
    DateTime CreatedAt,
    decimal TotalRepayments
);

public record AmortizationScheduleItemDto(
    int InstallmentNumber,
    Guid CutoffId,
    string CutoffLabel,
    DateTime CutoffDate,
    decimal ScheduledPrincipal,
    decimal PrincipalPaid,
    decimal RemainingBalance,
    string Status
);

