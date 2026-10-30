using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;
using CoopIS.Domain.Entities;
using CoopIS.Domain.Enums;
using CoopIS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoopIS.Api.Controllers;

[Authorize(Roles = "Admin,User")]
[ApiController]
[Route("api/loans")]
public class LoansController : ControllerBase
{
    private readonly AppDbContext _context;

    public LoansController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<LoanResponseDto>>> GetAllLoans()
    {
        var loans = await _context.Loans
            .Include(l => l.Member)
            .Include(l => l.Approver)
            .Include(l => l.Repayments)
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new LoanResponseDto(
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
                l.Status,
                l.ApprovedBy,
                l.Approver != null ? $"{l.Approver.FirstName} {l.Approver.LastName}" : null,
                l.Notes,
                l.CreatedAt,
                l.Repayments.Sum(r => r.PrincipalPaid),
                l.Repayments.Sum(r => r.LatePenaltyPaid)
            ))
            .ToListAsync();

        return Ok(loans);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<LoanResponseDto>> GetLoanById(Guid id)
    {
        var loan = await _context.Loans
            .Include(l => l.Member)
            .Include(l => l.Approver)
            .Include(l => l.Repayments)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (loan == null)
        {
            return NotFound(new { message = "Loan record not found." });
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
            loan.Status,
            loan.ApprovedBy,
            loan.Approver != null ? $"{loan.Approver.FirstName} {loan.Approver.LastName}" : null,
            loan.Notes,
            loan.CreatedAt,
            loan.Repayments.Sum(r => r.PrincipalPaid),
            loan.Repayments.Sum(r => r.LatePenaltyPaid)
        );

        return Ok(dto);
    }

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

        const decimal interestRate = 0.0500m; // 5% upfront flat interest
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

        // Ensure missing scheduled cutoffs are populated if needed
        if (loan.Repayments.Count < loan.CutoffsCount && (loan.Status == LoanStatus.APPROVED || loan.Status == LoanStatus.ACTIVE))
        {
            var existingCutoffIds = loan.Repayments.Select(r => r.CutoffId).ToHashSet();
            var neededCount = loan.CutoffsCount - loan.Repayments.Count;
            var additionalCutoffs = await _context.CutoffPeriods
                .Where(c => c.CutoffDate >= loan.OriginationDate && !existingCutoffIds.Contains(c.Id))
                .OrderBy(c => c.CutoffDate)
                .Take(neededCount)
                .ToListAsync();

            foreach (var cutoff in additionalCutoffs)
            {
                loan.Repayments.Add(new LoanRepayment
                {
                    LoanId = loan.Id,
                    CutoffId = cutoff.Id,
                    CutoffPeriod = cutoff,
                    PrincipalPaid = 0.00m,
                    LatePenaltyPaid = 0.00m,
                    RecordedAt = DateTime.UtcNow
                });
            }
            await _context.SaveChangesAsync();
        }

        const int gracePeriodDays = 3;
        var repayments = loan.Repayments
            .OrderBy(r => r.CutoffPeriod.CutoffDate)
            .ToList();

        var schedule = new List<AmortizationScheduleItemDto>();
        decimal remaining = loan.PrincipalAmount;
        int installment = 1;

        foreach (var r in repayments)
        {
            decimal scheduledAmount = loan.CutoffPaymentAmount;
            if (installment == loan.CutoffsCount)
            {
                // Reconcile rounding on final installment
                decimal sumPrevious = loan.CutoffPaymentAmount * (loan.CutoffsCount - 1);
                scheduledAmount = Math.Round(loan.PrincipalAmount - sumPrevious, 2);
            }

            remaining = Math.Max(0m, Math.Round(remaining - (r.PrincipalPaid > 0 ? r.PrincipalPaid : scheduledAmount), 2));

            var cutoffDate = r.CutoffPeriod.CutoffDate;
            var dueDateWithGrace = cutoffDate.Date.AddDays(gracePeriodDays).AddHours(23).AddMinutes(59).AddSeconds(59);

            bool isPaid = r.PrincipalPaid >= scheduledAmount;
            bool isPastGrace = DateTime.UtcNow > dueDateWithGrace;
            bool isOverdue = !isPaid && isPastGrace;

            bool isDelayed = r.IsDelayed || (isPaid && r.PaymentDate.HasValue && r.PaymentDate.Value > dueDateWithGrace) || r.LatePenaltyPaid > 0 || isOverdue;

            int daysOverdue = 0;
            if (isOverdue)
            {
                daysOverdue = Math.Max(0, (int)(DateTime.UtcNow.Date - cutoffDate.Date).TotalDays);
            }
            else if (isDelayed && r.PaymentDate.HasValue)
            {
                daysOverdue = Math.Max(0, (int)(r.PaymentDate.Value.Date - cutoffDate.Date).TotalDays);
            }

            decimal unpaidBalance = Math.Max(0m, scheduledAmount - r.PrincipalPaid);
            decimal accruedPenalty = 0.00m;
            if (isOverdue)
            {
                // Standard 2% late charge on unpaid installment
                accruedPenalty = Math.Round(unpaidBalance * 0.02m, 2);
            }

            string status = isPaid
                ? "PAID"
                : (isOverdue ? "OVERDUE" : "PENDING");

            schedule.Add(new AmortizationScheduleItemDto(
                installment,
                r.CutoffId,
                r.CutoffPeriod.Label,
                r.CutoffPeriod.CutoffDate,
                scheduledAmount,
                r.PrincipalPaid,
                remaining,
                status,
                r.LatePenaltyPaid,
                accruedPenalty,
                isDelayed,
                daysOverdue,
                r.PaymentDate,
                r.Notes
            ));

            installment++;
        }

        return Ok(schedule);
    }

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

        const int gracePeriodDays = 3;
        var paymentDate = request.PaymentDate ?? DateTime.UtcNow;
        var dueDateWithGrace = cutoff.CutoffDate.Date.AddDays(gracePeriodDays).AddHours(23).AddMinutes(59).AddSeconds(59);
        bool isDelayed = (paymentDate > dueDateWithGrace) || request.LatePenaltyPaid > 0;
        int daysOverdue = isDelayed ? Math.Max(0, (int)(paymentDate.Date - cutoff.CutoffDate.Date).TotalDays) : 0;

        var repayment = loan.Repayments.FirstOrDefault(r => r.CutoffId == request.CutoffId);
        if (repayment == null)
        {
            repayment = new LoanRepayment
            {
                LoanId = loan.Id,
                CutoffId = request.CutoffId,
                CutoffPeriod = cutoff,
                PrincipalPaid = 0.00m,
                LatePenaltyPaid = 0.00m
            };
            loan.Repayments.Add(repayment);
        }

        repayment.PrincipalPaid += request.PrincipalPaid;
        repayment.LatePenaltyPaid += request.LatePenaltyPaid;
        repayment.PaymentDate = paymentDate;
        repayment.RecordedAt = DateTime.UtcNow;
        repayment.IsDelayed = isDelayed;
        if (!string.IsNullOrWhiteSpace(request.Notes))
        {
            repayment.Notes = string.IsNullOrWhiteSpace(repayment.Notes)
                ? request.Notes
                : $"{repayment.Notes} | {request.Notes}";
        }

        // Check remaining balance on loan
        decimal totalPrincipalPaid = loan.Repayments.Sum(r => r.PrincipalPaid);
        decimal remainingBalance = Math.Max(0m, loan.PrincipalAmount - totalPrincipalPaid);

        if (remainingBalance == 0m)
        {
            loan.Status = LoanStatus.PAID;
        }
        else if (loan.Status == LoanStatus.PENDING_APPROVAL || loan.Status == LoanStatus.APPROVED)
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
            request.PrincipalPaid + request.LatePenaltyPaid,
            remainingBalance,
            repayment.IsDelayed,
            daysOverdue,
            repayment.PaymentDate,
            repayment.RecordedAt,
            loan.Status.ToString(),
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

        // Ensure schedule is populated if needed
        if (loan.Repayments.Count < loan.CutoffsCount && (loan.Status == LoanStatus.APPROVED || loan.Status == LoanStatus.ACTIVE))
        {
            var existingCutoffIds = loan.Repayments.Select(r => r.CutoffId).ToHashSet();
            var neededCount = loan.CutoffsCount - loan.Repayments.Count;
            var additionalCutoffs = await _context.CutoffPeriods
                .Where(c => c.CutoffDate >= loan.OriginationDate && !existingCutoffIds.Contains(c.Id))
                .OrderBy(c => c.CutoffDate)
                .Take(neededCount)
                .ToListAsync();

            foreach (var cutoff in additionalCutoffs)
            {
                loan.Repayments.Add(new LoanRepayment
                {
                    LoanId = loan.Id,
                    CutoffId = cutoff.Id,
                    CutoffPeriod = cutoff,
                    PrincipalPaid = 0.00m,
                    LatePenaltyPaid = 0.00m,
                    RecordedAt = DateTime.UtcNow
                });
            }
            await _context.SaveChangesAsync();
        }

        const int gracePeriodDays = 3;
        var repayments = loan.Repayments.OrderBy(r => r.CutoffPeriod.CutoffDate).ToList();
        var breakdown = new List<CutoffPenaltyDetailDto>();

        decimal totalAccruedPenalties = 0.00m;
        decimal totalLatePenaltiesPaid = 0.00m;
        int overdueCount = 0;
        int paidCount = 0;
        int installment = 1;

        foreach (var r in repayments)
        {
            decimal scheduledAmount = loan.CutoffPaymentAmount;
            if (installment == loan.CutoffsCount)
            {
                decimal sumPrevious = loan.CutoffPaymentAmount * (loan.CutoffsCount - 1);
                scheduledAmount = Math.Round(loan.PrincipalAmount - sumPrevious, 2);
            }

            var cutoffDate = r.CutoffPeriod.CutoffDate;
            var dueDateWithGrace = cutoffDate.Date.AddDays(gracePeriodDays).AddHours(23).AddMinutes(59).AddSeconds(59);

            bool isPaid = r.PrincipalPaid >= scheduledAmount;
            bool isPastGrace = DateTime.UtcNow > dueDateWithGrace;
            bool isOverdue = !isPaid && isPastGrace;

            bool isDelayed = r.IsDelayed || (isPaid && r.PaymentDate.HasValue && r.PaymentDate.Value > dueDateWithGrace) || r.LatePenaltyPaid > 0 || isOverdue;

            int daysLate = 0;
            if (isOverdue)
            {
                daysLate = Math.Max(0, (int)(DateTime.UtcNow.Date - cutoffDate.Date).TotalDays);
                overdueCount++;
            }
            else if (isDelayed && r.PaymentDate.HasValue)
            {
                daysLate = Math.Max(0, (int)(r.PaymentDate.Value.Date - cutoffDate.Date).TotalDays);
            }

            if (isPaid) paidCount++;

            decimal remainingCutoffBalance = Math.Max(0m, scheduledAmount - r.PrincipalPaid);
            decimal accruedPenalty = 0.00m;
            if (isOverdue)
            {
                accruedPenalty = Math.Round(remainingCutoffBalance * 0.02m, 2);
            }

            totalAccruedPenalties += accruedPenalty;
            totalLatePenaltiesPaid += r.LatePenaltyPaid;

            string status = isPaid ? "PAID" : (isOverdue ? "OVERDUE" : "PENDING");

            breakdown.Add(new CutoffPenaltyDetailDto(
                r.Id,
                r.CutoffId,
                r.CutoffPeriod.Label,
                cutoffDate,
                dueDateWithGrace,
                scheduledAmount,
                r.PrincipalPaid,
                remainingCutoffBalance,
                r.LatePenaltyPaid,
                accruedPenalty,
                isDelayed,
                isOverdue,
                daysLate,
                r.PaymentDate,
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
}
