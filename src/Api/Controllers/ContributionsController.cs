using System;
using System.Collections.Generic;
using System.Linq;
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

public class PatchContributionRequestDto
{
    public decimal Amount { get; set; }
    public Guid? MemberId { get; set; }
    public Guid? CutoffId { get; set; }
    public PaymentChannel? PaymentChannel { get; set; }
}

[Authorize]
[ApiController]
[Route("api/contributions")]
public class ContributionsController : ControllerBase
{
    private readonly IContributionService _contributionService;
    private readonly AppDbContext _context;
    private readonly IFinancialPolicyService _financialPolicyService;

    public ContributionsController(
        IContributionService contributionService,
        AppDbContext context,
        IFinancialPolicyService financialPolicyService)
    {
        _contributionService = contributionService;
        _context = context;
        _financialPolicyService = financialPolicyService;
    }

    /// <summary>
    /// Returns calling member's 24-cutoff contribution history, cumulative capital, and compliance metrics.
    /// </summary>
    [HttpGet("my-statement")]
    public async Task<ActionResult<MemberStatementDto>> GetMyStatement(
        [FromQuery] int? fiscalYear,
        CancellationToken cancellationToken)
    {
        var memberId = User.GetMemberId();
        if (!memberId.HasValue)
        {
            var currentUsername = User.Identity?.Name;
            var userAccount = await _context.Users
                .Include(u => u.Member)
                .FirstOrDefaultAsync(u => u.Username == currentUsername, cancellationToken);
            if (userAccount?.MemberId != null)
            {
                memberId = userAccount.MemberId;
            }
            else
            {
                var firstMember = await _context.Members
                    .OrderBy(m => m.MemberCode)
                    .FirstOrDefaultAsync(m => m.Status == MemberStatus.ACTIVE, cancellationToken);
                if (firstMember != null && userAccount != null)
                {
                    userAccount.MemberId = firstMember.Id;
                    await _context.SaveChangesAsync(cancellationToken);
                    memberId = firstMember.Id;
                }
                else
                {
                    return Forbid();
                }
            }
        }

        var member = await _context.Members
            .Include(m => m.Contributions)
                .ThenInclude(c => c.CutoffPeriod)
            .FirstOrDefaultAsync(m => m.Id == memberId.Value, cancellationToken);

        if (member == null)
        {
            return NotFound(new { message = "Member profile not found." });
        }

        int targetYear = fiscalYear ?? DateTime.UtcNow.Year;
        var cutoffs = await _context.CutoffPeriods
            .Where(c => c.FiscalYear == targetYear)
            .OrderBy(c => c.CutoffDate)
            .ToListAsync(cancellationToken);

        if (cutoffs.Count == 0)
        {
            cutoffs = await DbInitializer.EnsureFiscalYearCutoffsAsync(_context, targetYear, cancellationToken);
        }

        var policy = await _financialPolicyService.GetEffectiveLoanPolicyAsync(DateTime.UtcNow, cancellationToken);
        int graceDays = policy.ContributionGracePeriodDays;
        decimal penaltyRate = Math.Round(policy.LatePenaltyRatePercent / 100m, 4);

        var memberContribs = member.Contributions
            .Where(c => c.CutoffPeriod != null && c.CutoffPeriod.FiscalYear == targetYear)
            .GroupBy(c => c.CutoffId)
            .ToDictionary(g => g.Key, g => g.Last());

        var allContribs = member.Contributions.OrderByDescending(c => c.CreatedAt).ToList();
        decimal totalAccumulated = Math.Round(member.Contributions.Sum(c => c.Amount), 2);

        var now = DateTime.UtcNow;
        var schedule = new List<MemberCutoffIndicatorDto>(cutoffs.Count);
        int onTimeCount = 0;
        int overdueCount = 0;
        int contributedCount = 0;
        decimal totalPenalties = 0m;

        for (int i = 0; i < cutoffs.Count; i++)
        {
            var cutoff = cutoffs[i];
            bool hasContrib = memberContribs.TryGetValue(cutoff.Id, out var contrib);
            var graceDeadline = cutoff.CutoffDate.Date.AddDays(graceDays).AddHours(23).AddMinutes(59).AddSeconds(59);

            string status = "UPCOMING";
            int daysLate = 0;
            decimal penaltyAmount = 0m;

            if (hasContrib && contrib != null)
            {
                contributedCount++;
                if (contrib.CreatedAt > graceDeadline)
                {
                    status = "CONTRIBUTED_LATE";
                    daysLate = Math.Max(1, (int)(contrib.CreatedAt.Date - cutoff.CutoffDate.Date).TotalDays);
                    penaltyAmount = Math.Round(contrib.Amount * penaltyRate, 2);
                    totalPenalties += penaltyAmount;
                }
                else
                {
                    status = "CONTRIBUTED";
                    onTimeCount++;
                }
            }
            else
            {
                if (now > graceDeadline)
                {
                    status = "OVERDUE";
                    overdueCount++;
                    daysLate = Math.Max(1, (int)(now.Date - cutoff.CutoffDate.Date).TotalDays);
                    penaltyAmount = Math.Round(1000m * penaltyRate, 2);
                    totalPenalties += penaltyAmount;
                }
                else if (now >= cutoff.CutoffDate.Date && now <= graceDeadline)
                {
                    status = "GRACE_PERIOD";
                }
                else
                {
                    status = "UPCOMING";
                }
            }

            schedule.Add(new MemberCutoffIndicatorDto(
                cutoff.Id,
                cutoff.Label,
                i + 1,
                cutoff.CutoffDate,
                cutoff.FiscalYear,
                status,
                hasContrib ? contrib!.Amount : null,
                hasContrib ? contrib!.PaymentChannel : null,
                hasContrib ? contrib!.CreatedAt : null,
                daysLate,
                penaltyAmount
            ));
        }

        var remittanceLedger = allContribs.Select(c => new MemberContributionItemDto(
            c.Id,
            c.CutoffId,
            c.CutoffPeriod?.Label ?? "N/A",
            c.CutoffPeriod?.CutoffDate ?? c.CreatedAt,
            c.Amount,
            c.PaymentChannel,
            c.CreatedAt
        )).ToList();

        var dto = new MemberStatementDto(
            member.Id,
            member.MemberCode,
            $"{member.FirstName} {member.LastName}",
            member.Email,
            totalAccumulated,
            onTimeCount,
            overdueCount,
            contributedCount,
            totalPenalties,
            schedule,
            remittanceLedger
        );

        return Ok(dto);
    }

    /// <summary>
    /// Returns all members with their recorded contribution for the selected cutoff.
    /// </summary>
    [Authorize(Roles = "Admin,User")]
    [HttpGet("cutoff/{cutoffId:guid}")]
    public async Task<ActionResult<IEnumerable<CutoffMemberContributionDto>>> GetContributionsByCutoff(
        Guid cutoffId,
        CancellationToken cancellationToken)
    {
        var result = await _contributionService.GetCutoffContributionsAsync(cutoffId, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Inline auto-save endpoint: patches an existing contribution or creates one for the member and cutoff.
    /// </summary>
    [Authorize(Roles = "Admin,User")]
    [HttpPatch("{id}")]
    public async Task<IActionResult> PatchContribution(
        string id,
        [FromBody] PatchContributionRequestDto dto,
        CancellationToken cancellationToken)
    {
        if (dto.Amount < 0)
        {
            return BadRequest(new { detail = "Negative contribution amounts are prohibited." });
        }

        Contribution? contribution = null;

        if (dto.MemberId.HasValue && dto.CutoffId.HasValue)
        {
            contribution = await _context.Contributions
                .FirstOrDefaultAsync(c => c.MemberId == dto.MemberId.Value && c.CutoffId == dto.CutoffId.Value, cancellationToken);
        }

        if (contribution == null && Guid.TryParse(id, out var parsedGuid))
        {
            if (dto.CutoffId.HasValue)
            {
                contribution = await _context.Contributions
                    .FirstOrDefaultAsync(c => c.MemberId == parsedGuid && c.CutoffId == dto.CutoffId.Value, cancellationToken);
            }

            if (contribution == null && !dto.CutoffId.HasValue)
            {
                contribution = await _context.Contributions
                    .FirstOrDefaultAsync(c => c.Id == parsedGuid, cancellationToken);
            }
        }

        if (contribution != null)
        {
            var cutoff = await _context.CutoffPeriods.FirstOrDefaultAsync(c => c.Id == contribution.CutoffId, cancellationToken);
            if (cutoff != null && cutoff.IsClosed && contribution.Amount > 0m)
            {
                return BadRequest(new { detail = "This member has already contributed for this locked/finalized cutoff period." });
            }

            contribution.Amount = dto.Amount;
            if (dto.PaymentChannel.HasValue)
            {
                contribution.PaymentChannel = dto.PaymentChannel.Value;
            }
            contribution.CreatedAt = DateTime.UtcNow;
        }
        else
        {
            var memberId = dto.MemberId ?? (Guid.TryParse(id, out var mid) ? mid : Guid.Empty);
            var cutoffId = dto.CutoffId ?? Guid.Empty;

            if (memberId == Guid.Empty || cutoffId == Guid.Empty)
            {
                return BadRequest(new { detail = "Valid MemberId and CutoffId are required to record a contribution." });
            }

            var cutoff = await _context.CutoffPeriods.FirstOrDefaultAsync(c => c.Id == cutoffId, cancellationToken);
            if (cutoff == null)
            {
                return NotFound(new { detail = "Selected cutoff period was not found." });
            }

            contribution = new Contribution
            {
                Id = Guid.NewGuid(),
                MemberId = memberId,
                CutoffId = cutoffId,
                Amount = dto.Amount,
                PaymentChannel = dto.PaymentChannel ?? PaymentChannel.CASH,
                CreatedAt = DateTime.UtcNow
            };
            _context.Contributions.Add(contribution);
        }

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            contributionId = contribution.Id,
            id = contribution.Id,
            memberId = contribution.MemberId,
            cutoffId = contribution.CutoffId,
            amount = contribution.Amount,
            paymentChannel = contribution.PaymentChannel,
            recordedAt = contribution.CreatedAt
        });
    }

    /// <summary>
    /// Accepts a batch list of { memberId, cutoffId, amount } and transactionally upserts all records.
    /// </summary>
    [Authorize(Roles = "Admin,User")]
    [HttpPost("batch")]
    public async Task<ActionResult<BatchContributionResultDto>> BatchUpsertContributions(
        [FromBody] List<ContributionItemDto> items,
        CancellationToken cancellationToken)
    {
        var result = await _contributionService.BatchUpsertContributionsAsync(items, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Returns total cumulative contributions per member, active contributing members count, and grand total share capital.
    /// </summary>
    [Authorize(Roles = "Admin,User")]
    [HttpGet("summary")]
    public async Task<ActionResult<ContributionSummaryDto>> GetContributionsSummary(CancellationToken cancellationToken)
    {
        var summary = await _contributionService.GetSummaryAsync(cancellationToken);
        return Ok(summary);
    }

    /// <summary>
    /// Legacy flat listing of recorded contributions for audit and historical views.
    /// </summary>
    [Authorize(Roles = "Admin,User")]
    [HttpGet]
    public async Task<IActionResult> GetContributions(CancellationToken cancellationToken)
    {
        var contributions = await _context.Contributions
            .Include(c => c.Member)
            .Include(c => c.CutoffPeriod)
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => new
            {
                c.Id,
                c.MemberId,
                MemberName = $"{c.Member.FirstName} {c.Member.LastName}",
                MemberCode = c.Member.MemberCode,
                c.CutoffId,
                CutoffLabel = c.CutoffPeriod.Label,
                c.Amount,
                c.PaymentChannel,
                c.CreatedAt
            })
            .ToListAsync(cancellationToken);

        return Ok(contributions);
    }
}
