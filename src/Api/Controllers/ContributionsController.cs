using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using CoopIS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoopIS.Api.Controllers;

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
