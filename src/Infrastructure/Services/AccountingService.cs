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

public class AccountingService : IAccountingService
{
    private readonly AppDbContext _context;
    private readonly IFinancialPolicyService _financialPolicyService;

    public AccountingService(AppDbContext context, IFinancialPolicyService financialPolicyService)
    {
        _context = context;
        _financialPolicyService = financialPolicyService;
    }

    private sealed record LoanLedgerEvaluationResult(
        int ActiveLoansCount,
        decimal RemainingPrincipalReceivable,
        decimal TotalPrincipalRepayments,
        decimal TotalLoanDisbursements,
        decimal LoanInterestIncome,
        decimal TotalLatePenaltiesPaid,
        decimal TotalAccruedLatePenalties,
        decimal TotalLatePenalties
    );

    /// <summary>
    /// Evaluates all loans and their full amortization schedules (using the 14-day loan grace period
    /// and effective late penalty rate) to compute schedule-verified loan statuses, remaining principal
    /// receivables, paid late penalties, and accrued overdue schedule penalties across all loans.
    /// </summary>
    private async Task<LoanLedgerEvaluationResult> EvaluateAllLoansAndSchedulesAsync(CancellationToken cancellationToken)
    {
        var loans = await _context.Loans
            .Include(l => l.Repayments)
                .ThenInclude(r => r.CutoffPeriod)
            .ToListAsync(cancellationToken);

        var allCutoffs = await _context.CutoffPeriods
            .AsNoTracking()
            .OrderBy(c => c.CutoffDate)
            .ToListAsync(cancellationToken);

        bool statusReconciled = false;
        int activeLoansCount = 0;
        decimal remainingPrincipalReceivable = 0.00m;
        decimal totalPrincipalRepayments = 0.00m;
        decimal totalLoanDisbursements = 0.00m;
        decimal loanInterestIncome = 0.00m;
        decimal totalLatePenaltiesPaid = 0.00m;
        decimal totalAccruedLatePenalties = 0.00m;

        foreach (var loan in loans)
        {
            if (loan.Status != LoanStatus.ACTIVE &&
                loan.Status != LoanStatus.PAID &&
                loan.Status != LoanStatus.APPROVED)
            {
                continue;
            }

            var repaymentsMap = loan.Repayments.ToDictionary(r => r.CutoffId);

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

            decimal loanPaidPenalties = 0.00m;
            decimal loanAccruedPenalties = 0.00m;
            int paidInstallments = 0;
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
                if (isPaid)
                {
                    paidInstallments++;
                }

                bool isPastGrace = DateTime.UtcNow > dueDateWithGrace;
                bool isOverdue = !isPaid && isPastGrace;

                decimal unpaidBalance = Math.Max(0m, scheduledAmount - principalPaid);
                decimal accruedPenalty = isOverdue ? Math.Round(unpaidBalance * penaltyRate, 2) : 0.00m;

                loanPaidPenalties += latePenaltyPaid;
                loanAccruedPenalties += accruedPenalty;
                installment++;
            }

            // Include any late penalties recorded on repayments outside the primary scheduled cutoffs
            var extraPaidPenalties = loan.Repayments
                .Where(r => !scheduledCutoffIdSet.Contains(r.CutoffId))
                .Sum(r => Math.Round(r.LatePenaltyPaid, 2));
            loanPaidPenalties += extraPaidPenalties;

            bool allEntriesPaid = scheduledCutoffs.Count > 0 && paidInstallments == scheduledCutoffs.Count;
            LoanStatus effectiveStatus = loan.Status;
            if (allEntriesPaid)
            {
                effectiveStatus = LoanStatus.PAID;
            }
            else if (loan.Status == LoanStatus.PAID)
            {
                effectiveStatus = LoanStatus.ACTIVE;
            }

            if (loan.Status != effectiveStatus)
            {
                loan.Status = effectiveStatus;
                statusReconciled = true;
            }

            decimal loanPrincipalPaid = Math.Round(loan.Repayments.Sum(r => r.PrincipalPaid), 2);
            decimal loanRemainingPrincipal = Math.Max(0m, Math.Round(loan.PrincipalAmount - loanPrincipalPaid, 2));
            decimal loanDisbursed = Math.Round(
                loan.ReleasedAmount > 0 ? loan.ReleasedAmount : (loan.PrincipalAmount - loan.InterestEarned),
                2);

            totalPrincipalRepayments += loanPrincipalPaid;
            totalLoanDisbursements += loanDisbursed;
            loanInterestIncome += Math.Round(loan.InterestEarned, 2);
            totalLatePenaltiesPaid += Math.Round(loanPaidPenalties, 2);
            totalAccruedLatePenalties += Math.Round(loanAccruedPenalties, 2);

            if (effectiveStatus == LoanStatus.ACTIVE)
            {
                activeLoansCount++;
                remainingPrincipalReceivable += loanRemainingPrincipal;
            }
        }

        if (statusReconciled)
        {
            await _context.SaveChangesAsync(cancellationToken);
        }

        decimal totalLatePenalties = Math.Round(totalLatePenaltiesPaid + totalAccruedLatePenalties, 2);

        return new LoanLedgerEvaluationResult(
            activeLoansCount,
            Math.Round(remainingPrincipalReceivable, 2),
            Math.Round(totalPrincipalRepayments, 2),
            Math.Round(totalLoanDisbursements, 2),
            Math.Round(loanInterestIncome, 2),
            Math.Round(totalLatePenaltiesPaid, 2),
            Math.Round(totalAccruedLatePenalties, 2),
            totalLatePenalties
        );
    }

    public async Task<BalanceSheetDto> GetBalanceSheetAsync(CancellationToken cancellationToken = default)
    {
        // 1. Evaluate all loans & their schedules (statuses, principal receivables, paid & accrued penalties)
        var loanMetrics = await EvaluateAllLoansAndSchedulesAsync(cancellationToken);

        // 2. Common Share Capital = sum of all member contributions across all cutoffs (open and closed)
        decimal commonShareCapital = Math.Round(
            await _context.Contributions
                .AsNoTracking()
                .SumAsync(c => (decimal?)c.Amount, cancellationToken) ?? 0.00m,
            2);

        // 3. Bank Reconciliations & Net Bank Interest
        var latestRecon = await _context.BankReconciliations
            .AsNoTracking()
            .OrderByDescending(b => b.StatementDate)
            .ThenByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        decimal statementCashInBank = latestRecon?.CashInBank ?? 0.00m;

        decimal netBankInterest = Math.Round(
            await _context.BankReconciliations
                .AsNoTracking()
                .SumAsync(b => (decimal?)b.NetBankInterest, cancellationToken) ?? 0.00m,
            2);

        // 4. Assets:
        //    - Cash in Bank (Book Cash Balance) = Contributions + Loan Receipts (Principal Repayments + Schedule Late Penalties) + Net Bank Interest - Loan Capital Disbursed
        //    - Accounts Receivable - Loans = Sum of remaining principal balances across all schedule-verified active loans
        //    - Total Assets = Cash in Bank + Accounts Receivable
        decimal totalLoanReceipts = Math.Round(loanMetrics.TotalPrincipalRepayments + loanMetrics.TotalLatePenalties, 2);
        decimal cashInBank = Math.Round(
            commonShareCapital + totalLoanReceipts + netBankInterest - loanMetrics.TotalLoanDisbursements,
            2);
        decimal accountsReceivable = loanMetrics.RemainingPrincipalReceivable;
        decimal totalAssets = Math.Round(cashInBank + accountsReceivable, 2);

        // 5. Total Distributable Interest = Loan Upfront Interest + Total Late Penalties (All Loans & Schedules) + Net Bank Interest
        decimal totalDistributableInterest = Math.Round(
            loanMetrics.LoanInterestIncome + loanMetrics.TotalLatePenalties + netBankInterest,
            2);

        // Resolve effective statutory distribution weights for the current active fiscal year
        var policyOverview = await _financialPolicyService.GetPolicyOverviewAsync(cancellationToken);
        var weights = policyOverview.CurrentYearDistributionWeights;
        decimal divWeight = weights.DividendWeightPercent;
        decimal patWeight = weights.PatronageWeightPercent;
        decimal mgmtWeight = weights.ManagementWeightPercent;

        // 6. Liabilities = Salaries & Honoraria Payable (Management Pool, default 5% of Total Distributable Interest)
        decimal salariesHonorariaPayable = Math.Round(totalDistributableInterest * (mgmtWeight / 100m), 2);
        decimal totalLiabilities = salariesHonorariaPayable;

        // 7. Member Equity & Capital = Common Share Capital + Net Retained Surplus (Dividend + Patronage Pools, default 95%)
        decimal netRetainedSurplus = Math.Round(totalDistributableInterest - salariesHonorariaPayable, 2);
        decimal dividendPool = Math.Round(totalDistributableInterest * (divWeight / 100m), 2);
        decimal patronagePool = Math.Round(netRetainedSurplus - dividendPool, 2);

        decimal totalEquity = Math.Round(commonShareCapital + netRetainedSurplus, 2);
        decimal totalLiabilitiesAndEquity = Math.Round(totalLiabilities + totalEquity, 2);

        // Keep any unfinalized SurplusDistribution record in sync with the live ledger
        var latestSurplus = await _context.SurplusDistributions
            .OrderByDescending(s => s.FiscalYear)
            .FirstOrDefaultAsync(cancellationToken);
        if (latestSurplus != null && !latestSurplus.IsFinalized)
        {
            if (latestSurplus.TotalInterestIncome != totalDistributableInterest ||
                latestSurplus.DividendPool != dividendPool ||
                latestSurplus.PatronagePool != patronagePool ||
                latestSurplus.ManagementPool != salariesHonorariaPayable)
            {
                latestSurplus.TotalInterestIncome = totalDistributableInterest;
                latestSurplus.DividendPool = dividendPool;
                latestSurplus.PatronagePool = patronagePool;
                latestSurplus.ManagementPool = salariesHonorariaPayable;
                await _context.SaveChangesAsync(cancellationToken);
            }
        }

        return new BalanceSheetDto(
            DateTime.UtcNow,
            cashInBank,
            accountsReceivable,
            totalAssets,
            salariesHonorariaPayable,
            totalLiabilities,
            commonShareCapital,
            netRetainedSurplus,
            totalEquity,
            totalLiabilitiesAndEquity,
            totalDistributableInterest,
            loanMetrics.ActiveLoansCount,
            loanMetrics.TotalLatePenalties,
            loanMetrics.TotalLatePenaltiesPaid,
            loanMetrics.TotalAccruedLatePenalties,
            loanMetrics.RemainingPrincipalReceivable,
            loanMetrics.LoanInterestIncome,
            netBankInterest,
            dividendPool,
            patronagePool,
            divWeight,
            patWeight,
            mgmtWeight,
            statementCashInBank
        );
    }

    public async Task<FundReconciliationDto> GetFundReconciliationAsync(CancellationToken cancellationToken = default)
    {
        // Formula:
        // Book Balance = Total Contributions + Total Loan Receipts (Principal Repayments + Late Penalties across all loans & schedules) + Net Bank Interest - Total Loan Disbursements
        // Variance = Book Balance - Actual Cash in Bank

        var loanMetrics = await EvaluateAllLoansAndSchedulesAsync(cancellationToken);

        decimal totalContributions = Math.Round(
            await _context.Contributions
                .AsNoTracking()
                .SumAsync(c => (decimal?)c.Amount, cancellationToken) ?? 0.00m,
            2);

        decimal totalPrincipalRepayments = loanMetrics.TotalPrincipalRepayments;
        decimal totalLatePenalties = loanMetrics.TotalLatePenalties;
        decimal totalLoanReceipts = Math.Round(totalPrincipalRepayments + totalLatePenalties, 2);

        decimal netBankInterest = Math.Round(
            await _context.BankReconciliations
                .AsNoTracking()
                .SumAsync(b => (decimal?)b.NetBankInterest, cancellationToken) ?? 0.00m,
            2);

        decimal totalLoanDisbursements = loanMetrics.TotalLoanDisbursements;

        decimal bookBalance = Math.Round(
            totalContributions + totalLoanReceipts + netBankInterest - totalLoanDisbursements,
            2);

        var latestRecon = await _context.BankReconciliations
            .AsNoTracking()
            .OrderByDescending(b => b.StatementDate)
            .ThenByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        decimal cashInBank = latestRecon?.CashInBank ?? 0.00m;
        decimal variance = Math.Round(bookBalance - cashInBank, 2);
        bool isReconciled = Math.Abs(variance) < 0.01m;

        return new FundReconciliationDto(
            DateTime.UtcNow,
            totalContributions,
            totalLoanReceipts,
            netBankInterest,
            totalLoanDisbursements,
            bookBalance,
            cashInBank,
            variance,
            isReconciled,
            latestRecon?.StatementDate,
            totalLatePenalties,
            totalPrincipalRepayments,
            loanMetrics.TotalLatePenaltiesPaid,
            loanMetrics.TotalAccruedLatePenalties
        );
    }

    public async Task<BankReconciliationDto> CreateBankReconciliationAsync(
        CreateBankReconRequest request,
        CancellationToken cancellationToken = default)
    {
        if (request.CashInBank < 0)
        {
            throw new ValidationException("Cash in Bank cannot be negative.");
        }

        if (request.BankGrossInterest < 0)
        {
            throw new ValidationException("Bank gross interest cannot be negative.");
        }

        string? cutoffLabel = null;
        if (request.CutoffId.HasValue)
        {
            var cutoff = await _context.CutoffPeriods
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == request.CutoffId.Value, cancellationToken);
            if (cutoff == null)
            {
                throw new NotFoundException("Selected cutoff period was not found.");
            }

            bool alreadyReconciled = await _context.BankReconciliations
                .AsNoTracking()
                .AnyAsync(b => b.CutoffId == request.CutoffId.Value, cancellationToken);
            if (alreadyReconciled)
            {
                throw new ValidationException(
                    $"Cutoff period '{cutoff.Label} ({cutoff.FiscalYear})' has already been reconciled. Please select an unreconciled cutoff period.");
            }

            cutoffLabel = cutoff.Label;
        }

        decimal grossInterest = Math.Round(request.BankGrossInterest, 2);
        decimal cashInBankRounded = Math.Round(request.CashInBank, 2);

        // Auto-calculate withholding tax if not explicitly provided (standard 20%)
        decimal withholdingTax = request.WithholdingTax.HasValue && request.WithholdingTax.Value >= 0
            ? Math.Round(request.WithholdingTax.Value, 2)
            : Math.Round(grossInterest * 0.20m, 2);

        if (withholdingTax > grossInterest)
        {
            throw new ValidationException("Withholding tax cannot exceed bank gross interest.");
        }

        decimal netBankInterest = Math.Round(grossInterest - withholdingTax, 2);

        var loanMetrics = await EvaluateAllLoansAndSchedulesAsync(cancellationToken);

        // Calculate variance against current book balance with this interest incorporated
        decimal totalContributions = Math.Round(
            await _context.Contributions
                .AsNoTracking()
                .SumAsync(c => (decimal?)c.Amount, cancellationToken) ?? 0.00m,
            2);

        decimal totalLoanReceipts = Math.Round(loanMetrics.TotalPrincipalRepayments + loanMetrics.TotalLatePenalties, 2);

        decimal currentNetBankInterest = Math.Round(
            await _context.BankReconciliations
                .AsNoTracking()
                .SumAsync(b => (decimal?)b.NetBankInterest, cancellationToken) ?? 0.00m,
            2);

        decimal totalLoanDisbursements = loanMetrics.TotalLoanDisbursements;

        decimal projectedBookBalance = Math.Round(
            totalContributions + totalLoanReceipts + currentNetBankInterest + netBankInterest - totalLoanDisbursements,
            2);
        decimal variance = Math.Round(projectedBookBalance - cashInBankRounded, 2);

        var entity = new BankReconciliation
        {
            Id = Guid.NewGuid(),
            CutoffId = request.CutoffId,
            StatementDate = DateTime.SpecifyKind(request.StatementDate, DateTimeKind.Utc),
            CashInBank = cashInBankRounded,
            BankGrossInterest = grossInterest,
            WithholdingTax = withholdingTax,
            NetBankInterest = netBankInterest,
            ReconciledVariance = variance,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow
        };

        _context.BankReconciliations.Add(entity);
        await _context.SaveChangesAsync(cancellationToken);

        return new BankReconciliationDto(
            entity.Id,
            entity.CutoffId,
            cutoffLabel,
            entity.StatementDate,
            entity.CashInBank,
            entity.BankGrossInterest,
            entity.WithholdingTax,
            entity.NetBankInterest,
            entity.ReconciledVariance,
            entity.Notes,
            entity.CreatedAt
        );
    }

    public async Task<IEnumerable<BankReconciliationDto>> GetReconciliationsAsync(CancellationToken cancellationToken = default)
    {
        var records = await _context.BankReconciliations
            .AsNoTracking()
            .Include(b => b.CutoffPeriod)
            .OrderByDescending(b => b.StatementDate)
            .ThenByDescending(b => b.CreatedAt)
            .Select(b => new BankReconciliationDto(
                b.Id,
                b.CutoffId,
                b.CutoffPeriod != null ? b.CutoffPeriod.Label : null,
                b.StatementDate,
                b.CashInBank,
                b.BankGrossInterest,
                b.WithholdingTax,
                b.NetBankInterest,
                b.ReconciledVariance,
                b.Notes,
                b.CreatedAt
            ))
            .ToListAsync(cancellationToken);

        return records;
    }
}
