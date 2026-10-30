using System;
using System.Collections.Generic;
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
    decimal TotalRepayments,
    decimal TotalLatePenalties = 0.00m
);

public record AmortizationScheduleItemDto(
    int InstallmentNumber,
    Guid CutoffId,
    string CutoffLabel,
    DateTime CutoffDate,
    decimal ScheduledPrincipal,
    decimal PrincipalPaid,
    decimal RemainingBalance,
    string Status,
    decimal LatePenaltyPaid = 0.00m,
    decimal AccruedPenalty = 0.00m,
    bool IsDelayed = false,
    int DaysOverdue = 0,
    DateTime? PaymentDate = null,
    string? Notes = null
);

public record RecordLoanRepaymentRequest(
    Guid CutoffId,
    decimal PrincipalPaid,
    decimal LatePenaltyPaid = 0.00m,
    DateTime? PaymentDate = null,
    string? Notes = null
);

public record LoanRepaymentResponseDto(
    Guid Id,
    Guid LoanId,
    Guid CutoffId,
    string CutoffLabel,
    DateTime CutoffDate,
    decimal PrincipalPaid,
    decimal LatePenaltyPaid,
    decimal TotalPaidThisEntry,
    decimal RemainingLoanBalance,
    bool IsDelayed,
    int DaysOverdue,
    DateTime? PaymentDate,
    DateTime RecordedAt,
    string LoanStatus,
    string? Notes
);

public record LoanPenaltySummaryDto(
    Guid LoanId,
    string LoanReference,
    Guid MemberId,
    string MemberName,
    decimal PrincipalAmount,
    decimal TotalPrincipalPaid,
    decimal RemainingPrincipal,
    decimal TotalLatePenaltiesPaid,
    decimal TotalAccruedPenalties,
    decimal OutstandingPenalties,
    int TotalCutoffs,
    int PaidCutoffsCount,
    int OverdueCutoffsCount,
    int GracePeriodDays,
    List<CutoffPenaltyDetailDto> PenaltiesBreakdown
);

public record CutoffPenaltyDetailDto(
    Guid? RepaymentId,
    Guid CutoffId,
    string CutoffLabel,
    DateTime CutoffDate,
    DateTime DueDateWithGrace,
    decimal ScheduledPrincipal,
    decimal PrincipalPaid,
    decimal RemainingBalance,
    decimal LatePenaltyPaid,
    decimal AccruedPenalty,
    bool IsDelayed,
    bool IsOverdue,
    int DaysLate,
    DateTime? PaymentDate,
    string Status
);
