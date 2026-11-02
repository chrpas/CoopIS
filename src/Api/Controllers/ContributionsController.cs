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

[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/contributions")]
public class ContributionsController : ControllerBase
{
    private readonly IContributionService _contributionService;
    private readonly AppDbContext _context;

    public ContributionsController(
        IContributionService contributionService,
        AppDbContext context)
    {
        _contributionService = contributionService;
        _context = context;
    }

    /// <summary>
    /// Returns all members with their recorded contribution for the selected cutoff.
    /// </summary>
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

        if (Guid.TryParse(id, out var parsedGuid))
        {
            contribution = await _context.Contributions
                .FirstOrDefaultAsync(c => c.Id == parsedGuid, cancellationToken);

            if (contribution == null && dto.CutoffId.HasValue)
            {
                contribution = await _context.Contributions
                    .FirstOrDefaultAsync(c => c.MemberId == parsedGuid && c.CutoffId == dto.CutoffId.Value, cancellationToken);
            }
        }

        if (contribution == null && dto.MemberId.HasValue && dto.CutoffId.HasValue)
        {
            contribution = await _context.Contributions
                .FirstOrDefaultAsync(c => c.MemberId == dto.MemberId.Value && c.CutoffId == dto.CutoffId.Value, cancellationToken);
        }

        if (contribution != null)
        {
            var cutoff = await _context.CutoffPeriods.FirstOrDefaultAsync(c => c.Id == contribution.CutoffId, cancellationToken);
            if (cutoff != null && cutoff.IsClosed)
            {
                return BadRequest(new { detail = "Cannot modify contributions for a locked/finalized cutoff period." });
            }

            contribution.Amount = dto.Amount;
            if (dto.PaymentChannel.HasValue)
            {
                contribution.PaymentChannel = dto.PaymentChannel.Value;
            }
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
            if (cutoff != null && cutoff.IsClosed)
            {
                return BadRequest(new { detail = "Cannot add contributions to a locked/finalized cutoff period." });
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
    [HttpGet("summary")]
    public async Task<ActionResult<ContributionSummaryDto>> GetContributionsSummary(CancellationToken cancellationToken)
    {
        var summary = await _contributionService.GetSummaryAsync(cancellationToken);
        return Ok(summary);
    }

    /// <summary>
    /// Legacy flat listing of recorded contributions for audit and historical views.
    /// </summary>
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
