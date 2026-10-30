using System;
using System.Collections.Generic;
using CoopIS.Domain.Enums;

namespace CoopIS.Application.DTOs;

public record ContributionItemDto(
    Guid MemberId,
    Guid CutoffId,
    decimal Amount,
    PaymentChannel PaymentChannel = PaymentChannel.PAYROLL_DEDUCTION
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
    DateTime? RecordedAt
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
