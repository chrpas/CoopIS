using System;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.Common;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using CoopIS.Domain.Enums;
using CoopIS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoopIS.Api.Controllers;

[Authorize(Roles = "Admin,User,Member")]
[ApiController]
[Route("api/distribution")]
public class DistributionController : ControllerBase
{
    private readonly IDistributionService _distributionService;
    private readonly AppDbContext _context;

    public DistributionController(
        IDistributionService distributionService,
        AppDbContext context)
    {
        _distributionService = distributionService;
        _context = context;
    }

    private async Task<Guid?> ResolveCallerMemberIdAsync(CancellationToken cancellationToken)
    {
        var memberId = User.GetMemberId();
        if (memberId.HasValue)
        {
            return memberId.Value;
        }

        var currentUsername = User.Identity?.Name;
        var userAccount = await _context.Users
            .Include(u => u.Member)
            .FirstOrDefaultAsync(u => u.Username == currentUsername, cancellationToken);

        if (userAccount?.MemberId != null)
        {
            return userAccount.MemberId;
        }

        var firstMember = await _context.Members
            .OrderBy(m => m.MemberCode)
            .FirstOrDefaultAsync(m => m.Status == MemberStatus.ACTIVE, cancellationToken);

        if (firstMember != null && userAccount != null)
        {
            userAccount.MemberId = firstMember.Id;
            await _context.SaveChangesAsync(cancellationToken);
            return firstMember.Id;
        }

        return null;
    }

    /// <summary>
    /// Simulates year-end surplus distribution and member dividend/patronage allocations without writing to DB.
    /// For Member role, scopes the returned allocations list strictly to the logged-in member.
    /// </summary>
    [HttpGet("preview/{fiscalYear:int}")]
    public async Task<ActionResult<DistributionPreviewDto>> GetPreview(
        int fiscalYear,
        CancellationToken cancellationToken)
    {
        var preview = await _distributionService.GetPreviewAsync(fiscalYear, cancellationToken);

        if (User.IsInRole("Member") && !User.IsInRole("Admin") && !User.IsInRole("User"))
        {
            var callerMemberId = await ResolveCallerMemberIdAsync(cancellationToken);
            if (!callerMemberId.HasValue)
            {
                return Forbid();
            }

            var scopedAllocations = preview.Allocations
                .Where(a => a.MemberId == callerMemberId.Value)
                .ToList();

            preview = preview with { Allocations = scopedAllocations };
        }

        return Ok(preview);
    }

    /// <summary>
    /// Allows Admin or Loan Officer (User role) to configure a member's carryover election prior to finalization.
    /// </summary>
    [Authorize(Roles = "Admin,User")]
    [HttpPut("{fiscalYear:int}/member/{memberId:guid}/carryover")]
    public async Task<ActionResult<MemberAllocationDto>> UpdateMemberCarryover(
        int fiscalYear,
        Guid memberId,
        [FromBody] UpdateMemberCarryoverRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await _distributionService.UpdateMemberCarryoverAsync(fiscalYear, memberId, request, cancellationToken);
        return Ok(updated);
    }

    /// <summary>
    /// Transactionally commits surplus distribution and member ledgers to DB, and locks fiscal cutoffs.
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpPost("finalize/{fiscalYear:int}")]
    public async Task<ActionResult<DistributionPreviewDto>> FinalizeDistribution(
        int fiscalYear,
        CancellationToken cancellationToken)
    {
        var result = await _distributionService.FinalizeDistributionAsync(fiscalYear, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Returns individual Member Statement of Account (SOA) and patronage certificate data.
    /// </summary>
    [HttpGet("member/{memberId:guid}/soa")]
    public async Task<ActionResult<MemberStatementOfAccountDto>> GetMemberSoa(
        Guid memberId,
        [FromQuery] int fiscalYear = 2026,
        CancellationToken cancellationToken = default)
    {
        if (User.IsInRole("Member") && !User.IsInRole("Admin") && !User.IsInRole("User"))
        {
            var callerMemberId = await ResolveCallerMemberIdAsync(cancellationToken);
            if (!callerMemberId.HasValue || callerMemberId.Value != memberId)
            {
                return Forbid();
            }
        }

        var soa = await _distributionService.GetMemberStatementOfAccountAsync(memberId, fiscalYear, cancellationToken);
        return Ok(soa);
    }

    /// <summary>
    /// Historical list of surplus distribution periods.
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpGet]
    public async Task<IActionResult> GetDistributions(CancellationToken cancellationToken)
    {
        var distributions = await _context.SurplusDistributions
            .Include(d => d.MemberLedgers)
            .ThenInclude(m => m.Member)
            .OrderByDescending(d => d.FiscalYear)
            .ToListAsync(cancellationToken);

        return Ok(distributions);
    }
}
