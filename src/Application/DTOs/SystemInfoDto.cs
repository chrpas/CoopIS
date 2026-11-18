using System;

namespace CoopIS.Application.DTOs;

public record SystemInfoDto(
    string PlatformName,
    string SoftwareVersion,
    string? GitCommitSha,
    string EnvironmentName,
    string DeploymentPlatform,
    int ActiveFiscalYear,
    int CutoffScheduleCount,
    string BaseCurrency,
    string CurrencySymbol,
    string Locale,
    string DatabaseEngine,
    string DatabaseStatus,
    bool IsDatabaseHealthy,
    DateTime ServerTimeUtc
);
