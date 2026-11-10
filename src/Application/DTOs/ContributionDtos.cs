using System;
using System.Collections.Generic;
using CoopIS.Domain.Enums;

namespace CoopIS.Application.DTOs;

public record ContributionItemDto(
    Guid MemberId,
    Guid CutoffId,
    decimal Amount,
    PaymentChannel PaymentChannel = PaymentChannel.CASH
);

public record CutoffMemberContributionDto(
    Guid MemberId,
    string MemberCode,
    string MemberName,
    string Email,
    MemberStatus Status,
    Guid CutoffId,
    string CutoffLabel,
    Guid? ContributionId,
    decimal Amount,
    PaymentChannel PaymentChannel,
    DateTime? RecordedAt,
    decimal TotalShareCapital = 0.00m
);

public record BatchContributionResultDto(
    int TotalProcessed,
    int CreatedCount,
    int UpdatedCount,
    decimal TotalAmountBatch,
    string Message
);

public record MemberContributionSummaryDto(
    Guid MemberId,
    string MemberCode,
    string MemberName,
    decimal TotalContribution,
    int ContributionsCount,
    DateTime? LastContributionDate
);

public record ContributionSummaryDto(
    decimal GrandTotalShareCapital,
    int ActiveContributingMembersCount,
    int TotalMembersCount,
    decimal AverageContributionPerMember,
    List<MemberContributionSummaryDto> MemberContributions
);

public record MemberCutoffIndicatorDto(
    Guid CutoffId,
    string Label,
    int CutoffNumber,
    DateTime CutoffDate,
    int FiscalYear,
    string Status,
    decimal? Amount,
    PaymentChannel? PaymentChannel,
    DateTime? RecordedAt,
    int DaysLate,
    decimal LatePenaltyAmount
);

public record MemberStatementDto(
    Guid MemberId,
    string MemberCode,
    string MemberName,
    string Email,
    decimal TotalAccumulatedCapital,
    int OnTimeRemittancesCount,
    int OverdueMissedCutoffsCount,
    int TotalContributedCutoffsCount,
    decimal TotalContributionPenalties,
    List<MemberCutoffIndicatorDto> CutoffSchedule,
    List<MemberContributionItemDto> RemittanceLedger
)
{
    public string FullName => MemberName;
    public decimal TotalAccumulated => TotalAccumulatedCapital;
    public int OnTimeCount => OnTimeRemittancesCount;
    public int OverdueCount => OverdueMissedCutoffsCount;
    public int ContributedCount => TotalContributedCutoffsCount;
    public decimal TotalPenalties => TotalContributionPenalties;
    public List<MemberCutoffIndicatorDto> Schedule => CutoffSchedule;
};
