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

public class LoanQueueService : ILoanQueueService
{
    private readonly AppDbContext _context;
    private readonly IBankAccountService _bankAccountService;
    private readonly IFinancialPolicyService _financialPolicyService;
    private readonly ILogger<LoanQueueService> _logger;

    public LoanQueueService(
        AppDbContext context,
        IBankAccountService bankAccountService,
        IFinancialPolicyService financialPolicyService,
        ILogger<LoanQueueService> logger)
    {
        _context = context;
        _bankAccountService = bankAccountService;
        _financialPolicyService = financialPolicyService;
        _logger = logger;
    }

    public static (int TermMonths, int CutoffsCount) CalculateTier(decimal principal)
    {
        if (principal <= 5000m)
            return (2, 4);
        if (principal <= 15000m)
            return (3, 6);
        if (principal <= 25000m)
            return (4, 8);
        if (principal <= 35000m)
            return (5, 10);
        if (principal <= 50000m)
            return (6, 12);
        if (principal <= 70000m)
            return (7, 14);
        return (8, 16);
    }

    public async Task<LoanQueueEntryDto> ApplyAsync(Guid memberId, ApplyLoanQueueRequest request, CancellationToken cancellationToken = default)
    {
        var targetMemberId = request.MemberId.HasValue && request.MemberId.Value != Guid.Empty
            ? request.MemberId.Value
            : memberId;

        var member = await _context.Members.FirstOrDefaultAsync(m => m.Id == targetMemberId, cancellationToken);
        if (member == null)
            throw new KeyNotFoundException($"Member with ID '{targetMemberId}' does not exist.");

        if (member.Status != MemberStatus.ACTIVE)
            throw new InvalidOperationException($"Cannot apply for loan. Member status is {member.Status}; must be ACTIVE.");

        decimal principal = Math.Round(request.DesiredPrincipal, 2);
        if (principal < 1000m)
            throw new ArgumentException("Desired principal must be at least ₱1,000.");
        if (principal > 80000m)
            throw new ArgumentException("Desired principal exceeds the cooperative limit of ₱80,000.");

        // Check if member already has an active queue entry waiting in line
        var existingActive = await _context.LoanQueueEntries
            .FirstOrDefaultAsync(q => q.MemberId == targetMemberId &&
                (q.Status == LoanQueueStatus.Queued || q.Status == LoanQueueStatus.UnderReview || q.Status == LoanQueueStatus.ReadyForFunding),
                cancellationToken);

        if (existingActive != null)
        {
            throw new InvalidOperationException($"Member already has an active application in the queue (Queue #{existingActive.QueueNumber} - {existingActive.Status}).");
        }

        var (termMonths, cutoffsCount) = CalculateTier(principal);
        decimal estimatedCutoffPayment = Math.Round(principal / cutoffsCount, 2);

        int nextQueueNumber = (await _context.LoanQueueEntries
            .MaxAsync(q => (int?)q.QueueNumber, cancellationToken) ?? 0) + 1;

        var entry = new LoanQueueEntry
        {
            QueueNumber = nextQueueNumber,
            MemberId = targetMemberId,
            DesiredPrincipal = principal,
            TermMonths = termMonths,
            CutoffsCount = cutoffsCount,
            EstimatedCutoffPayment = estimatedCutoffPayment,
            Purpose = string.IsNullOrWhiteSpace(request.Purpose) ? "Personal / Emergency Loan" : request.Purpose.Trim(),
            Status = LoanQueueStatus.Queued,
            RequestedAt = DateTime.UtcNow,
            CoMakerMemberId = request.CoMakerMemberId
        };

        _context.LoanQueueEntries.Add(entry);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("Member '{MemberCode}' applied for Loan Queue #{QueueNumber} (Principal: ₱{Principal:N2}, Term: {Term}mo).",
            member.MemberCode, entry.QueueNumber, entry.DesiredPrincipal, entry.TermMonths);

        int position = await _context.LoanQueueEntries
            .CountAsync(q => (q.Status == LoanQueueStatus.Queued || q.Status == LoanQueueStatus.UnderReview || q.Status == LoanQueueStatus.ReadyForFunding) &&
                             q.QueueNumber <= entry.QueueNumber, cancellationToken);

        decimal availableCash = await _bankAccountService.GetTotalAvailableLiquidCashAsync(cancellationToken);

        return new LoanQueueEntryDto(
            entry.Id,
            entry.QueueNumber,
            entry.MemberId,
            $"{member.FirstName} {member.LastName}",
            member.MemberCode,
            entry.DesiredPrincipal,
            entry.TermMonths,
            entry.CutoffsCount,
            entry.EstimatedCutoffPayment,
            entry.Purpose,
            entry.Status,
            entry.RequestedAt,
            entry.ReadyAt,
            entry.CoMakerMemberId,
            null,
            null,
            null,
            null,
            entry.AdminNotes,
            position,
            entry.DesiredPrincipal <= availableCash
        );
    }

    public async Task<List<LoanQueueEntryDto>> GetQueueAsync(CancellationToken cancellationToken = default)
    {
        var entries = await _context.LoanQueueEntries
            .Include(q => q.Member)
            .Include(q => q.CoMakerMember)
            .Include(q => q.DisbursedLoan)
            .OrderBy(q => q.QueueNumber)
            .ToListAsync(cancellationToken);

        decimal availableCash = await _bankAccountService.GetTotalAvailableLiquidCashAsync(cancellationToken);
        decimal runningAllocated = 0m;

        var result = new List<LoanQueueEntryDto>(entries.Count);
        int activeCounter = 0;

        foreach (var entry in entries)
        {
            int position = 0;
            bool canBeFunded = false;

            if (entry.Status == LoanQueueStatus.Queued ||
                entry.Status == LoanQueueStatus.UnderReview ||
                entry.Status == LoanQueueStatus.ReadyForFunding)
            {
                activeCounter++;
                position = activeCounter;
                runningAllocated += entry.DesiredPrincipal;
                canBeFunded = runningAllocated <= availableCash;
            }

            result.Add(new LoanQueueEntryDto(
                entry.Id,
                entry.QueueNumber,
                entry.MemberId,
                $"{entry.Member.FirstName} {entry.Member.LastName}",
                entry.Member.MemberCode,
                entry.DesiredPrincipal,
                entry.TermMonths,
                entry.CutoffsCount,
                entry.EstimatedCutoffPayment,
                entry.Purpose,
                entry.Status,
                entry.RequestedAt,
                entry.ReadyAt,
                entry.CoMakerMemberId,
                entry.CoMakerMember != null ? $"{entry.CoMakerMember.FirstName} {entry.CoMakerMember.LastName}" : null,
                entry.DisbursedLoanId,
                entry.DisbursedLoan?.LoanReference,
                entry.DisbursedAt,
                entry.AdminNotes,
                position,
                canBeFunded
            ));
        }

        return result;
    }

    public async Task<MyQueueStatusDto> GetMyQueueStatusAsync(Guid memberId, CancellationToken cancellationToken = default)
    {
        var activeEntry = await _context.LoanQueueEntries
            .Include(q => q.Member)
            .Include(q => q.CoMakerMember)
            .FirstOrDefaultAsync(q => q.MemberId == memberId &&
                (q.Status == LoanQueueStatus.Queued || q.Status == LoanQueueStatus.UnderReview || q.Status == LoanQueueStatus.ReadyForFunding),
                cancellationToken);

        decimal availableCash = await _bankAccountService.GetTotalAvailableLiquidCashAsync(cancellationToken);

        if (activeEntry == null)
        {
            return new MyQueueStatusDto(
                ActiveEntry: null,
                QueuePosition: 0,
                TotalActiveInQueue: await _context.LoanQueueEntries.CountAsync(q =>
                    q.Status == LoanQueueStatus.Queued || q.Status == LoanQueueStatus.UnderReview || q.Status == LoanQueueStatus.ReadyForFunding, cancellationToken),
                EstimatedLiquidReserve: availableCash,
                EstimatedFundingCutoff: null,
                HasActiveEntry: false
            );
        }

        int position = await _context.LoanQueueEntries
            .CountAsync(q => (q.Status == LoanQueueStatus.Queued || q.Status == LoanQueueStatus.UnderReview || q.Status == LoanQueueStatus.ReadyForFunding) &&
                             q.QueueNumber <= activeEntry.QueueNumber, cancellationToken);

        int totalActive = await _context.LoanQueueEntries
            .CountAsync(q => q.Status == LoanQueueStatus.Queued || q.Status == LoanQueueStatus.UnderReview || q.Status == LoanQueueStatus.ReadyForFunding, cancellationToken);

        // Find next future open cutoff for estimated timeline
        var nextCutoff = await _context.CutoffPeriods
            .Where(c => c.CutoffDate >= DateTime.UtcNow && !c.IsClosed)
            .OrderBy(c => c.CutoffDate)
            .FirstOrDefaultAsync(cancellationToken);

        string? estimatedCutoff = nextCutoff != null
            ? $"{nextCutoff.Label} ({nextCutoff.CutoffDate:MMM dd, yyyy})"
            : "Next Scheduled Cutoff";

        var dto = new LoanQueueEntryDto(
            activeEntry.Id,
            activeEntry.QueueNumber,
            activeEntry.MemberId,
            $"{activeEntry.Member.FirstName} {activeEntry.Member.LastName}",
            activeEntry.Member.MemberCode,
            activeEntry.DesiredPrincipal,
            activeEntry.TermMonths,
            activeEntry.CutoffsCount,
            activeEntry.EstimatedCutoffPayment,
            activeEntry.Purpose,
            activeEntry.Status,
            activeEntry.RequestedAt,
            activeEntry.ReadyAt,
            activeEntry.CoMakerMemberId,
            activeEntry.CoMakerMember != null ? $"{activeEntry.CoMakerMember.FirstName} {activeEntry.CoMakerMember.LastName}" : null,
            null,
            null,
            null,
            activeEntry.AdminNotes,
            position,
            activeEntry.DesiredPrincipal <= availableCash
        );

        return new MyQueueStatusDto(
            ActiveEntry: dto,
            QueuePosition: position,
            TotalActiveInQueue: totalActive,
            EstimatedLiquidReserve: availableCash,
            EstimatedFundingCutoff: estimatedCutoff,
            HasActiveEntry: true
        );
    }

    public async Task<LoanResponseDto> DisburseQueueEntryAsync(
        Guid queueId,
        Guid? adminMemberId = null,
        Guid? selectedBankAccountId = null,
        CancellationToken cancellationToken = default)
    {
        var entry = await _context.LoanQueueEntries
            .Include(q => q.Member)
            .FirstOrDefaultAsync(q => q.Id == queueId, cancellationToken);

        if (entry == null)
            throw new KeyNotFoundException($"Loan queue entry with ID '{queueId}' not found.");

        if (entry.Status == LoanQueueStatus.Disbursed)
            throw new InvalidOperationException($"Queue entry #{entry.QueueNumber} is already disbursed.");
        if (entry.Status == LoanQueueStatus.Cancelled || entry.Status == LoanQueueStatus.Rejected)
            throw new InvalidOperationException($"Cannot disburse an application with status '{entry.Status}'.");

        // 1. Verify liquidity against bank reserve cushion
        decimal availableLiquidCash = await _bankAccountService.GetTotalAvailableLiquidCashAsync(cancellationToken);
        if (availableLiquidCash < entry.DesiredPrincipal)
        {
            throw new InvalidOperationException(
                $"Cannot disburse: Requested principal ₱{entry.DesiredPrincipal:N2} exceeds available unallocated liquid bank reserves (Available: ₱{availableLiquidCash:N2}). A 20% liquid reserve cushion is strictly safeguarded.");
        }

        // 2. Select Bank Account for fund disbursement
        BankAccount? bankAccount = null;
        if (selectedBankAccountId.HasValue && selectedBankAccountId.Value != Guid.Empty)
        {
            bankAccount = await _context.BankAccounts.FirstOrDefaultAsync(b => b.Id == selectedBankAccountId.Value, cancellationToken);
        }
        if (bankAccount == null)
        {
            bankAccount = await _context.BankAccounts.FirstOrDefaultAsync(b => b.IsPrimary, cancellationToken)
                ?? await _context.BankAccounts.FirstOrDefaultAsync(cancellationToken);
        }

        if (bankAccount == null)
        {
            throw new InvalidOperationException("No registered bank account found to disburse funds from.");
        }

        if (bankAccount.CurrentBalance < entry.DesiredPrincipal)
        {
            throw new InvalidOperationException(
                $"Bank account '{bankAccount.BankName}' balance (₱{bankAccount.CurrentBalance:N2}) is insufficient to disburse ₱{entry.DesiredPrincipal:N2}.");
        }

        // 3. Financial calculations: 5% upfront interest deduction, bi-monthly schedule
        var activePolicy = await _financialPolicyService.GetEffectiveLoanPolicyAsync(DateTime.UtcNow, cancellationToken);
        decimal interestRate = Math.Round(activePolicy.StandardLoanInterestRatePercent / 100m, 4);
        decimal principal = entry.DesiredPrincipal;
        decimal interestEarned = Math.Round(principal * interestRate, 2);
        decimal releasedAmount = Math.Round(principal - interestEarned, 2);
        decimal cutoffPaymentAmount = Math.Round(principal / entry.CutoffsCount, 2);

        var originationDate = DateTime.UtcNow;

        // Generate Loan Reference Code
        int existingLoanCount = await _context.Loans.CountAsync(cancellationToken);
        string loanReference = $"LN-{originationDate.Year}-{(existingLoanCount + 1):D3}";

        // Ensure unique reference
        int suffix = 1;
        while (await _context.Loans.AnyAsync(l => l.LoanReference == loanReference, cancellationToken))
        {
            loanReference = $"LN-{originationDate.Year}-{(existingLoanCount + 1 + suffix):D3}";
            suffix++;
        }

        // Verify approver member reference strictly (ApprovedBy has FK to Members table)
        Guid? validApproverId = null;
        if (adminMemberId.HasValue && adminMemberId.Value != Guid.Empty)
        {
            var approverExists = await _context.Members.AnyAsync(m => m.Id == adminMemberId.Value, cancellationToken);
            if (approverExists)
            {
                validApproverId = adminMemberId.Value;
            }
        }

        // Pre-fetch upcoming cutoffs before opening transaction to ensure fiscal years exist
        var futureCutoffs = await _context.CutoffPeriods
            .Where(c => c.CutoffDate >= originationDate.Date && !c.IsClosed)
            .OrderBy(c => c.CutoffDate)
            .Take(entry.CutoffsCount)
            .ToListAsync(cancellationToken);

        if (futureCutoffs.Count < entry.CutoffsCount)
        {
            await DbInitializer.EnsureFiscalYearCutoffsAsync(_context, originationDate.Year + 1, cancellationToken);
            futureCutoffs = await _context.CutoffPeriods
                .Where(c => c.CutoffDate >= originationDate.Date && !c.IsClosed)
                .OrderBy(c => c.CutoffDate)
                .Take(entry.CutoffsCount)
                .ToListAsync(cancellationToken);

            if (futureCutoffs.Count < entry.CutoffsCount)
            {
                await DbInitializer.EnsureFiscalYearCutoffsAsync(_context, originationDate.Year + 2, cancellationToken);
                futureCutoffs = await _context.CutoffPeriods
                    .Where(c => c.CutoffDate >= originationDate.Date && !c.IsClosed)
                    .OrderBy(c => c.CutoffDate)
                    .Take(entry.CutoffsCount)
                    .ToListAsync(cancellationToken);
            }
        }

        using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
        try
        {
            // A. Deduct principal from BankAccount
            decimal oldBankBal = bankAccount.CurrentBalance;
            bankAccount.CurrentBalance = Math.Round(bankAccount.CurrentBalance - principal, 2);
            bankAccount.UpdatedAt = DateTime.UtcNow;

            // B. Create formal Loan
            var loan = new Loan
            {
                LoanReference = loanReference,
                MemberId = entry.MemberId,
                OriginationDate = originationDate,
                PrincipalAmount = principal,
                InterestRate = interestRate,
                InterestEarned = interestEarned,
                ReleasedAmount = releasedAmount,
                TermMonths = entry.TermMonths,
                CutoffsCount = entry.CutoffsCount,
                CutoffPaymentAmount = cutoffPaymentAmount,
                Status = LoanStatus.ACTIVE,
                ApprovedBy = validApproverId,
                Notes = $"Originated via FIFO Queue #{entry.QueueNumber} from {bankAccount.BankName}. Purpose: {entry.Purpose}",
                CreatedAt = DateTime.UtcNow
            };

            _context.Loans.Add(loan);

            // C. Schedule expected amortization entries across consecutive upcoming cutoffs
            foreach (var cutoff in futureCutoffs)
            {
                loan.Repayments.Add(new LoanRepayment
                {
                    LoanId = loan.Id,
                    CutoffId = cutoff.Id,
                    PrincipalPaid = 0.00m,
                    LatePenaltyPaid = 0.00m,
                    RecordedAt = DateTime.UtcNow
                });
            }

            // D. Transition Queue Entry to Disbursed
            entry.Status = LoanQueueStatus.Disbursed;
            entry.DisbursedLoanId = loan.Id;
            entry.DisbursedAt = DateTime.UtcNow;
            entry.AdminNotes = (entry.AdminNotes ?? "") + $" | Disbursed as {loanReference} on {DateTime.UtcNow:yyyy-MM-dd}";

            await _context.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            _logger.LogInformation("Disbursed Queue #{QueueNumber} to Loan '{LoanRef}' for member '{MemberCode}'. Bank balance adjusted: ₱{OldBal:N2} -> ₱{NewBal:N2}.",
                entry.QueueNumber, loan.LoanReference, entry.Member.MemberCode, oldBankBal, bankAccount.CurrentBalance);

            return new LoanResponseDto(
                loan.Id,
                loan.LoanReference,
                loan.MemberId,
                $"{entry.Member.FirstName} {entry.Member.LastName}",
                loan.OriginationDate,
                loan.PrincipalAmount,
                loan.InterestRate,
                loan.InterestEarned,
                loan.ReleasedAmount,
                loan.TermMonths,
                loan.CutoffsCount,
                loan.CutoffPaymentAmount,
                loan.Status,
                loan.ApprovedBy,
                validApproverId.HasValue ? "Cooperative Approver" : "Cooperative Board Administrator",
                loan.Notes,
                loan.CreatedAt,
                0.00m,
                0.00m
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Transaction failed while disbursing Queue #{QueueNumber}: {Message}", entry.QueueNumber, ex.Message);
            await transaction.RollbackAsync(cancellationToken);
            throw;
        }
    }

    public async Task<LoanQueueEntryDto> UpdateStatusAsync(Guid queueId, UpdateQueueStatusRequest request, CancellationToken cancellationToken = default)
    {
        var entry = await _context.LoanQueueEntries
            .Include(q => q.Member)
            .Include(q => q.CoMakerMember)
            .FirstOrDefaultAsync(q => q.Id == queueId, cancellationToken);

        if (entry == null)
            throw new KeyNotFoundException($"Loan queue entry with ID '{queueId}' not found.");

        entry.Status = request.Status;
        if (!string.IsNullOrWhiteSpace(request.AdminNotes))
        {
            entry.AdminNotes = request.AdminNotes.Trim();
        }
        if (request.Status == LoanQueueStatus.ReadyForFunding && !entry.ReadyAt.HasValue)
        {
            entry.ReadyAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(cancellationToken);

        decimal availableCash = await _bankAccountService.GetTotalAvailableLiquidCashAsync(cancellationToken);

        int position = await _context.LoanQueueEntries
            .CountAsync(q => (q.Status == LoanQueueStatus.Queued || q.Status == LoanQueueStatus.UnderReview || q.Status == LoanQueueStatus.ReadyForFunding) &&
                             q.QueueNumber <= entry.QueueNumber, cancellationToken);

        return new LoanQueueEntryDto(
            entry.Id,
            entry.QueueNumber,
            entry.MemberId,
            $"{entry.Member.FirstName} {entry.Member.LastName}",
            entry.Member.MemberCode,
            entry.DesiredPrincipal,
            entry.TermMonths,
            entry.CutoffsCount,
            entry.EstimatedCutoffPayment,
            entry.Purpose,
            entry.Status,
            entry.RequestedAt,
            entry.ReadyAt,
            entry.CoMakerMemberId,
            entry.CoMakerMember != null ? $"{entry.CoMakerMember.FirstName} {entry.CoMakerMember.LastName}" : null,
            entry.DisbursedLoanId,
            null,
            entry.DisbursedAt,
            entry.AdminNotes,
            position,
            entry.DesiredPrincipal <= availableCash
        );
    }
}

