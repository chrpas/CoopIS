using System;
using CoopIS.Domain.Enums;

namespace CoopIS.Application.DTOs;

public record ApplyLoanQueueRequest(
    Guid? MemberId,
    decimal DesiredPrincipal,
    string Purpose,
    Guid? CoMakerMemberId
);

public record LoanQueueEntryDto(
    Guid Id,
    int QueueNumber,
    Guid MemberId,
    string MemberName,
    string MemberCode,
    decimal DesiredPrincipal,
    int TermMonths,
    int CutoffsCount,
    decimal EstimatedCutoffPayment,
    string Purpose,
    LoanQueueStatus Status,
    DateTime RequestedAt,
    DateTime? ReadyAt,
    Guid? CoMakerMemberId,
    string? CoMakerMemberName,
    Guid? DisbursedLoanId,
    string? DisbursedLoanReference,
    DateTime? DisbursedAt,
    string? AdminNotes,
    int QueuePosition,
    bool CanBeFunded
);

public record MyQueueStatusDto(
    LoanQueueEntryDto? ActiveEntry,
    int QueuePosition,
    int TotalActiveInQueue,
    decimal EstimatedLiquidReserve,
    string? EstimatedFundingCutoff,
    bool HasActiveEntry
);

public record UpdateQueueStatusRequest(
    LoanQueueStatus Status,
    string? AdminNotes
);

public record CoMakerOptionDto(
    Guid Id,
    string MemberCode,
    string FirstName,
    string LastName,
    string DisplayName
);

