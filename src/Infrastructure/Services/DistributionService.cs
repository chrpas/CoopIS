using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using CoopIS.Domain.Entities;
using CoopIS.Domain.Enums;
using CoopIS.Domain.Exceptions;
using CoopIS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CoopIS.Infrastructure.Services;

public class DistributionService : IDistributionService
{
    private readonly AppDbContext _context;
    private readonly IFinancialPolicyService _financialPolicyService;

    public DistributionService(AppDbContext context, IFinancialPolicyService financialPolicyService)
    {
        _context = context;
        _financialPolicyService = financialPolicyService;
    }

    public async Task<DistributionPreviewDto> GetPreviewAsync(int fiscalYear, CancellationToken cancellationToken = default)
    {
        // 1. Calculate Distributable Interest
        // Total Distributable Interest = Sum(Loan Upfront Interest) + Sum(Late Penalties across all loan schedules) + Sum(Net Bank Interest)
        var loans = await _context.Loans
            .AsNoTracking()
            .Include(l => l.Repayments)
                .ThenInclude(r => r.CutoffPeriod)
            .Where(l => l.OriginationDate.Year == fiscalYear &&
                       (l.Status == LoanStatus.ACTIVE || l.Status == LoanStatus.PAID || l.Status == LoanStatus.APPROVED))
            .ToListAsync(cancellationToken);

        var allCutoffs = await _context.CutoffPeriods
            .AsNoTracking()
            .OrderBy(c => c.CutoffDate)
            .ToListAsync(cancellationToken);

        decimal loanInterestIncome = Math.Round(loans.Sum(l => l.InterestEarned), 2);
        decimal latePenaltiesIncome = 0.00m;

        foreach (var loan in loans)
        {
            var repaymentsMap = loan.Repayments
                .GroupBy(r => r.CutoffId)
                .ToDictionary(g => g.Key, g => g.Last());
            var scheduledCutoffs = allCutoffs
                .Where(c => c.CutoffDate >= loan.OriginationDate.Date)
                .OrderBy(c => c.CutoffDate)
                .Take(loan.CutoffsCount)
                .ToList();

            if (scheduledCutoffs.Count < loan.CutoffsCount)
            {
                var scheduledIds = scheduledCutoffs.Select(c => c.Id).ToHashSet();
                var extraCutoffs = loan.Repayments
                    .Where(r => !scheduledIds.Contains(r.CutoffId) && r.CutoffPeriod != null)
                    .Select(r => r.CutoffPeriod)
                    .ToList();
                scheduledCutoffs.AddRange(extraCutoffs);
                scheduledCutoffs = scheduledCutoffs
                    .OrderBy(c => c.CutoffDate)
                    .Take(loan.CutoffsCount)
                    .ToList();
            }

            var loanPolicy = await _financialPolicyService.GetEffectiveLoanPolicyAsync(loan.CreatedAt, cancellationToken);
            int gracePeriodDays = loanPolicy.GracePeriodDays;
            decimal penaltyRate = Math.Round(loanPolicy.LatePenaltyRatePercent / 100m, 4);

            int installment = 1;
            var scheduledCutoffIdSet = new HashSet<Guid>();
            foreach (var cutoff in scheduledCutoffs)
            {
                scheduledCutoffIdSet.Add(cutoff.Id);
                repaymentsMap.TryGetValue(cutoff.Id, out var r);

                decimal scheduledAmount = Math.Round(loan.CutoffPaymentAmount, 2);
                if (installment == loan.CutoffsCount)
                {
                    decimal sumPrevious = Math.Round(loan.CutoffPaymentAmount, 2) * (loan.CutoffsCount - 1);
                    scheduledAmount = Math.Round(loan.PrincipalAmount - sumPrevious, 2);
                }

                decimal principalPaid = Math.Round(r?.PrincipalPaid ?? 0.00m, 2);
                decimal latePenaltyPaid = Math.Round(r?.LatePenaltyPaid ?? 0.00m, 2);

                var dueDateWithGrace = cutoff.CutoffDate.Date
                    .AddDays(gracePeriodDays)
                    .AddHours(23)
                    .AddMinutes(59)
                    .AddSeconds(59);

                bool isPaid = principalPaid >= scheduledAmount;
                bool isPastGrace = DateTime.UtcNow > dueDateWithGrace;
                bool isOverdue = !isPaid && isPastGrace;

                decimal unpaidBalance = Math.Max(0m, scheduledAmount - principalPaid);
                decimal accruedPenalty = isOverdue ? Math.Round(unpaidBalance * penaltyRate, 2) : 0.00m;

                latePenaltiesIncome += latePenaltyPaid + accruedPenalty;
                installment++;
            }

            var extraPaidPenalties = loan.Repayments
                .Where(r => !scheduledCutoffIdSet.Contains(r.CutoffId))
                .Sum(r => Math.Round(r.LatePenaltyPaid, 2));
            latePenaltiesIncome += extraPaidPenalties;
        }

        latePenaltiesIncome = Math.Round(latePenaltiesIncome, 2);

        decimal netBankInterestIncome = Math.Round(
            await _context.BankReconciliations
                .AsNoTracking()
                .Where(b => b.CutoffPeriod != null
                    ? b.CutoffPeriod.FiscalYear == fiscalYear
                    : b.StatementDate.Year == fiscalYear)
                .SumAsync(b => (decimal?)b.NetBankInterest, cancellationToken) ?? 0.00m,
            2);

        decimal totalDistributableInterest = Math.Round(
            loanInterestIncome + latePenaltiesIncome + netBankInterestIncome,
            2);

        // Check if an existing distribution has been recorded/seeded
        var existingDist = await _context.SurplusDistributions
            .AsNoTracking()
            .Include(d => d.MemberLedgers)
            .FirstOrDefaultAsync(d => d.FiscalYear == fiscalYear, cancellationToken);

        if (totalDistributableInterest == 0 && existingDist != null && existingDist.TotalInterestIncome > 0)
        {
            totalDistributableInterest = existingDist.TotalInterestIncome;
        }

        // 2. Pool Partitions (resolved from effective fiscal year policy; mid-year changes only apply to future years)
        var effectiveWeights = await _financialPolicyService.GetEffectiveDistributionWeightsAsync(fiscalYear, cancellationToken);
        decimal divWeight = effectiveWeights.DividendWeightPercent / 100m;
        decimal patWeight = effectiveWeights.PatronageWeightPercent / 100m;
        decimal mgmtWeight = effectiveWeights.ManagementWeightPercent / 100m;

        decimal dividendPool = existingDist != null && existingDist.IsFinalized
            ? existingDist.DividendPool
            : Math.Round(totalDistributableInterest * divWeight, 2);
        decimal patronagePool = existingDist != null && existingDist.IsFinalized
            ? existingDist.PatronagePool
            : Math.Round(totalDistributableInterest * patWeight, 2);
        decimal managementPool = existingDist != null && existingDist.IsFinalized
            ? existingDist.ManagementPool
            : Math.Round(totalDistributableInterest * mgmtWeight, 2);

        // 3. Member Contributions & Loans Borrowed
        var members = await _context.Members
            .AsNoTracking()
            .OrderBy(m => m.MemberCode)
            .ToListAsync(cancellationToken);

        // Contributions for fiscal cycle (cumulative share capital up to fiscal year)
        var memberContribs = await _context.Contributions
            .AsNoTracking()
            .Where(c => c.CutoffPeriod.FiscalYear <= fiscalYear)
            .GroupBy(c => c.MemberId)
            .Select(g => new { MemberId = g.Key, Total = g.Sum(c => c.Amount) })
            .ToDictionaryAsync(g => g.MemberId, g => g.Total, cancellationToken);

        decimal grandTotalContributions = memberContribs.Values.Sum();

        // Borrowing Volume (Loan Principal Amount in fiscal cycle)
        var memberLoans = loans
            .GroupBy(l => l.MemberId)
            .ToDictionary(g => g.Key, g => g.Sum(l => l.PrincipalAmount));

        decimal grandTotalLoanVolume = memberLoans.Values.Sum();

        // 4. Calculate Member Allocations
        // Member Contribution Ratio = Member Total Contribution / Grand Total Contributions
        // Member Dividend = Member Contribution Ratio * General Dividend Pool
        // Member Loan Ratio = Member Total Borrowing Volume / Grand Total Loan Volume
        // Member Patronage = Member Loan Ratio * Patronage Refund Pool
        // Net Credited Savings = Member Total Contribution + Member Dividend + Member Patronage
        var allocations = new List<MemberAllocationDto>(members.Count);

        foreach (var member in members)
        {
            decimal contrib = memberContribs.TryGetValue(member.Id, out var cVal) ? cVal : 0.00m;
            decimal contribRatio = grandTotalContributions > 0 ? Math.Round(contrib / grandTotalContributions, 8) : 0.00000000m;
            decimal dividend = Math.Round(contribRatio * dividendPool, 2);

            decimal loanVol = memberLoans.TryGetValue(member.Id, out var lVal) ? lVal : 0.00m;
            decimal loanRatio = grandTotalLoanVolume > 0 ? Math.Round(loanVol / grandTotalLoanVolume, 8) : 0.00000000m;
            decimal patronage = Math.Round(loanRatio * patronagePool, 2);

            decimal totalSurplus = dividend + patronage;
            decimal netCredited = contrib + dividend + patronage;

            allocations.Add(new MemberAllocationDto(
                member.Id,
                member.MemberCode,
                $"{member.FirstName} {member.LastName}",
                member.Email,
                contrib,
                contribRatio,
                dividend,
                loanVol,
                loanRatio,
                patronage,
                totalSurplus,
                netCredited
            ));
        }

        int contributingCount = allocations.Count(a => a.TotalContribution > 0);
        int borrowingCount = allocations.Count(a => a.TotalLoansBorrowed > 0);

        return new DistributionPreviewDto(
            fiscalYear,
            totalDistributableInterest,
            loanInterestIncome,
            latePenaltiesIncome,
            netBankInterestIncome,
            dividendPool,
            patronagePool,
            managementPool,
            grandTotalContributions,
            grandTotalLoanVolume,
            members.Count,
            contributingCount,
            borrowingCount,
            existingDist?.IsFinalized ?? false,
            existingDist?.FinalizedAt,
            allocations,
            effectiveWeights.DividendWeightPercent,
            effectiveWeights.PatronageWeightPercent,
            effectiveWeights.ManagementWeightPercent
        );
    }

    public async Task<DistributionPreviewDto> FinalizeDistributionAsync(int fiscalYear, CancellationToken cancellationToken = default)
    {
        var existing = await _context.SurplusDistributions
            .Include(d => d.MemberLedgers)
            .FirstOrDefaultAsync(d => d.FiscalYear == fiscalYear, cancellationToken);

        if (existing != null && existing.IsFinalized)
        {
            throw new ValidationException(
                $"Fiscal Year {fiscalYear} surplus distribution has already been finalized on {existing.FinalizedAt:MMM dd, yyyy}. Cannot re-finalize a closed period.");
        }

        var preview = await GetPreviewAsync(fiscalYear, cancellationToken);

        bool supportsTransactions = !_context.Database.IsInMemory();

        if (supportsTransactions)
        {
            await using var tx = await _context.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                await PersistDistributionAndCloseCutoffs(fiscalYear, preview, existing, cancellationToken);
                await tx.CommitAsync(cancellationToken);
            }
            catch
            {
                await tx.RollbackAsync(cancellationToken);
                throw;
            }
        }
        else
        {
            await PersistDistributionAndCloseCutoffs(fiscalYear, preview, existing, cancellationToken);
        }

        // Return updated preview showing finalized state
        return await GetPreviewAsync(fiscalYear, cancellationToken);
    }

    private async Task PersistDistributionAndCloseCutoffs(
        int fiscalYear,
        DistributionPreviewDto preview,
        SurplusDistribution? existing,
        CancellationToken cancellationToken)
    {
        var distribution = existing ?? new SurplusDistribution
        {
            Id = Guid.NewGuid(),
            FiscalYear = fiscalYear
        };

        distribution.TotalInterestIncome = preview.TotalDistributableInterest;
        distribution.DividendPool = preview.DividendPool;
        distribution.PatronagePool = preview.PatronagePool;
        distribution.ManagementPool = preview.ManagementPool;
        distribution.IsFinalized = true;
        distribution.FinalizedAt = DateTime.UtcNow;

        if (existing == null)
        {
            _context.SurplusDistributions.Add(distribution);
        }
        else if (existing.MemberLedgers.Any())
        {
            _context.MemberSurplusLedgers.RemoveRange(existing.MemberLedgers);
        }

        // Add MemberSurplusLedger entries
        foreach (var item in preview.Allocations)
        {
            var ledger = new MemberSurplusLedger
            {
                Id = Guid.NewGuid(),
                DistributionId = distribution.Id,
                MemberId = item.MemberId,
                TotalContribution = item.TotalContribution,
                ContributionRatio = item.ContributionRatio,
                DividendEarned = item.DividendEarned,
                TotalLoansBorrowed = item.TotalLoansBorrowed,
                LoanRatio = item.LoanRatio,
                PatronageEarned = item.PatronageEarned,
                NetSavingsCredited = item.NetSavingsCredited
            };
            _context.MemberSurplusLedgers.Add(ledger);
        }

        // Close all semi-monthly cutoffs for this fiscal year
        var cutoffs = await _context.CutoffPeriods
            .Where(c => c.FiscalYear == fiscalYear)
            .ToListAsync(cancellationToken);

        foreach (var c in cutoffs)
        {
            c.IsClosed = true;
        }

        // Automatically generate next fiscal year's 24 semi-monthly cutoff periods if they do not exist yet
        int nextFiscalYear = fiscalYear + 1;
        bool hasNextYearCutoffs = await _context.CutoffPeriods
            .AnyAsync(c => c.FiscalYear == nextFiscalYear, cancellationToken);

        if (!hasNextYearCutoffs)
        {
            var nextYearCutoffs = DbInitializer.BuildCutoffPeriodsForYear(nextFiscalYear);
            _context.CutoffPeriods.AddRange(nextYearCutoffs);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }

    public async Task<MemberStatementOfAccountDto> GetMemberStatementOfAccountAsync(
        Guid memberId,
        int fiscalYear,
        CancellationToken cancellationToken = default)
    {
        var member = await _context.Members
            .AsNoTracking()
            .FirstOrDefaultAsync(m => m.Id == memberId, cancellationToken);

        if (member == null)
        {
            throw new NotFoundException($"Member with ID '{memberId}' was not found.");
        }

        // Contributions for this member
        var contributions = await _context.Contributions
            .AsNoTracking()
            .Include(c => c.CutoffPeriod)
            .Where(c => c.MemberId == memberId && c.CutoffPeriod.FiscalYear <= fiscalYear)
            .OrderBy(c => c.CutoffPeriod.CutoffDate)
            .Select(c => new MemberSoaContributionItemDto(
                c.CutoffPeriod.Label,
                c.CutoffPeriod.CutoffDate,
                c.Amount,
                c.PaymentChannel.ToString()
            ))
            .ToListAsync(cancellationToken);

        decimal totalContributions = contributions.Sum(c => c.Amount);

        // Loans for this member
        var loans = await _context.Loans
            .AsNoTracking()
            .Include(l => l.Repayments)
            .Where(l => l.MemberId == memberId && l.OriginationDate.Year == fiscalYear)
            .OrderBy(l => l.OriginationDate)
            .Select(l => new MemberSoaLoanItemDto(
                l.LoanReference,
                l.OriginationDate,
                l.PrincipalAmount,
                l.InterestRate,
                l.InterestEarned,
                l.Status.ToString(),
                l.Repayments.Sum(r => r.PrincipalPaid),
                Math.Max(0m, l.PrincipalAmount - l.Repayments.Sum(r => r.PrincipalPaid))
            ))
            .ToListAsync(cancellationToken);

        decimal totalLoansBorrowed = loans.Sum(l => l.PrincipalAmount);

        // Get distribution allocation
        var preview = await GetPreviewAsync(fiscalYear, cancellationToken);
        var memberAlloc = preview.Allocations.FirstOrDefault(a => a.MemberId == memberId);

        decimal contribRatio = memberAlloc?.ContributionRatio ?? 0m;
        decimal dividendEarned = memberAlloc?.DividendEarned ?? 0m;
        decimal loanRatio = memberAlloc?.LoanRatio ?? 0m;
        decimal patronageEarned = memberAlloc?.PatronageEarned ?? 0m;
        decimal totalSurplusEarned = dividendEarned + patronageEarned;
        decimal netSavingsCredited = totalContributions + totalSurplusEarned;

        return new MemberStatementOfAccountDto(
            member.Id,
            member.MemberCode,
            $"{member.FirstName} {member.LastName}",
            member.Email,
            member.Phone,
            member.Status.ToString(),
            fiscalYear,
            DateTime.UtcNow,
            totalContributions,
            contribRatio,
            dividendEarned,
            totalLoansBorrowed,
            loanRatio,
            patronageEarned,
            totalSurplusEarned,
            netSavingsCredited,
            preview.IsAlreadyFinalized,
            contributions,
            loans
        );
    }
}
