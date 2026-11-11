using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using CoopIS.Domain.Entities;
using CoopIS.Domain.Enums;
using CoopIS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CoopIS.Infrastructure.Services;

public class BankAccountService : IBankAccountService
{
    private readonly AppDbContext _context;
    private readonly ILogger<BankAccountService> _logger;

    public const decimal DefaultReserveCushionPercent = 20.00m;

    public BankAccountService(AppDbContext context, ILogger<BankAccountService> logger)
    {
        _context = context;
        _logger = logger;
    }

    public async Task<List<BankAccountDto>> GetAllAccountsAsync(CancellationToken cancellationToken = default)
    {
        var accounts = await _context.BankAccounts
            .OrderByDescending(b => b.IsPrimary)
            .ThenBy(b => b.BankName)
            .ToListAsync(cancellationToken);

        return accounts.Select(MapToDto).ToList();
    }

    public async Task<BankAccountDto?> GetAccountByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var account = await _context.BankAccounts.FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
        return account != null ? MapToDto(account) : null;
    }

    public async Task<BankAccountDto> CreateAccountAsync(CreateBankAccountRequest request, CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.BankName))
            throw new ArgumentException("Bank name is required.");
        if (string.IsNullOrWhiteSpace(request.AccountNumber))
            throw new ArgumentException("Account number is required.");

        if (request.IsPrimary)
        {
            var existingPrimaries = await _context.BankAccounts
                .Where(b => b.IsPrimary)
                .ToListAsync(cancellationToken);

            foreach (var p in existingPrimaries)
            {
                p.IsPrimary = false;
                p.UpdatedAt = DateTime.UtcNow;
            }
        }

        var newAccount = new BankAccount
        {
            BankName = request.BankName.Trim(),
            AccountNumber = request.AccountNumber.Trim(),
            AccountName = string.IsNullOrWhiteSpace(request.AccountName) ? request.BankName.Trim() : request.AccountName.Trim(),
            CurrentBalance = Math.Round(request.InitialBalance, 2),
            IsPrimary = request.IsPrimary,
            LastReconciledAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.BankAccounts.Add(newAccount);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Registered new BankAccount '{BankName}' ({AccountNumber}) with balance ₱{Balance:N2}.",
            newAccount.BankName, newAccount.AccountNumber, newAccount.CurrentBalance);

        return MapToDto(newAccount);
    }

    public async Task<BankAccountDto> AdjustBalanceAsync(Guid id, AdjustBankBalanceRequest request, string adjustedBy, CancellationToken cancellationToken = default)
    {
        var account = await _context.BankAccounts.FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
        if (account == null)
            throw new KeyNotFoundException($"Bank account with ID '{id}' was not found.");

        decimal oldBalance = account.CurrentBalance;
        account.CurrentBalance = Math.Round(request.NewBalance, 2);
        account.UpdatedAt = DateTime.UtcNow;

        if (request.MarkReconciled)
        {
            account.LastReconciledAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Bank account '{BankName}' ({AccountNumber}) balance adjusted from ₱{OldBalance:N2} to ₱{NewBalance:N2} by user '{AdjustedBy}'. Reason: {Reason}",
            account.BankName, account.AccountNumber, oldBalance, account.CurrentBalance, adjustedBy, request.Reason ?? "Manual Balance Reconcile");

        return MapToDto(account);
    }

    public async Task<bool> DeleteAccountAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var account = await _context.BankAccounts.FirstOrDefaultAsync(b => b.Id == id, cancellationToken);
        if (account == null) return false;

        _context.BankAccounts.Remove(account);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Bank account '{BankName}' ({AccountNumber}) deleted.", account.BankName, account.AccountNumber);
        return true;
    }

    public async Task<decimal> GetTotalAvailableLiquidCashAsync(CancellationToken cancellationToken = default)
    {
        var primaryTotal = await _context.BankAccounts
            .Where(b => b.IsPrimary)
            .SumAsync(b => b.CurrentBalance, cancellationToken);

        if (primaryTotal <= 0)
        {
            primaryTotal = await _context.BankAccounts.SumAsync(b => b.CurrentBalance, cancellationToken);
        }

        decimal cushionPercent = DefaultReserveCushionPercent;
        decimal reserveCushion = Math.Round(primaryTotal * (cushionPercent / 100m), 2);
        decimal available = Math.Max(0m, primaryTotal - reserveCushion);

        return available;
    }

    public async Task<LiquiditySummaryDto> GetLiquiditySummaryAsync(CancellationToken cancellationToken = default)
    {
        var allAccounts = await _context.BankAccounts.ToListAsync(cancellationToken);
        decimal totalBankBalance = allAccounts.Sum(b => b.CurrentBalance);

        var primaryAccount = allAccounts.FirstOrDefault(b => b.IsPrimary) ?? allAccounts.FirstOrDefault();
        decimal primaryBankBalance = primaryAccount?.CurrentBalance ?? 0.00m;

        decimal cushionPercent = DefaultReserveCushionPercent;
        decimal reserveCushionAmount = Math.Round(primaryBankBalance * (cushionPercent / 100m), 2);
        decimal availableLiquidCash = Math.Max(0m, primaryBankBalance - reserveCushionAmount);

        // Sum of all active demands currently in queue
        decimal queuedLoanDemands = await _context.LoanQueueEntries
            .Where(q => q.Status == LoanQueueStatus.Queued ||
                        q.Status == LoanQueueStatus.UnderReview ||
                        q.Status == LoanQueueStatus.ReadyForFunding)
            .SumAsync(q => q.DesiredPrincipal, cancellationToken);

        decimal netUnallocatedCash = Math.Max(0m, availableLiquidCash - queuedLoanDemands);

        return new LiquiditySummaryDto(
            TotalBankBalance: totalBankBalance,
            PrimaryBankBalance: primaryBankBalance,
            ReserveCushionPercent: cushionPercent,
            ReserveCushionAmount: reserveCushionAmount,
            AvailableLiquidCash: availableLiquidCash,
            QueuedLoanDemands: queuedLoanDemands,
            NetUnallocatedCash: netUnallocatedCash,
            ActiveBankAccountsCount: allAccounts.Count,
            PrimaryBankName: primaryAccount?.BankName,
            PrimaryAccountNumber: primaryAccount?.AccountNumber
        );
    }

    private static BankAccountDto MapToDto(BankAccount account) => new(
        account.Id,
        account.BankName,
        account.AccountNumber,
        account.AccountName,
        account.CurrentBalance,
        account.IsPrimary,
        account.LastReconciledAt,
        account.CreatedAt,
        account.UpdatedAt
    );
}

