using System;
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

    /// <summary>
    /// Simulates year-end surplus distribution and member dividend/patronage allocations without writing to DB.
    /// </summary>
    [HttpGet("preview/{fiscalYear:int}")]
    public async Task<ActionResult<DistributionPreviewDto>> GetPreview(
        int fiscalYear,
        CancellationToken cancellationToken)
    {
        var preview = await _distributionService.GetPreviewAsync(fiscalYear, cancellationToken);
        return Ok(preview);
    }

    /// <summary>
    /// Transactionally commits surplus distribution and member ledgers to DB, and locks fiscal cutoffs.
    /// </summary>
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
        var soa = await _distributionService.GetMemberStatementOfAccountAsync(memberId, fiscalYear, cancellationToken);
        return Ok(soa);
    }

    /// <summary>
    /// Historical list of surplus distribution periods.
    /// </summary>
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
