using System;
using System.Collections.Generic;

namespace CoopIS.Application.DTOs;

public record LoanPolicySnapshotDto(
    int GracePeriodDays,
    decimal LatePenaltyRatePercent,
    decimal StandardLoanInterestRatePercent,
    DateTime EffectiveFromUtc,
    int ContributionGracePeriodDays = 5
);

public record UpdateLoanPolicyRequestDto(
    int GracePeriodDays,
    decimal LatePenaltyRatePercent,
    decimal StandardLoanInterestRatePercent,
    int ContributionGracePeriodDays = 5
);

public record DistributionWeightSnapshotDto(
    int EffectiveFromFiscalYear,
    decimal DividendWeightPercent,
    decimal PatronageWeightPercent,
    decimal ManagementWeightPercent,
    DateTime UpdatedAtUtc
);

public record UpdateDistributionWeightsRequestDto(
    decimal DividendWeightPercent,
    decimal PatronageWeightPercent,
    decimal ManagementWeightPercent
);

public record FinancialPolicyResponseDto(
    int CurrentActiveFiscalYear,
    LoanPolicySnapshotDto ActiveLoanPolicy,
    List<LoanPolicySnapshotDto> LoanPolicyHistory,
    DistributionWeightSnapshotDto CurrentYearDistributionWeights,
    DistributionWeightSnapshotDto NextYearDistributionWeights,
    List<DistributionWeightSnapshotDto> DistributionWeightHistory
);

