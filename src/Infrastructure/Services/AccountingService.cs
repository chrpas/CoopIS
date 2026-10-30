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

    public AccountingService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<BalanceSheetDto> GetBalanceSheetAsync(CancellationToken cancellationToken = default)
    {
        // 1. Cash In Bank: Latest reconciled bank statement
        var latestRecon = await _context.BankReconciliations
            .AsNoTracking()
            .OrderByDescending(b => b.StatementDate)
            .ThenByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        decimal cashInBank = latestRecon?.CashInBank ?? 0.00m;

        // 2. Accounts Receivable: Sum of remaining balances across all active loans
        var activeLoans = await _context.Loans
            .AsNoTracking()
            .Include(l => l.Repayments)
            .Where(l => l.Status == LoanStatus.ACTIVE)
            .ToListAsync(cancellationToken);

        decimal accountsReceivable = activeLoans.Sum(l =>
            Math.Max(0m, l.PrincipalAmount - l.Repayments.Sum(r => r.PrincipalPaid)));

        // 3. Total Assets = Cash in Bank + Accounts Receivable
        decimal totalAssets = cashInBank + accountsReceivable;

        // 4. Distributable Interest
        // 4. Distributable Interest & Penalty Revenue
        var latestSurplus = await _context.SurplusDistributions
            .AsNoTracking()
            .OrderByDescending(s => s.FiscalYear)
            .FirstOrDefaultAsync(cancellationToken);

        decimal totalLatePenalties = await _context.LoanRepayments
            .AsNoTracking()
            .SumAsync(r => (decimal?)r.LatePenaltyPaid, cancellationToken) ?? 0.00m;

        decimal totalDistributableInterest = latestSurplus?.TotalInterestIncome ?? 0m;
        if (totalDistributableInterest == 0)
        {
            var loanInterest = await _context.Loans
                .AsNoTracking()
                .Where(l => l.Status == LoanStatus.ACTIVE || l.Status == LoanStatus.PAID)
                .SumAsync(l => (decimal?)l.InterestEarned, cancellationToken) ?? 0m;

            var netBankInt = await _context.BankReconciliations
                .AsNoTracking()
                .SumAsync(b => (decimal?)b.NetBankInterest, cancellationToken) ?? 0m;

            totalDistributableInterest = loanInterest + netBankInt + totalLatePenalties;
        }

        // 5. Total Liabilities = Salaries / Honoraria Payable (5% of Total Distributable Interest)
        decimal salariesHonorariaPayable = Math.Round(totalDistributableInterest * 0.05m, 2);
        decimal totalLiabilities = salariesHonorariaPayable;

        // 6. Common Share Capital = sum of all member contributions
        decimal commonShareCapital = await _context.Contributions
            .AsNoTracking()
            .SumAsync(c => (decimal?)c.Amount, cancellationToken) ?? 0.00m;

        // 7. Net Retained Surplus = 95% of Net Distributable Interest
        decimal netRetainedSurplus = Math.Round(totalDistributableInterest * 0.95m, 2);

        // 8. Total Equity = Common Share Capital + Net Retained Surplus
        decimal totalEquity = commonShareCapital + netRetainedSurplus;

        // 9. Total Liabilities & Equity = Total Liabilities + Common Share Capital + Net Retained Surplus
        decimal totalLiabilitiesAndEquity = totalLiabilities + commonShareCapital + netRetainedSurplus;

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
            activeLoans.Count,
            totalLatePenalties
        );
    }

    public async Task<FundReconciliationDto> GetFundReconciliationAsync(CancellationToken cancellationToken = default)
    {
        // Formula:
        // Book Balance = Total Contributions + Total Loan Receipts (Principal Repayments + Late Penalties) + Net Bank Interest - Total Loan Disbursements
        // Variance = Book Balance - Cash in Bank

        decimal totalContributions = await _context.Contributions
            .AsNoTracking()
            .SumAsync(c => (decimal?)c.Amount, cancellationToken) ?? 0.00m;

        decimal totalPrincipalRepayments = await _context.LoanRepayments
            .AsNoTracking()
            .SumAsync(r => (decimal?)r.PrincipalPaid, cancellationToken) ?? 0.00m;

        decimal totalLatePenalties = await _context.LoanRepayments
            .AsNoTracking()
            .SumAsync(r => (decimal?)r.LatePenaltyPaid, cancellationToken) ?? 0.00m;

        decimal totalLoanReceipts = totalPrincipalRepayments + totalLatePenalties;

        decimal netBankInterest = await _context.BankReconciliations
            .AsNoTracking()
            .SumAsync(b => (decimal?)b.NetBankInterest, cancellationToken) ?? 0.00m;

        decimal totalLoanDisbursements = await _context.Loans
            .AsNoTracking()
            .Where(l => l.Status == LoanStatus.ACTIVE || l.Status == LoanStatus.PAID)
            .SumAsync(l => (decimal?)(l.ReleasedAmount > 0 ? l.ReleasedAmount : l.PrincipalAmount), cancellationToken) ?? 0.00m;

        decimal bookBalance = totalContributions + totalLoanReceipts + netBankInterest - totalLoanDisbursements;

        var latestRecon = await _context.BankReconciliations
            .AsNoTracking()
            .OrderByDescending(b => b.StatementDate)
            .ThenByDescending(b => b.CreatedAt)
            .FirstOrDefaultAsync(cancellationToken);

        decimal cashInBank = latestRecon?.CashInBank ?? 0.00m;
        decimal variance = bookBalance - cashInBank;
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
            totalPrincipalRepayments
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

        // Auto-calculate withholding tax if not explicitly provided (standard 20%)
        decimal withholdingTax = request.WithholdingTax.HasValue && request.WithholdingTax.Value >= 0
            ? request.WithholdingTax.Value
            : Math.Round(request.BankGrossInterest * 0.20m, 2);

        decimal netBankInterest = request.BankGrossInterest - withholdingTax;

        // Calculate variance against current book balance with this interest incorporated
        decimal totalContributions = await _context.Contributions
            .AsNoTracking()
            .SumAsync(c => (decimal?)c.Amount, cancellationToken) ?? 0.00m;

        decimal totalLoanReceipts = await _context.LoanRepayments
            .AsNoTracking()
            .SumAsync(r => (decimal?)(r.PrincipalPaid + r.LatePenaltyPaid), cancellationToken) ?? 0.00m;

        decimal currentNetBankInterest = await _context.BankReconciliations
            .AsNoTracking()
            .SumAsync(b => (decimal?)b.NetBankInterest, cancellationToken) ?? 0.00m;

        decimal totalLoanDisbursements = await _context.Loans
            .AsNoTracking()
            .Where(l => l.Status == LoanStatus.ACTIVE || l.Status == LoanStatus.PAID)
            .SumAsync(l => (decimal?)(l.ReleasedAmount > 0 ? l.ReleasedAmount : l.PrincipalAmount), cancellationToken) ?? 0.00m;

        decimal projectedBookBalance = totalContributions + totalLoanReceipts + currentNetBankInterest + netBankInterest - totalLoanDisbursements;
        decimal variance = projectedBookBalance - request.CashInBank;

        var entity = new BankReconciliation
        {
            Id = Guid.NewGuid(),
            CutoffId = request.CutoffId,
            StatementDate = DateTime.SpecifyKind(request.StatementDate, DateTimeKind.Utc),
            CashInBank = request.CashInBank,
            BankGrossInterest = request.BankGrossInterest,
            WithholdingTax = withholdingTax,
            NetBankInterest = netBankInterest,
            ReconciledVariance = variance,
            Notes = request.Notes,
            CreatedAt = DateTime.UtcNow
        };

        _context.BankReconciliations.Add(entity);
        await _context.SaveChangesAsync(cancellationToken);

        string? cutoffLabel = null;
        if (entity.CutoffId.HasValue)
        {
            var cutoff = await _context.CutoffPeriods
                .AsNoTracking()
                .FirstOrDefaultAsync(c => c.Id == entity.CutoffId.Value, cancellationToken);
            cutoffLabel = cutoff?.Label;
        }

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
