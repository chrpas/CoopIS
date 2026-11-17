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
    private readonly IEmailService _emailService;

    public ContributionsController(
        IContributionService contributionService,
        AppDbContext context,
        IFinancialPolicyService financialPolicyService,
        IEmailService emailService)
    {
        _contributionService = contributionService;
        _context = context;
        _financialPolicyService = financialPolicyService;
        _emailService = emailService;
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

    /// <summary>
    /// Dispatches a Contribution Statement & Cutoff Notification email to the member containing:
    /// 1. All delayed cutoffs plus late penalty
    /// 2. Current cutoff
    /// 3. Total amount due (All Delayed + Penalties + Current Cutoff)
    /// 4. Immediate upcoming cutoff (FYI only)
    /// </summary>
    [Authorize(Roles = "Admin,User")]
    [HttpPost("member/{memberId:guid}/notify")]
    public async Task<IActionResult> SendContributionNotification(
        Guid memberId,
        [FromQuery] int? fiscalYear,
        CancellationToken cancellationToken)
    {
        var member = await _context.Members
            .Include(m => m.Contributions)
                .ThenInclude(c => c.CutoffPeriod)
            .FirstOrDefaultAsync(m => m.Id == memberId, cancellationToken);

        if (member == null)
        {
            return NotFound(new { message = "Member profile not found." });
        }

        if (string.IsNullOrWhiteSpace(member.Email))
        {
            return BadRequest(new { message = "Member does not have a registered email address." });
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
        decimal penaltyRatePercent = policy.LatePenaltyRatePercent;
        decimal penaltyRate = Math.Round(penaltyRatePercent / 100m, 4);

        var positiveContribs = member.Contributions.Where(c => c.Amount > 0m).ToList();
        decimal expectedPerCutoff = positiveContribs.Count > 0
            ? Math.Round(positiveContribs.Average(c => c.Amount), 2)
            : 2000.00m;

        var memberContribs = member.Contributions
            .Where(c => c.CutoffPeriod != null && c.CutoffPeriod.FiscalYear == targetYear && c.Amount > 0m)
            .GroupBy(c => c.CutoffId)
            .ToDictionary(g => g.Key, g => g.Last());

        var now = DateTime.UtcNow;

        var delayedCutoffs = new List<(string Label, DateTime CutoffDate, int DaysLate, decimal BaseAmount, decimal PenaltyAmount, decimal TotalAmount)>();
        int currentIdx = -1;

        for (int i = 0; i < cutoffs.Count; i++)
        {
            var cutoff = cutoffs[i];
            var graceDeadline = cutoff.CutoffDate.Date.AddDays(graceDays).AddHours(23).AddMinutes(59).AddSeconds(59);
            bool hasContrib = memberContribs.ContainsKey(cutoff.Id);

            if (now > graceDeadline)
            {
                if (!hasContrib)
                {
                    int daysLate = Math.Max(1, (int)(now.Date - cutoff.CutoffDate.Date).TotalDays);
                    decimal penalty = Math.Round(expectedPerCutoff * penaltyRate, 2);
                    delayedCutoffs.Add((
                        cutoff.Label,
                        cutoff.CutoffDate,
                        daysLate,
                        expectedPerCutoff,
                        penalty,
                        expectedPerCutoff + penalty
                    ));
                }
            }
            else if (currentIdx == -1)
            {
                currentIdx = i;
            }
        }

        // Fallback if all cutoffs in the selected fiscal year have passed
        if (currentIdx == -1 && cutoffs.Count > 0)
        {
            currentIdx = cutoffs.Count - 1;
        }

        CutoffPeriod? currentCutoff = currentIdx >= 0 && currentIdx < cutoffs.Count ? cutoffs[currentIdx] : null;
        bool currentHasContrib = currentCutoff != null && memberContribs.TryGetValue(currentCutoff.Id, out _);
        decimal currentCutoffDue = currentCutoff != null && !currentHasContrib ? expectedPerCutoff : 0.00m;

        CutoffPeriod? upcomingCutoff = currentIdx >= 0 && (currentIdx + 1) < cutoffs.Count ? cutoffs[currentIdx + 1] : null;

        decimal totalDelayedBase = delayedCutoffs.Sum(d => d.BaseAmount);
        decimal totalDelayedPenalty = delayedCutoffs.Sum(d => d.PenaltyAmount);
        decimal totalDelayedWithPenalty = totalDelayedBase + totalDelayedPenalty;
        decimal grandTotalDue = totalDelayedWithPenalty + currentCutoffDue;

        var delayedRowsHtml = new StringBuilder();
        if (delayedCutoffs.Count == 0)
        {
            delayedRowsHtml.AppendLine("<tr><td colspan='5' style='padding:12px;text-align:center;color:#059669;font-weight:600;background:#ecfdf5;'>No delayed or overdue contribution cutoffs. Great job!</td></tr>");
        }
        else
        {
            foreach (var d in delayedCutoffs)
            {
                delayedRowsHtml.AppendLine($@"
                <tr>
                  <td style='padding:8px 10px;border-bottom:1px solid #f1f5f9;font-family:monospace;font-weight:700;color:#0f172a;'>{WebUtility.HtmlEncode(d.Label)}</td>
                  <td style='padding:8px 10px;border-bottom:1px solid #f1f5f9;color:#475569;'>{d.CutoffDate:MMM dd, yyyy} <span style='color:#dc2626;font-size:11px;font-weight:700;'>({d.DaysLate}d late)</span></td>
                  <td style='padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;color:#0f172a;'>₱{d.BaseAmount:N2}</td>
                  <td style='padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;color:#dc2626;font-weight:700;'>+₱{d.PenaltyAmount:N2}</td>
                  <td style='padding:8px 10px;border-bottom:1px solid #f1f5f9;text-align:right;font-family:monospace;font-weight:800;color:#991b1b;'>₱{d.TotalAmount:N2}</td>
                </tr>");
            }
            delayedRowsHtml.AppendLine($@"
            <tr style='background:#fef2f2;font-weight:700;'>
              <td colspan='2' style='padding:10px;color:#991b1b;'>Subtotal — Delayed Cutoffs ({delayedCutoffs.Count})</td>
              <td style='padding:10px;text-align:right;font-family:monospace;color:#0f172a;'>₱{totalDelayedBase:N2}</td>
              <td style='padding:10px;text-align:right;font-family:monospace;color:#dc2626;'>+₱{totalDelayedPenalty:N2}</td>
              <td style='padding:10px;text-align:right;font-family:monospace;color:#991b1b;'>₱{totalDelayedWithPenalty:N2}</td>
            </tr>");
        }

        string currentCutoffHtml = currentCutoff == null
            ? "<p style='color:#64748b;font-size:13px;margin:0;'>No active cutoff period scheduled.</p>"
            : $@"
            <table style='width:100%;border-collapse:collapse;font-size:13px;'>
              <tr>
                <td style='padding:8px 10px;color:#64748b;font-weight:600;'>Cutoff Period:</td>
                <td style='padding:8px 10px;font-family:monospace;font-weight:700;color:#0f172a;'>{WebUtility.HtmlEncode(currentCutoff.Label)} ({currentCutoff.CutoffDate:MMM dd, yyyy})</td>
              </tr>
              <tr>
                <td style='padding:8px 10px;color:#64748b;font-weight:600;'>Grace Deadline ({graceDays}d):</td>
                <td style='padding:8px 10px;color:#0f172a;'>{currentCutoff.CutoffDate.Date.AddDays(graceDays):MMM dd, yyyy}</td>
              </tr>
              <tr>
                <td style='padding:8px 10px;color:#64748b;font-weight:600;'>Status:</td>
                <td style='padding:8px 10px;font-weight:700;color:{(currentHasContrib ? "#059669" : "#d97706")};'>{(currentHasContrib ? "Already Remitted" : "Due / Open for Remittance")}</td>
              </tr>
              <tr style='background:#f8fafc;'>
                <td style='padding:10px;font-weight:700;color:#0f172a;'>Current Cutoff Amount Due:</td>
                <td style='padding:10px;font-family:monospace;font-weight:800;font-size:15px;color:#0f172a;'>₱{currentCutoffDue:N2}</td>
              </tr>
            </table>";

        string upcomingCutoffHtml = upcomingCutoff == null
            ? "<p style='color:#64748b;font-size:13px;margin:0;'>No further upcoming cutoff in this fiscal year.</p>"
            : $@"
            <table style='width:100%;border-collapse:collapse;font-size:13px;'>
              <tr>
                <td style='padding:6px 10px;color:#0369a1;font-weight:600;'>Next Cutoff Period (FYI):</td>
                <td style='padding:6px 10px;font-family:monospace;font-weight:700;color:#0c4a6e;'>{WebUtility.HtmlEncode(upcomingCutoff.Label)} — {upcomingCutoff.CutoffDate:MMM dd, yyyy}</td>
              </tr>
              <tr>
                <td style='padding:6px 10px;color:#0369a1;font-weight:600;'>Scheduled Contribution (FYI):</td>
                <td style='padding:6px 10px;font-family:monospace;font-weight:700;color:#0c4a6e;'>₱{expectedPerCutoff:N2} <span style='font-size:11px;font-weight:500;color:#0284c7;'>(Not included in Total Due above)</span></td>
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

        var fullName = $"{member.FirstName} {member.LastName}";
        var subject = $"CoopIS - Share Capital Contribution Statement & Cutoff Notice ({member.MemberCode})";

        var htmlBody = $@"<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
</head>
<body style='font-family:-apple-system,BlinkMacSystemFont,""Segoe UI"",Roboto,sans-serif;background:#0f172a;padding:24px 12px;margin:0;'>
  <div style='max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.2);'>
    <div style='background:#064e3b;padding:24px 28px;color:#ffffff;'>
      <div style='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6ee7b7;'>Share Capital Contribution Notice</div>
      <h2 style='margin:6px 0 4px 0;font-size:20px;font-weight:800;'>CoopIS Contribution Cutoff Statement</h2>
      <div style='font-size:13px;color:#d1fae5;'>Member: <strong>{WebUtility.HtmlEncode(fullName)}</strong> ({WebUtility.HtmlEncode(member.MemberCode)}) • FY {targetYear}</div>
    </div>

    <div style='padding:24px 28px;color:#1e293b;font-size:14px;line-height:1.5;'>
      <p style='margin-top:0;'>Hello <strong>{WebUtility.HtmlEncode(fullName)}</strong>,</p>
      <p style='color:#475569;font-size:13px;'>Below is your updated cooperative share capital contribution statement covering any delayed cutoffs (with the {penaltyRatePercent:0.#}% late penalty after the {graceDays}-day grace period), your current cutoff, and your immediate upcoming cutoff for your reference.</p>

      <!-- 1. Delayed Cutoffs -->
      <h3 style='font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#991b1b;margin:20px 0 8px 0;border-bottom:2px solid #fecaca;padding-bottom:6px;'>
        1. Delayed Cutoffs + Late Penalty ({penaltyRatePercent:0.#}%)
      </h3>
      <table style='width:100%;border-collapse:collapse;font-size:12px;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;'>
        <thead>
          <tr style='background:#f8fafc;color:#475569;text-transform:uppercase;font-size:11px;'>
            <th style='padding:8px 10px;text-align:left;'>Cutoff</th>
            <th style='padding:8px 10px;text-align:left;'>Cutoff Date</th>
            <th style='padding:8px 10px;text-align:right;'>Contribution</th>
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
        This is an automated cooperative statement notification from CoopIS. Please contact your Cooperative Administrator or Loan Officer if you have recently remitted payment.
      </p>
    </div>
  </div>
</body>
</html>";

        try
        {
            await _emailService.SendEmailAsync(member.Email.Trim(), subject, htmlBody, cancellationToken);
            return Ok(new
            {
                success = true,
                message = $"Contribution notification email sent to {member.FirstName} {member.LastName} ({member.Email}).",
                delayedCount = delayedCutoffs.Count,
                totalDue = grandTotalDue
            });
        }
        catch (Exception ex)
        {
            return BadRequest(new { message = $"Failed to send contribution notification email: {ex.Message}" });
        }
    }
}
