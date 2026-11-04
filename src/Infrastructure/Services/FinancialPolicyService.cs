using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using CoopIS.Domain.Entities;
using CoopIS.Domain.Exceptions;
using CoopIS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CoopIS.Infrastructure.Services;

public class FinancialPolicyService : IFinancialPolicyService
{
    private const string LoanSnapshotsKey = "financial_policy.loan_snapshots";
    private const string DistributionSnapshotsKey = "financial_policy.distribution_snapshots";

    private static readonly DateTime BaselineDateUtc = new(2020, 1, 1, 0, 0, 0, DateTimeKind.Utc);

    private readonly AppDbContext _context;

    public FinancialPolicyService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<FinancialPolicyResponseDto> GetPolicyOverviewAsync(CancellationToken cancellationToken = default)
    {
        int currentActiveFiscalYear = await ResolveCurrentActiveFiscalYearAsync(cancellationToken);
        var loanHistory = await LoadLoanSnapshotsAsync(cancellationToken);
        var distHistory = await LoadDistributionSnapshotsAsync(cancellationToken);

        var activeLoanPolicy = loanHistory
            .OrderByDescending(s => s.EffectiveFromUtc)
            .First();

        var currentYearWeights = ResolveWeightsForYear(distHistory, currentActiveFiscalYear);
        var nextYearWeights = ResolveWeightsForYear(distHistory, currentActiveFiscalYear + 1);

        return new FinancialPolicyResponseDto(
            currentActiveFiscalYear,
            activeLoanPolicy,
            loanHistory.OrderByDescending(s => s.EffectiveFromUtc).ToList(),
            currentYearWeights,
            nextYearWeights,
            distHistory.OrderByDescending(s => s.EffectiveFromFiscalYear).ToList()
        );
    }

    public async Task<LoanPolicySnapshotDto> GetEffectiveLoanPolicyAsync(
        DateTime asOfUtc,
        CancellationToken cancellationToken = default)
    {
        var loanHistory = await LoadLoanSnapshotsAsync(cancellationToken);
        var utcTarget = asOfUtc.Kind == DateTimeKind.Utc
            ? asOfUtc
            : DateTime.SpecifyKind(asOfUtc, DateTimeKind.Utc);

        var match = loanHistory
            .Where(s => s.EffectiveFromUtc <= utcTarget)
            .OrderByDescending(s => s.EffectiveFromUtc)
            .FirstOrDefault();

        return match ?? loanHistory.OrderBy(s => s.EffectiveFromUtc).First();
    }

    public async Task<DistributionWeightSnapshotDto> GetEffectiveDistributionWeightsAsync(
        int fiscalYear,
        CancellationToken cancellationToken = default)
    {
        var distHistory = await LoadDistributionSnapshotsAsync(cancellationToken);
        return ResolveWeightsForYear(distHistory, fiscalYear);
    }

    public async Task<FinancialPolicyResponseDto> UpdateLoanPolicyAsync(
        UpdateLoanPolicyRequestDto request,
        CancellationToken cancellationToken = default)
    {
        if (request.GracePeriodDays < 0 || request.GracePeriodDays > 90)
        {
            throw new ValidationException("Loan cutoff payment grace period must be between 0 and 90 calendar days.");
        }

        int contribGraceDays = request.ContributionGracePeriodDays > 0 ? request.ContributionGracePeriodDays : 5;
        if (contribGraceDays < 0 || contribGraceDays > 90)
        {
            throw new ValidationException("Contribution cutoff grace period must be between 0 and 90 calendar days.");
        }

        if (request.LatePenaltyRatePercent < 0m || request.LatePenaltyRatePercent > 50m)
        {
            throw new ValidationException("Late penalty charge rate must be between 0% and 50%.");
        }

        if (request.StandardLoanInterestRatePercent <= 0m || request.StandardLoanInterestRatePercent > 50m)
        {
            throw new ValidationException("Standard loan interest rate must be greater than 0% and at most 50%.");
        }

        var loanHistory = await LoadLoanSnapshotsAsync(cancellationToken);

        var newSnapshot = new LoanPolicySnapshotDto(
            request.GracePeriodDays,
            Math.Round(request.LatePenaltyRatePercent, 2),
            Math.Round(request.StandardLoanInterestRatePercent, 2),
            DateTime.UtcNow,
            contribGraceDays
        );

        loanHistory.Add(newSnapshot);
        await SaveSettingJsonAsync(LoanSnapshotsKey, loanHistory, cancellationToken);

        return await GetPolicyOverviewAsync(cancellationToken);
    }

    public async Task<FinancialPolicyResponseDto> UpdateDistributionWeightsAsync(
        UpdateDistributionWeightsRequestDto request,
        CancellationToken cancellationToken = default)
    {
        decimal div = Math.Round(request.DividendWeightPercent, 2);
        decimal pat = Math.Round(request.PatronageWeightPercent, 2);
        decimal mgmt = Math.Round(request.ManagementWeightPercent, 2);

        if (div < 0m || pat < 0m || mgmt < 0m)
        {
            throw new ValidationException("Distribution weights cannot be negative.");
        }

        decimal sum = div + pat + mgmt;
        if (sum != 100.00m)
        {
            throw new ValidationException(
                $"Annual surplus distribution weights must sum to exactly 100% (currently {sum:N2}%).");
        }

        int currentActiveFiscalYear = await ResolveCurrentActiveFiscalYearAsync(cancellationToken);
        int targetFutureFiscalYear = currentActiveFiscalYear + 1;

        var distHistory = await LoadDistributionSnapshotsAsync(cancellationToken);

        // Ensure currentActiveFiscalYear has its locked snapshot preserved so mid-year changes never affect it
        var currentEffective = ResolveWeightsForYear(distHistory, currentActiveFiscalYear);
        if (!distHistory.Any(s => s.EffectiveFromFiscalYear == currentActiveFiscalYear))
        {
            distHistory.Add(new DistributionWeightSnapshotDto(
                currentActiveFiscalYear,
                currentEffective.DividendWeightPercent,
                currentEffective.PatronageWeightPercent,
                currentEffective.ManagementWeightPercent,
                currentEffective.UpdatedAtUtc
            ));
        }

        // Remove any existing staged entry for targetFutureFiscalYear and replace with the updated future weights
        distHistory.RemoveAll(s => s.EffectiveFromFiscalYear >= targetFutureFiscalYear);
        distHistory.Add(new DistributionWeightSnapshotDto(
            targetFutureFiscalYear,
            div,
            pat,
            mgmt,
            DateTime.UtcNow
        ));

        await SaveSettingJsonAsync(DistributionSnapshotsKey, distHistory, cancellationToken);

        return await GetPolicyOverviewAsync(cancellationToken);
    }

    private async Task<int> ResolveCurrentActiveFiscalYearAsync(CancellationToken cancellationToken)
    {
        var openYear = await _context.CutoffPeriods
            .AsNoTracking()
            .Where(c => !c.IsClosed)
            .MinAsync(c => (int?)c.FiscalYear, cancellationToken);

        if (openYear.HasValue)
        {
            return openYear.Value;
        }

        var maxYear = await _context.CutoffPeriods
            .AsNoTracking()
            .MaxAsync(c => (int?)c.FiscalYear, cancellationToken);

        return maxYear ?? 2026;
    }

    private static DistributionWeightSnapshotDto ResolveWeightsForYear(
        List<DistributionWeightSnapshotDto> snapshots,
        int fiscalYear)
    {
        var match = snapshots
            .Where(s => s.EffectiveFromFiscalYear <= fiscalYear)
            .OrderByDescending(s => s.EffectiveFromFiscalYear)
            .FirstOrDefault();

        return match ?? snapshots.OrderBy(s => s.EffectiveFromFiscalYear).First();
    }

    private async Task<List<LoanPolicySnapshotDto>> LoadLoanSnapshotsAsync(CancellationToken cancellationToken)
    {
        var setting = await _context.AppSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Key == LoanSnapshotsKey, cancellationToken);

        if (setting != null && !string.IsNullOrWhiteSpace(setting.Value))
        {
            try
            {
                var parsed = JsonSerializer.Deserialize<List<LoanPolicySnapshotDto>>(setting.Value);
                if (parsed != null && parsed.Count > 0)
                {
                    return parsed
                        .Select(s => s with
                        {
                            GracePeriodDays = s.EffectiveFromUtc == BaselineDateUtc && s.GracePeriodDays == 3 ? 14 : s.GracePeriodDays,
                            ContributionGracePeriodDays = s.ContributionGracePeriodDays <= 0 ? 5 : s.ContributionGracePeriodDays
                        })
                        .ToList();
                }
            }
            catch
            {
                // Fallback to default baseline
            }
        }

        return new List<LoanPolicySnapshotDto>
        {
            new(
                GracePeriodDays: 14,
                LatePenaltyRatePercent: 5.00m,
                StandardLoanInterestRatePercent: 5.00m,
                EffectiveFromUtc: BaselineDateUtc,
                ContributionGracePeriodDays: 5
            )
        };
    }

    private async Task<List<DistributionWeightSnapshotDto>> LoadDistributionSnapshotsAsync(CancellationToken cancellationToken)
    {
        var setting = await _context.AppSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(s => s.Key == DistributionSnapshotsKey, cancellationToken);

        if (setting != null && !string.IsNullOrWhiteSpace(setting.Value))
        {
            try
            {
                var parsed = JsonSerializer.Deserialize<List<DistributionWeightSnapshotDto>>(setting.Value);
                if (parsed != null && parsed.Count > 0)
                {
                    return parsed;
                }
            }
            catch
            {
                // Fallback to default baseline
            }
        }

        return new List<DistributionWeightSnapshotDto>
        {
            new(
                EffectiveFromFiscalYear: 2020,
                DividendWeightPercent: 65.00m,
                PatronageWeightPercent: 30.00m,
                ManagementWeightPercent: 5.00m,
                UpdatedAtUtc: BaselineDateUtc
            )
        };
    }

    private async Task SaveSettingJsonAsync<T>(string key, T data, CancellationToken cancellationToken)
    {
        var json = JsonSerializer.Serialize(data);
        var existing = await _context.AppSettings.FirstOrDefaultAsync(s => s.Key == key, cancellationToken);
        if (existing == null)
        {
            _context.AppSettings.Add(new AppSetting
            {
                Key = key,
                Value = json,
                UpdatedAt = DateTime.UtcNow
            });
        }
        else
        {
            existing.Value = json;
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}

