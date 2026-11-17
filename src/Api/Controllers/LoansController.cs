using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.Common;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using CoopIS.Domain.Entities;
using CoopIS.Domain.Enums;
using CoopIS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoopIS.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/loans")]
public class LoansController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly IFinancialPolicyService _financialPolicyService;
    private readonly IEmailService _emailService;

    public LoansController(
        AppDbContext context,
        IFinancialPolicyService financialPolicyService,
        IEmailService emailService)
    {
        _context = context;
        _financialPolicyService = financialPolicyService;
        _emailService = emailService;
    }

    private async Task<(decimal TotalPenalties, bool AllScheduleEntriesPaid, LoanStatus EffectiveStatus)> ComputeLoanScheduleMetricsAsync(Loan loan, List<CutoffPeriod> allCutoffs)
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
            scheduledCutoffs = scheduledCutoffs.OrderBy(c => c.CutoffDate).Take(loan.CutoffsCount).ToList();
        }

        var loanPolicy = await _financialPolicyService.GetEffectiveLoanPolicyAsync(loan.CreatedAt);
        int gracePeriodDays = loanPolicy.GracePeriodDays;
        decimal penaltyRate = Math.Round(loanPolicy.LatePenaltyRatePercent / 100m, 4);

        decimal totalPenalties = 0.00m;
        int paidInstallments = 0;
        int installment = 1;

        foreach (var cutoff in scheduledCutoffs)
        {
            repaymentsMap.TryGetValue(cutoff.Id, out var r);

            decimal scheduledAmount = Math.Round(loan.CutoffPaymentAmount, 2);
            if (installment == loan.CutoffsCount)
            {
                decimal sumPrevious = Math.Round(loan.CutoffPaymentAmount, 2) * (loan.CutoffsCount - 1);
                scheduledAmount = Math.Round(loan.PrincipalAmount - sumPrevious, 2);
            }

            decimal principalPaid = Math.Round(r?.PrincipalPaid ?? 0.00m, 2);
            decimal latePenaltyPaid = Math.Round(r?.LatePenaltyPaid ?? 0.00m, 2);

            var dueDateWithGrace = cutoff.CutoffDate.Date.AddDays(gracePeriodDays).AddHours(23).AddMinutes(59).AddSeconds(59);
            bool isPaid = principalPaid >= scheduledAmount;
            if (isPaid)
            {
                paidInstallments++;
            }

            bool isPastGrace = DateTime.UtcNow > dueDateWithGrace;
            bool isOverdue = !isPaid && isPastGrace;

            decimal unpaidBalance = Math.Max(0m, scheduledAmount - principalPaid);
            decimal accruedPenalty = isOverdue ? Math.Round(unpaidBalance * penaltyRate, 2) : 0.00m;

            totalPenalties += latePenaltyPaid + accruedPenalty;
            installment++;
        }

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

        return (Math.Round(totalPenalties, 2), allEntriesPaid, effectiveStatus);
    }

    [Authorize(Roles = "Admin,User")]
    [HttpGet]
    public async Task<ActionResult<IEnumerable<LoanResponseDto>>> GetAllLoans()
    {
        var loanEntities = await _context.Loans
            .Include(l => l.Member)
            .Include(l => l.Approver)
            .Include(l => l.Repayments)
                .ThenInclude(r => r.CutoffPeriod)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

        var allCutoffs = await _context.CutoffPeriods
            .OrderBy(c => c.CutoffDate)
            .ToListAsync();

        bool statusReconciled = false;
        var loans = new List<LoanResponseDto>(loanEntities.Count);
        foreach (var l in loanEntities)
        {
            var (totalSchedulePenalties, _, effectiveStatus) = await ComputeLoanScheduleMetricsAsync(l, allCutoffs);
            if (l.Status != effectiveStatus)
            {
                l.Status = effectiveStatus;
                statusReconciled = true;
            }

            loans.Add(new LoanResponseDto(
                l.Id,
                l.LoanReference,
                l.MemberId,
                $"{l.Member.FirstName} {l.Member.LastName}",
                l.OriginationDate,
                l.PrincipalAmount,
                l.InterestRate,
                l.InterestEarned,
                l.ReleasedAmount,
                l.TermMonths,
                l.CutoffsCount,
                l.CutoffPaymentAmount,
                effectiveStatus,
                l.ApprovedBy,
                l.Approver != null ? $"{l.Approver.FirstName} {l.Approver.LastName}" : null,
                l.Notes,
                l.CreatedAt,
                l.Repayments.Sum(r => r.PrincipalPaid),
                totalSchedulePenalties
            ));
        }

        if (statusReconciled)
        {
            await _context.SaveChangesAsync();
        }

        return Ok(loans);
    }

    /// <summary>
    /// Returns only the calling member's loan accounts and schedule metrics.
    /// </summary>
    [HttpGet("my-loans")]
    public async Task<ActionResult<IEnumerable<LoanResponseDto>>> GetMyLoans()
    {
        var memberId = User.GetMemberId();
        if (!memberId.HasValue)
        {
            var currentUsername = User.Identity?.Name;
            var userAccount = await _context.Users
                .Include(u => u.Member)
                .FirstOrDefaultAsync(u => u.Username == currentUsername);
            if (userAccount?.MemberId != null)
            {
                memberId = userAccount.MemberId;
            }
            else
            {
                var firstMember = await _context.Members
                    .OrderBy(m => m.MemberCode)
                    .FirstOrDefaultAsync(m => m.Status == MemberStatus.ACTIVE);
                if (firstMember != null && userAccount != null)
                {
                    userAccount.MemberId = firstMember.Id;
                    await _context.SaveChangesAsync();
                    memberId = firstMember.Id;
                }
                else
                {
                    return Forbid();
                }
            }
        }

        var loanEntities = await _context.Loans
            .Where(l => l.MemberId == memberId.Value)
            .Include(l => l.Member)
            .Include(l => l.Approver)
            .Include(l => l.Repayments)
                .ThenInclude(r => r.CutoffPeriod)
            .OrderByDescending(l => l.CreatedAt)
            .ToListAsync();

        var allCutoffs = await _context.CutoffPeriods
            .OrderBy(c => c.CutoffDate)
            .ToListAsync();

        bool statusReconciled = false;
        var loans = new List<LoanResponseDto>(loanEntities.Count);
        foreach (var l in loanEntities)
        {
            var (totalSchedulePenalties, _, effectiveStatus) = await ComputeLoanScheduleMetricsAsync(l, allCutoffs);
            if (l.Status != effectiveStatus)
            {
                l.Status = effectiveStatus;
                statusReconciled = true;
            }

            loans.Add(new LoanResponseDto(
                l.Id,
                l.LoanReference,
                l.MemberId,
                $"{l.Member.FirstName} {l.Member.LastName}",
                l.OriginationDate,
                l.PrincipalAmount,
                l.InterestRate,
                l.InterestEarned,
                l.ReleasedAmount,
                l.TermMonths,
                l.CutoffsCount,
                l.CutoffPaymentAmount,
                effectiveStatus,
                l.ApprovedBy,
                l.Approver != null ? $"{l.Approver.FirstName} {l.Approver.LastName}" : null,
                l.Notes,
                l.CreatedAt,
                l.Repayments.Sum(r => r.PrincipalPaid),
                totalSchedulePenalties
            ));
        }

        if (statusReconciled)
        {
            await _context.SaveChangesAsync();
        }

        return Ok(loans);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<LoanResponseDto>> GetLoanById(Guid id)
    {
        var loan = await _context.Loans
            .Include(l => l.Member)
            .Include(l => l.Approver)
            .Include(l => l.Repayments)
                .ThenInclude(r => r.CutoffPeriod)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (loan == null)
        {
            return NotFound(new { message = "Loan record not found." });
        }

        if (User.IsInRole(UserRole.Member.ToString()) || User.IsInRole("Member"))
        {
            var currentMemberId = User.GetMemberId();
            if (!currentMemberId.HasValue || loan.MemberId != currentMemberId.Value)
            {
                return Forbid();
            }
        }

        var allCutoffs = await _context.CutoffPeriods
            .OrderBy(c => c.CutoffDate)
            .ToListAsync();
        var (totalSchedulePenalties, _, effectiveStatus) = await ComputeLoanScheduleMetricsAsync(loan, allCutoffs);
        if (loan.Status != effectiveStatus)
        {
            loan.Status = effectiveStatus;
            await _context.SaveChangesAsync();
        }

        var dto = new LoanResponseDto(
            loan.Id,
            loan.LoanReference,
            loan.MemberId,
            $"{loan.Member.FirstName} {loan.Member.LastName}",
            loan.OriginationDate,
            loan.PrincipalAmount,
            loan.InterestRate,
            loan.InterestEarned,
            loan.ReleasedAmount,
            loan.TermMonths,
            loan.CutoffsCount,
            loan.CutoffPaymentAmount,
            effectiveStatus,
            loan.ApprovedBy,
            loan.Approver != null ? $"{loan.Approver.FirstName} {loan.Approver.LastName}" : null,
            loan.Notes,
            loan.CreatedAt,
            loan.Repayments.Sum(r => r.PrincipalPaid),
            totalSchedulePenalties
        );

        return Ok(dto);
    }

    [Authorize(Roles = "Admin,User")]
    [HttpPost]
    public async Task<ActionResult<LoanResponseDto>> CreateLoan([FromBody] CreateLoanRequest request)
    {
        var member = await _context.Members.FirstOrDefaultAsync(m => m.Id == request.MemberId);
        if (member == null)
        {
            return BadRequest(new { message = "Selected member does not exist." });
        }

        if (member.Status != MemberStatus.ACTIVE)
        {
            return BadRequest(new { message = $"Cannot originate loan. Member status is {member.Status}; must be ACTIVE." });
        }

        var refExists = await _context.Loans.AnyAsync(l => l.LoanReference == request.LoanReference);
        if (refExists)
        {
            return Conflict(new { message = "Loan reference code already exists." });
        }

        if (request.PrincipalAmount < 1000m)
        {
            return BadRequest(new { message = "Principal amount must be at least ₱1,000." });
        }

        if (request.PrincipalAmount > 80000m)
        {
            return BadRequest(new { message = "Principal amount exceeds the maximum cooperative limit of ₱80,000." });
        }

        // Tiering logic as per cooperative policy:
        // <= 5,000 PHP: 2 months (4 cutoffs)
        // 5,001 - 15,000 PHP: 3 months (6 cutoffs)
        // 15,001 - 25,000 PHP: 4 months (8 cutoffs)
        // 25,001 - 35,000 PHP: 5 months (10 cutoffs)
        // 35,001 - 50,000 PHP: 6 months (12 cutoffs)
        // 50,001 - 70,000 PHP: 7 months (14 cutoffs)
        // 70,001 - 80,000 PHP: 8 months (16 cutoffs)
        int termMonths;
        int cutoffsCount;
        decimal principal = Math.Round(request.PrincipalAmount, 2);

        if (principal <= 5000m)
        {
            termMonths = 2;
            cutoffsCount = 4;
        }
        else if (principal <= 15000m)
        {
            termMonths = 3;
            cutoffsCount = 6;
        }
        else if (principal <= 25000m)
        {
            termMonths = 4;
            cutoffsCount = 8;
        }
        else if (principal <= 35000m)
        {
            termMonths = 5;
            cutoffsCount = 10;
        }
        else if (principal <= 50000m)
        {
            termMonths = 6;
            cutoffsCount = 12;
        }
        else if (principal <= 70000m)
        {
            termMonths = 7;
            cutoffsCount = 14;
        }
        else
        {
            termMonths = 8;
            cutoffsCount = 16;
        }

        var activePolicy = await _financialPolicyService.GetEffectiveLoanPolicyAsync(DateTime.UtcNow);
        decimal interestRate = Math.Round(activePolicy.StandardLoanInterestRatePercent / 100m, 4);
        decimal interestEarned = Math.Round(principal * interestRate, 2);
        decimal releasedAmount = Math.Round(principal - interestEarned, 2);
        decimal cutoffPaymentAmount = Math.Round(principal / cutoffsCount, 2);

        var originationDate = DateTime.SpecifyKind(request.OriginationDate, DateTimeKind.Utc);

        var loan = new Loan
        {
            LoanReference = request.LoanReference,
            MemberId = request.MemberId,
            OriginationDate = originationDate,
            PrincipalAmount = principal,
            InterestRate = interestRate,
            InterestEarned = interestEarned,
            ReleasedAmount = releasedAmount,
            TermMonths = termMonths,
            CutoffsCount = cutoffsCount,
            CutoffPaymentAmount = cutoffPaymentAmount,
            Status = LoanStatus.PENDING_APPROVAL,
            Notes = request.Notes ?? $"Originated under Tier {termMonths}mo/{cutoffsCount} cutoffs",
            CreatedAt = DateTime.UtcNow
        };

        _context.Loans.Add(loan);

        // Automatically schedule expected amortization entries across consecutive future cutoffs
        var futureCutoffs = await _context.CutoffPeriods
            .Where(c => c.CutoffDate >= originationDate && !c.IsClosed)
            .OrderBy(c => c.CutoffDate)
            .Take(cutoffsCount)
            .ToListAsync();

        if (futureCutoffs.Count < cutoffsCount)
        {
            await DbInitializer.EnsureFiscalYearCutoffsAsync(_context, originationDate.Year + 1);
            futureCutoffs = await _context.CutoffPeriods
                .Where(c => c.CutoffDate >= originationDate && !c.IsClosed)
                .OrderBy(c => c.CutoffDate)
                .Take(cutoffsCount)
                .ToListAsync();
        }

        foreach (var cutoff in futureCutoffs)
        {
            loan.Repayments.Add(new LoanRepayment
            {
                LoanId = loan.Id,
                CutoffId = cutoff.Id,
                PrincipalPaid = 0.00m, // Expected / pending
                LatePenaltyPaid = 0.00m,
                RecordedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync();

        var createdDto = new LoanResponseDto(
            loan.Id,
            loan.LoanReference,
            loan.MemberId,
            $"{member.FirstName} {member.LastName}",
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
            null,
            loan.Notes,
            loan.CreatedAt,
            0.00m,
            0.00m
        );

        return CreatedAtAction(nameof(GetLoanById), new { id = loan.Id }, createdDto);
    }

    [HttpGet("{id:guid}/schedule")]
    public async Task<ActionResult<IEnumerable<AmortizationScheduleItemDto>>> GetLoanSchedule(Guid id)
    {
        var loan = await _context.Loans
            .Include(l => l.Repayments)
                .ThenInclude(r => r.CutoffPeriod)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (loan == null)
        {
            return NotFound(new { message = "Loan record not found." });
        }

        if (User.IsInRole(UserRole.Member.ToString()) || User.IsInRole("Member"))
        {
            var currentMemberId = User.GetMemberId();
            if (!currentMemberId.HasValue || loan.MemberId != currentMemberId.Value)
            {
                return Forbid();
            }
        }

        var repaymentsMap = loan.Repayments
            .GroupBy(r => r.CutoffId)
            .ToDictionary(g => g.Key, g => g.Last());

        // Fetch the scheduled cutoffs starting from loan origination date
        var scheduledCutoffs = await _context.CutoffPeriods
            .Where(c => c.CutoffDate >= loan.OriginationDate.Date)
            .OrderBy(c => c.CutoffDate)
            .Take(loan.CutoffsCount)
            .ToListAsync();

        if (scheduledCutoffs.Count < loan.CutoffsCount)
        {
            var scheduledIds = scheduledCutoffs.Select(c => c.Id).ToHashSet();
            var extraCutoffs = loan.Repayments
                .Where(r => !scheduledIds.Contains(r.CutoffId) && r.CutoffPeriod != null)
                .Select(r => r.CutoffPeriod)
                .ToList();
            scheduledCutoffs.AddRange(extraCutoffs);
            scheduledCutoffs = scheduledCutoffs.OrderBy(c => c.CutoffDate).Take(loan.CutoffsCount).ToList();
        }

        var loanPolicy = await _financialPolicyService.GetEffectiveLoanPolicyAsync(loan.CreatedAt);
        int gracePeriodDays = loanPolicy.GracePeriodDays;
        decimal penaltyRate = Math.Round(loanPolicy.LatePenaltyRatePercent / 100m, 4);
        var schedule = new List<AmortizationScheduleItemDto>();
        decimal cumulativePrincipalPaid = 0.00m;
        int installment = 1;

        foreach (var cutoff in scheduledCutoffs)
        {
            repaymentsMap.TryGetValue(cutoff.Id, out var r);

            decimal scheduledAmount = Math.Round(loan.CutoffPaymentAmount, 2);
            if (installment == loan.CutoffsCount)
            {
                // Reconcile rounding on final installment
                decimal sumPrevious = Math.Round(loan.CutoffPaymentAmount, 2) * (loan.CutoffsCount - 1);
                scheduledAmount = Math.Round(loan.PrincipalAmount - sumPrevious, 2);
            }

            decimal principalPaid = Math.Round(r?.PrincipalPaid ?? 0.00m, 2);
            decimal latePenaltyPaid = Math.Round(r?.LatePenaltyPaid ?? 0.00m, 2);
            DateTime? paymentDate = r?.PaymentDate;
            PaymentChannel paymentChannel = r?.PaymentChannel ?? PaymentChannel.CASH;
            string? notes = r?.Notes;

            cumulativePrincipalPaid += principalPaid;
            decimal remaining = Math.Max(0m, Math.Round(loan.PrincipalAmount - cumulativePrincipalPaid, 2));

            var cutoffDate = cutoff.CutoffDate;
            var dueDateWithGrace = cutoffDate.Date.AddDays(gracePeriodDays).AddHours(23).AddMinutes(59).AddSeconds(59);

            bool isPaid = principalPaid >= scheduledAmount;
            bool isPastGrace = DateTime.UtcNow > dueDateWithGrace;
            bool isOverdue = !isPaid && isPastGrace;

            bool isDelayed = (r != null && r.IsDelayed) || (isPaid && paymentDate.HasValue && paymentDate.Value > dueDateWithGrace) || latePenaltyPaid > 0 || isOverdue;

            int daysOverdue = 0;
            if (isOverdue)
            {
                daysOverdue = Math.Max(0, (int)(DateTime.UtcNow.Date - cutoffDate.Date).TotalDays);
            }
            else if (isDelayed && paymentDate.HasValue)
            {
                daysOverdue = Math.Max(0, (int)(paymentDate.Value.Date - cutoffDate.Date).TotalDays);
            }

            decimal unpaidBalance = Math.Max(0m, scheduledAmount - principalPaid);
            decimal accruedPenalty = 0.00m;
            if (isOverdue)
            {
                // Apply the loan's effective late charge rate on unpaid installment past grace period
                accruedPenalty = Math.Round(unpaidBalance * penaltyRate, 2);
            }

            string status = isPaid
                ? "PAID"
                : (isOverdue ? "OVERDUE" : "UPCOMING");

            schedule.Add(new AmortizationScheduleItemDto(
                installment,
                cutoff.Id,
                cutoff.Label,
                cutoffDate,
                scheduledAmount,
                principalPaid,
                remaining,
                status,
                latePenaltyPaid,
                accruedPenalty,
                isDelayed,
                daysOverdue,
                paymentDate,
                paymentChannel,
                notes
            ));

            installment++;
        }

        return Ok(schedule);
    }

    [Authorize(Roles = "Admin,User")]
    [HttpPost("{id:guid}/repayments")]
    public async Task<ActionResult<LoanRepaymentResponseDto>> RecordLoanRepayment(
        Guid id,
        [FromBody] RecordLoanRepaymentRequest request)
    {
        if (request.PrincipalPaid < 0 || request.LatePenaltyPaid < 0)
        {
            return BadRequest(new { message = "Amounts cannot be negative." });
        }

        if (request.PrincipalPaid == 0 && request.LatePenaltyPaid == 0)
        {
            return BadRequest(new { message = "At least one of Principal Paid or Late Penalty Paid must be greater than zero." });
        }

        var loan = await _context.Loans
            .Include(l => l.Repayments)
                .ThenInclude(r => r.CutoffPeriod)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (loan == null)
        {
            return NotFound(new { message = "Loan record not found." });
        }

        var cutoff = await _context.CutoffPeriods.FirstOrDefaultAsync(c => c.Id == request.CutoffId);
        if (cutoff == null)
        {
            return NotFound(new { message = "Cutoff period not found." });
        }

        var loanPolicy = await _financialPolicyService.GetEffectiveLoanPolicyAsync(loan.CreatedAt);
        int gracePeriodDays = loanPolicy.GracePeriodDays;
        decimal penaltyRate = Math.Round(loanPolicy.LatePenaltyRatePercent / 100m, 4);
        var paymentDate = request.PaymentDate ?? DateTime.UtcNow;
        var dueDateWithGrace = cutoff.CutoffDate.Date.AddDays(gracePeriodDays).AddHours(23).AddMinutes(59).AddSeconds(59);
        bool isPastGrace = paymentDate > dueDateWithGrace;

        // Auto-calculate penalty using the loan's effective policy if payment is made past cutoff + grace policy and not explicitly provided
        decimal latePenaltyToRecord = request.LatePenaltyPaid;
        if (isPastGrace && latePenaltyToRecord == 0)
        {
            decimal baseForPenalty = request.PrincipalPaid > 0 ? request.PrincipalPaid : loan.CutoffPaymentAmount;
            latePenaltyToRecord = Math.Round(baseForPenalty * penaltyRate, 2);
        }

        bool isDelayed = isPastGrace || latePenaltyToRecord > 0;
        int daysOverdue = isDelayed ? Math.Max(0, (int)(paymentDate.Date - cutoff.CutoffDate.Date).TotalDays) : 0;

        var repayment = loan.Repayments.FirstOrDefault(r => r.CutoffId == request.CutoffId);
        if (repayment != null && Math.Round(repayment.PrincipalPaid, 2) >= Math.Round(loan.CutoffPaymentAmount, 2) && request.PrincipalPaid > 0)
        {
            return BadRequest(new { message = $"Schedule installment for {cutoff.Label} is already paid in full." });
        }

        if (repayment == null)
        {
            repayment = new LoanRepayment
            {
                Id = Guid.NewGuid(),
                LoanId = loan.Id,
                CutoffId = request.CutoffId,
                PrincipalPaid = 0.00m,
                LatePenaltyPaid = 0.00m,
                PaymentChannel = request.PaymentChannel ?? PaymentChannel.CASH
            };
            _context.LoanRepayments.Add(repayment);
        }

        repayment.PrincipalPaid += request.PrincipalPaid;
        repayment.LatePenaltyPaid += latePenaltyToRecord;
        repayment.PaymentDate = paymentDate;
        repayment.PaymentChannel = request.PaymentChannel ?? repayment.PaymentChannel ?? PaymentChannel.CASH;
        repayment.RecordedAt = DateTime.UtcNow;
        repayment.IsDelayed = isDelayed;
        if (!string.IsNullOrWhiteSpace(request.Notes))
        {
            repayment.Notes = string.IsNullOrWhiteSpace(repayment.Notes)
                ? request.Notes
                : $"{repayment.Notes} | {request.Notes}";
        }

        // Dynamically recalculate loan remaining balance and verify whether all scheduled payments are paid in full
        decimal totalPrincipalPaid = loan.Repayments.Sum(r => r.PrincipalPaid);
        decimal remainingBalance = Math.Max(0m, Math.Round(loan.PrincipalAmount - totalPrincipalPaid, 2));

        var allCutoffs = await _context.CutoffPeriods
            .OrderBy(c => c.CutoffDate)
            .ToListAsync();
        var (_, allScheduleEntriesPaid, _) = await ComputeLoanScheduleMetricsAsync(loan, allCutoffs);

        if (allScheduleEntriesPaid)
        {
            remainingBalance = 0m;
            loan.Status = LoanStatus.PAID;
        }
        else
        {
            loan.Status = LoanStatus.ACTIVE;
        }

        await _context.SaveChangesAsync();

        var responseDto = new LoanRepaymentResponseDto(
            repayment.Id,
            loan.Id,
            cutoff.Id,
            cutoff.Label,
            cutoff.CutoffDate,
            repayment.PrincipalPaid,
            repayment.LatePenaltyPaid,
            request.PrincipalPaid + latePenaltyToRecord,
            remainingBalance,
            repayment.IsDelayed,
            daysOverdue,
            repayment.PaymentDate,
            repayment.RecordedAt,
            loan.Status.ToString(),
            repayment.PaymentChannel,
            repayment.Notes
        );

        return Ok(responseDto);
    }

    [HttpGet("{id:guid}/penalties")]
    public async Task<ActionResult<LoanPenaltySummaryDto>> GetLoanPenalties(Guid id)
    {
        var loan = await _context.Loans
            .Include(l => l.Member)
            .Include(l => l.Repayments)
                .ThenInclude(r => r.CutoffPeriod)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (loan == null)
        {
            return NotFound(new { message = "Loan record not found." });
        }

        if (User.IsInRole(UserRole.Member.ToString()) || User.IsInRole("Member"))
        {
            var currentMemberId = User.GetMemberId();
            if (!currentMemberId.HasValue || loan.MemberId != currentMemberId.Value)
            {
                return Forbid();
            }
        }

        var repaymentsMap = loan.Repayments
            .GroupBy(r => r.CutoffId)
            .ToDictionary(g => g.Key, g => g.Last());

        // Fetch the scheduled cutoffs starting from loan origination date
        var scheduledCutoffs = await _context.CutoffPeriods
            .Where(c => c.CutoffDate >= loan.OriginationDate.Date)
            .OrderBy(c => c.CutoffDate)
            .Take(loan.CutoffsCount)
            .ToListAsync();

        if (scheduledCutoffs.Count < loan.CutoffsCount)
        {
            var scheduledIds = scheduledCutoffs.Select(c => c.Id).ToHashSet();
            var extraCutoffs = loan.Repayments
                .Where(r => !scheduledIds.Contains(r.CutoffId) && r.CutoffPeriod != null)
                .Select(r => r.CutoffPeriod)
                .ToList();
            scheduledCutoffs.AddRange(extraCutoffs);
            scheduledCutoffs = scheduledCutoffs.OrderBy(c => c.CutoffDate).Take(loan.CutoffsCount).ToList();
        }

        var loanPolicy = await _financialPolicyService.GetEffectiveLoanPolicyAsync(loan.CreatedAt);
        int gracePeriodDays = loanPolicy.GracePeriodDays;
        decimal penaltyRate = Math.Round(loanPolicy.LatePenaltyRatePercent / 100m, 4);
        var breakdown = new List<CutoffPenaltyDetailDto>();

        decimal totalAccruedPenalties = 0.00m;
        decimal totalLatePenaltiesPaid = 0.00m;
        int overdueCount = 0;
        int paidCount = 0;
        int installment = 1;

        foreach (var cutoff in scheduledCutoffs)
        {
            repaymentsMap.TryGetValue(cutoff.Id, out var r);

            decimal scheduledAmount = Math.Round(loan.CutoffPaymentAmount, 2);
            if (installment == loan.CutoffsCount)
            {
                decimal sumPrevious = Math.Round(loan.CutoffPaymentAmount, 2) * (loan.CutoffsCount - 1);
                scheduledAmount = Math.Round(loan.PrincipalAmount - sumPrevious, 2);
            }

            var cutoffDate = cutoff.CutoffDate;
            var dueDateWithGrace = cutoffDate.Date.AddDays(gracePeriodDays).AddHours(23).AddMinutes(59).AddSeconds(59);

            decimal principalPaid = Math.Round(r?.PrincipalPaid ?? 0.00m, 2);
            decimal latePenaltyPaid = Math.Round(r?.LatePenaltyPaid ?? 0.00m, 2);
            DateTime? paymentDate = r?.PaymentDate;

            bool isPaid = principalPaid >= scheduledAmount;
            bool isPastGrace = DateTime.UtcNow > dueDateWithGrace;
            bool isOverdue = !isPaid && isPastGrace;

            bool isDelayed = (r != null && r.IsDelayed) || (isPaid && paymentDate.HasValue && paymentDate.Value > dueDateWithGrace) || latePenaltyPaid > 0 || isOverdue;

            int daysLate = 0;
            if (isOverdue)
            {
                daysLate = Math.Max(0, (int)(DateTime.UtcNow.Date - cutoffDate.Date).TotalDays);
                overdueCount++;
            }
            else if (isDelayed && paymentDate.HasValue)
            {
                daysLate = Math.Max(0, (int)(paymentDate.Value.Date - cutoffDate.Date).TotalDays);
            }

            if (isPaid) paidCount++;

            decimal remainingCutoffBalance = Math.Max(0m, scheduledAmount - principalPaid);
            decimal accruedPenalty = 0.00m;
            if (isOverdue)
            {
                accruedPenalty = Math.Round(remainingCutoffBalance * penaltyRate, 2);
            }

            totalAccruedPenalties += accruedPenalty;
            totalLatePenaltiesPaid += latePenaltyPaid;

            string status = isPaid ? "PAID" : (isOverdue ? "OVERDUE" : "UPCOMING");

            breakdown.Add(new CutoffPenaltyDetailDto(
                r?.Id,
                cutoff.Id,
                cutoff.Label,
                cutoffDate,
                dueDateWithGrace,
                scheduledAmount,
                principalPaid,
                remainingCutoffBalance,
                latePenaltyPaid,
                accruedPenalty,
                isDelayed,
                isOverdue,
                daysLate,
                paymentDate,
                status
            ));

            installment++;
        }

        decimal totalPrincipalPaid = loan.Repayments.Sum(r => r.PrincipalPaid);
        decimal remainingPrincipal = Math.Max(0m, loan.PrincipalAmount - totalPrincipalPaid);
        decimal outstandingPenalties = Math.Max(0m, totalAccruedPenalties - totalLatePenaltiesPaid);

        var summary = new LoanPenaltySummaryDto(
            loan.Id,
            loan.LoanReference,
            loan.MemberId,
            $"{loan.Member.FirstName} {loan.Member.LastName}",
            loan.PrincipalAmount,
            totalPrincipalPaid,
            remainingPrincipal,
            totalLatePenaltiesPaid,
            totalAccruedPenalties,
            outstandingPenalties,
            loan.CutoffsCount,
            paidCount,
            overdueCount,
            gracePeriodDays,
            breakdown
        );

        return Ok(summary);
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("{id:guid}/status")]
    public async Task<IActionResult> UpdateLoanStatus(Guid id, [FromBody] UpdateLoanStatusRequest request)
    {
        var loan = await _context.Loans
            .Include(l => l.Repayments)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (loan == null)
        {
            return NotFound(new { message = "Loan record not found." });
        }

        if (request.Status == LoanStatus.PAID)
        {
            decimal totalPrincipalPaid = loan.Repayments.Sum(r => r.PrincipalPaid);
            decimal remainingBalance = Math.Max(0m, Math.Round(loan.PrincipalAmount - totalPrincipalPaid, 2));
            if (remainingBalance > 0m)
            {
                return BadRequest(new
                {
                    message = "Loans cannot be manually marked as PAID while there is an unpaid balance. A loan is automatically marked as PAID once all scheduled payments are paid in full."
                });
            }
        }

        loan.Status = request.Status;
        if (request.ApprovedBy.HasValue)
        {
            loan.ApprovedBy = request.ApprovedBy.Value;
        }

        if (!string.IsNullOrWhiteSpace(request.Notes))
        {
            loan.Notes = string.IsNullOrWhiteSpace(loan.Notes)
                ? request.Notes
                : $"{loan.Notes} | {request.Notes}";
        }

        // If loan has no scheduled repayments yet (e.g. seeded earlier), populate them now
        if (loan.Repayments.Count == 0 && (loan.Status == LoanStatus.APPROVED || loan.Status == LoanStatus.ACTIVE))
        {
            var futureCutoffs = await _context.CutoffPeriods
                .Where(c => c.CutoffDate >= loan.OriginationDate && !c.IsClosed)
                .OrderBy(c => c.CutoffDate)
                .Take(loan.CutoffsCount)
                .ToListAsync();

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
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = $"Loan {loan.LoanReference} status updated to {loan.Status}." });
    }

    /// <summary>
    /// Dispatches a Loan Amortization & Cutoff Notification email to the borrower containing:
    /// 1. All delayed cutoffs plus late penalty
    /// 2. Current cutoff
    /// 3. Total amount due (All Delayed + Penalties + Current Cutoff)
    /// 4. Immediate upcoming cutoff (FYI only)
    /// </summary>
    [Authorize(Roles = "Admin,User")]
    [HttpPost("{id:guid}/notify")]
    public async Task<IActionResult> SendLoanNotification(
        Guid id,
        CancellationToken cancellationToken)
    {
        var loan = await _context.Loans
            .Include(l => l.Member)
            .Include(l => l.Repayments)
                .ThenInclude(r => r.CutoffPeriod)
            .FirstOrDefaultAsync(l => l.Id == id, cancellationToken);

        if (loan == null)
        {
            return NotFound(new { message = "Loan record not found." });
        }

        if (loan.Member == null || string.IsNullOrWhiteSpace(loan.Member.Email))
        {
            return BadRequest(new { message = "Borrower does not have a registered email address." });
        }

        var repaymentsMap = loan.Repayments
            .GroupBy(r => r.CutoffId)
            .ToDictionary(g => g.Key, g => g.Last());

        var scheduledCutoffs = await _context.CutoffPeriods
            .Where(c => c.CutoffDate >= loan.OriginationDate.Date)
            .OrderBy(c => c.CutoffDate)
            .Take(loan.CutoffsCount)
            .ToListAsync(cancellationToken);

        if (scheduledCutoffs.Count < loan.CutoffsCount)
        {
            var scheduledIds = scheduledCutoffs.Select(c => c.Id).ToHashSet();
            var extraCutoffs = loan.Repayments
                .Where(r => !scheduledIds.Contains(r.CutoffId) && r.CutoffPeriod != null)
                .Select(r => r.CutoffPeriod)
                .ToList();
            scheduledCutoffs.AddRange(extraCutoffs);
            scheduledCutoffs = scheduledCutoffs.OrderBy(c => c.CutoffDate).Take(loan.CutoffsCount).ToList();
        }

        var loanPolicy = await _financialPolicyService.GetEffectiveLoanPolicyAsync(loan.CreatedAt, cancellationToken);
        int gracePeriodDays = loanPolicy.GracePeriodDays;
        decimal penaltyRatePercent = loanPolicy.LatePenaltyRatePercent;
        decimal penaltyRate = Math.Round(penaltyRatePercent / 100m, 4);

        var now = DateTime.UtcNow;

        var scheduleItems = new List<(
            int InstallmentNumber,
            string Label,
            DateTime CutoffDate,
            DateTime GraceDeadline,
            decimal ScheduledPrincipal,
            decimal PrincipalPaid,
            decimal UnpaidPrincipal,
            decimal PenaltyAmount,
            bool IsPaid,
            bool IsOverdue,
            int DaysLate
        )>();

        int currentIdx = -1;

        for (int i = 0; i < scheduledCutoffs.Count; i++)
        {
            var cutoff = scheduledCutoffs[i];
            int installmentNumber = i + 1;
            repaymentsMap.TryGetValue(cutoff.Id, out var r);

            decimal scheduledAmount = Math.Round(loan.CutoffPaymentAmount, 2);
            if (installmentNumber == loan.CutoffsCount)
            {
                decimal sumPrevious = Math.Round(loan.CutoffPaymentAmount, 2) * (loan.CutoffsCount - 1);
                scheduledAmount = Math.Round(loan.PrincipalAmount - sumPrevious, 2);
            }

            decimal principalPaid = Math.Round(r?.PrincipalPaid ?? 0.00m, 2);
            decimal latePenaltyPaid = Math.Round(r?.LatePenaltyPaid ?? 0.00m, 2);
            var dueDateWithGrace = cutoff.CutoffDate.Date.AddDays(gracePeriodDays).AddHours(23).AddMinutes(59).AddSeconds(59);

            bool isPaid = principalPaid >= scheduledAmount;
            bool isPastGrace = now > dueDateWithGrace;
            bool isOverdue = !isPaid && isPastGrace;

            decimal unpaidPrincipal = Math.Max(0m, scheduledAmount - principalPaid);
            decimal accruedPenalty = isOverdue ? Math.Round(unpaidPrincipal * penaltyRate, 2) : 0.00m;
            decimal unpaidPenalty = isOverdue ? Math.Max(0m, accruedPenalty - latePenaltyPaid) : 0.00m;
            int daysLate = isOverdue ? Math.Max(1, (int)(now.Date - cutoff.CutoffDate.Date).TotalDays) : 0;

            scheduleItems.Add((
                installmentNumber,
                cutoff.Label,
                cutoff.CutoffDate,
                dueDateWithGrace,
                scheduledAmount,
                principalPaid,
                unpaidPrincipal,
                unpaidPenalty,
                isPaid,
                isOverdue,
                daysLate
            ));

            if (!isPastGrace && currentIdx == -1)
            {
                currentIdx = i;
            }
        }

        if (currentIdx == -1 && scheduleItems.Count > 0)
        {
            currentIdx = scheduleItems.Count - 1;
        }

        var delayedItems = scheduleItems.Where(s => s.IsOverdue).ToList();
        var currentItem = currentIdx >= 0 && currentIdx < scheduleItems.Count ? scheduleItems[currentIdx] : default;
        bool hasCurrent = currentIdx >= 0 && currentIdx < scheduleItems.Count && !currentItem.IsOverdue;
        decimal currentCutoffDue = hasCurrent && !currentItem.IsPaid ? currentItem.UnpaidPrincipal : 0.00m;

        bool hasUpcoming = currentIdx >= 0 && (currentIdx + 1) < scheduleItems.Count;
        var upcomingItem = hasUpcoming ? scheduleItems[currentIdx + 1] : default;

        decimal totalDelayedPrincipal = delayedItems.Sum(d => d.UnpaidPrincipal);
        decimal totalDelayedPenalty = delayedItems.Sum(d => d.PenaltyAmount);
        decimal totalDelayedWithPenalty = totalDelayedPrincipal + totalDelayedPenalty;
        decimal grandTotalDue = totalDelayedWithPenalty + currentCutoffDue;

        var delayedRowsHtml = new StringBuilder();
        if (delayedItems.Count == 0)
        {
            delayedRowsHtml.AppendLine("<tr><td colspan='5' style='padding:12px;text-align:center;color:#059669;font-weight:600;background:#ecfdf5;'>No delayed or overdue loan installments.</td></tr>");
        }
        else
        {
            foreach (var d in delayedItems)
            {
                decimal lineTotal = d.UnpaidPrincipal + d.PenaltyAmount;
                delayedRowsHtml.AppendLine($@"
                <tr>
                  <td style='padding:8px 10px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-weight:700;color:#0f172a;'>#{d.InstallmentNumber} ({WebUtility.HtmlEncode(d.Label)})</td>
                  <td style='padding:8px 10px;border-bottom:1px solid #f1f5f9;color:#475569;'>{d.CutoffDate:MMM dd, yyyy} <span style='color:#dc2626;font-size:11px;font-weight:700;'>({d.DaysLate}d late)</span></td>
                  <td style='padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;color:#0f172a;'>₱{d.UnpaidPrincipal:N2}</td>
                  <td style='padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;color:#dc2626;font-weight:700;'>+₱{d.PenaltyAmount:N2}</td>
                  <td style='padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;font-weight:800;color:#991b1b;'>₱{lineTotal:N2}</td>
                </tr>");
            }
            delayedRowsHtml.AppendLine($@"
            <tr style='background:#fef2f2;font-weight:700;'>
              <td colspan='2' style='padding:10px;color:#991b1b;'>Subtotal — Delayed Cutoffs ({delayedItems.Count})</td>
              <td style='padding:10px;text-align:right;font-family:monospace;color:#0f172a;'>₱{totalDelayedPrincipal:N2}</td>
              <td style='padding:10px;text-align:right;font-family:monospace;color:#dc2626;'>+₱{totalDelayedPenalty:N2}</td>
              <td style='padding:10px;text-align:right;font-family:monospace;color:#991b1b;'>₱{totalDelayedWithPenalty:N2}</td>
            </tr>");
        }

        string currentCutoffHtml = !hasCurrent
            ? "<p style='color:#64748b;font-size:13px;margin:0;padding:10px;'>No active current cutoff installment (all scheduled cutoffs have elapsed).</p>"
            : $@"
            <table style='width:100%;border-collapse:collapse;font-size:13px;'>
              <tr>
                <td style='padding:8px 10px;color:#64748b;font-weight:600;'>Installment &amp; Cutoff:</td>
                <td style='padding:8px 10px;font-family:monospace;font-weight:700;color:#0f172a;'>Installment #{currentItem.InstallmentNumber} — {WebUtility.HtmlEncode(currentItem.Label)} ({currentItem.CutoffDate:MMM dd, yyyy})</td>
              </tr>
              <tr>
                <td style='padding:8px 10px;color:#64748b;font-weight:600;'>Grace Deadline ({gracePeriodDays}d):</td>
                <td style='padding:8px 10px;color:#0f172a;'>{currentItem.GraceDeadline:MMM dd, yyyy}</td>
              </tr>
              <tr>
                <td style='padding:8px 10px;color:#64748b;font-weight:600;'>Status:</td>
                <td style='padding:8px 10px;font-weight:700;color:{(currentItem.IsPaid ? "#059669" : "#d97706")};'>{(currentItem.IsPaid ? $"Paid in Full (₱{currentItem.PrincipalPaid:N2})" : "Due / Open for Repayment")}</td>
              </tr>
              <tr style='background:#f8fafc;'>
                <td style='padding:10px;font-weight:700;color:#0f172a;'>Current Cutoff Amount Due:</td>
                <td style='padding:10px;font-family:monospace;font-weight:800;font-size:15px;color:#0f172a;'>₱{currentCutoffDue:N2}</td>
              </tr>
            </table>";

        string upcomingCutoffHtml = !hasUpcoming
            ? "<p style='color:#64748b;font-size:13px;margin:0;'>No further upcoming installment scheduled for this loan.</p>"
            : $@"
            <table style='width:100%;border-collapse:collapse;font-size:13px;'>
              <tr>
                <td style='padding:6px 10px;color:#0369a1;font-weight:600;'>Next Installment (FYI):</td>
                <td style='padding:6px 10px;font-family:monospace;font-weight:700;color:#0c4a6e;'>Installment #{upcomingItem.InstallmentNumber} — {WebUtility.HtmlEncode(upcomingItem.Label)} ({upcomingItem.CutoffDate:MMM dd, yyyy})</td>
              </tr>
              <tr>
                <td style='padding:6px 10px;color:#0369a1;font-weight:600;'>Scheduled Amortization (FYI):</td>
                <td style='padding:6px 10px;font-family:monospace;font-weight:700;color:#0c4a6e;'>₱{upcomingItem.ScheduledPrincipal:N2} <span style='font-size:11px;font-weight:500;color:#0284c7;'>(Not included in Total Due above)</span></td>
              </tr>
            </table>";

        var originHeader = Request.Headers["Origin"].ToString();
        string portalRootUrl = "http://localhost:5173";
        if (!string.IsNullOrWhiteSpace(originHeader) && Uri.TryCreate(originHeader, UriKind.Absolute, out var originUri))
        {
            portalRootUrl = originUri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
        }
        else if (Request.Host.HasValue && !Request.Host.Host.Equals("localhost", StringComparison.OrdinalIgnoreCase) && Request.Host.Host != "127.0.0.1")
        {
            var proto = Request.Headers["X-Forwarded-Proto"].ToString();
            var scheme = !string.IsNullOrWhiteSpace(proto) ? proto : Request.Scheme;
            portalRootUrl = $"{scheme}://{Request.Host.Value}".TrimEnd('/');
        }

        var fullName = $"{loan.Member.FirstName} {loan.Member.LastName}";
        var subject = $"CoopIS - Loan Amortization & Cutoff Notice ({loan.LoanReference})";

        var htmlBody = $@"<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
</head>
<body style='font-family:-apple-system,BlinkMacSystemFont,""Segoe UI"",Roboto,sans-serif;background:#0f172a;padding:24px 12px;margin:0;'>
  <div style='max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.2);'>
    <div style='background:#064e3b;padding:24px 28px;color:#ffffff;'>
      <div style='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6ee7b7;'>Loan Amortization Notice</div>
      <h2 style='margin:6px 0 4px 0;font-size:20px;font-weight:800;'>Loan Reference: {WebUtility.HtmlEncode(loan.LoanReference)}</h2>
      <div style='font-size:13px;color:#d1fae5;'>Borrower: <strong>{WebUtility.HtmlEncode(fullName)}</strong> ({WebUtility.HtmlEncode(loan.Member.MemberCode)}) • Principal: ₱{loan.PrincipalAmount:N2}</div>
    </div>

    <div style='padding:24px 28px;color:#1e293b;font-size:14px;line-height:1.5;'>
      <p style='margin-top:0;'>Hello <strong>{WebUtility.HtmlEncode(fullName)}</strong>,</p>
      <p style='color:#475569;font-size:13px;'>Below is your cooperative loan amortization notice for <strong>{WebUtility.HtmlEncode(loan.LoanReference)}</strong> covering any delayed cutoffs (with the {penaltyRatePercent:0.#}% late penalty after the {gracePeriodDays}-day grace period), your current cutoff installment, and your immediate upcoming cutoff for your reference.</p>

      <!-- 1. Delayed Cutoffs -->
      <h3 style='font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#991b1b;margin:20px 0 8px 0;border-bottom:2px solid #fecaca;padding-bottom:6px;'>
        1. Delayed Cutoffs + Late Penalty ({penaltyRatePercent:0.#}%)
      </h3>
      <table style='width:100%;border-collapse:collapse;font-size:12px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;'>
        <thead>
          <tr style='background:#f8fafc;color:#475569;text-transform:uppercase;font-size:11px;'>
            <th style='padding:8px 10px;text-align:left;'>Installment / Cutoff</th>
            <th style='padding:8px 10px;text-align:left;'>Cutoff Date</th>
            <th style='padding:8px 10px;text-align:right;'>Principal Due</th>
            <th style='padding:8px 10px;text-align:right;'>Penalty</th>
            <th style='padding:8px 10px;text-align:right;'>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          {delayedRowsHtml}
        </tbody>
      </table>

      <!-- 2. Current Cutoff -->
      <h3 style='font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#065f46;margin:22px 0 8px 0;border-bottom:2px solid #a7f3d0;padding-bottom:6px;'>
        2. Current Cutoff
      </h3>
      <div style='border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;'>
        {currentCutoffHtml}
      </div>

      <!-- TOTAL AMOUNT DUE (DELAYED + PENALTY + CURRENT CUTOFF) -->
      <div style='margin:22px 0;padding:18px 20px;background:#0f172a;color:#ffffff;border-radius:12px;'>
        <div style='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:#94a3b8;'>
          Total Amount Due (All Delayed + Penalties + Current Cutoff)
        </div>
        <div style='font-size:26px;font-weight:900;font-family:monospace;color:#34d399;margin-top:4px;'>
          ₱{grandTotalDue:N2}
        </div>
        <div style='font-size:12px;color:#cbd5e1;margin-top:4px;'>
          Delayed Cutoffs (incl. Penalty): ₱{totalDelayedWithPenalty:N2} &nbsp;+&nbsp; Current Cutoff: ₱{currentCutoffDue:N2}
        </div>
      </div>

      <!-- 3. Immediate Upcoming Cutoff (FYI) -->
      <div style='padding:14px 16px;background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;'>
        <div style='font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.05em;color:#0284c7;margin-bottom:6px;'>
          ℹ️ FYI Only — Immediate Upcoming Cutoff
        </div>
        {upcomingCutoffHtml}
      </div>

      <div style='text-align:center;margin:22px 0 8px 0;'>
        <a href='{WebUtility.HtmlEncode(portalRootUrl)}' target='_blank' style='display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:12px 24px;border-radius:10px;'>
          Open CoopIS Portal ({WebUtility.HtmlEncode(portalRootUrl)})
        </a>
      </div>

      <p style='font-size:12px;color:#64748b;margin-top:18px;border-top:1px solid #e2e8f0;padding-top:14px;'>
        This is an automated cooperative loan notification from CoopIS. Please contact your Cooperative Administrator or Loan Officer if you have recently remitted payment.
      </p>
    </div>
  </div>
</body>
</html>";

        try
        {
            await _emailService.SendEmailAsync(loan.Member.Email.Trim(), subject, htmlBody, cancellationToken);
            return Ok(new
            {
                success = true,
                message = $"Loan notification email sent to {fullName} ({loan.Member.Email}).",
                delayedCount = delayedItems.Count,
                totalDue = grandTotalDue
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Failed to send loan notification email: {ex.Message}" });
        }
    }
}
