using System.Threading.Tasks;
using CoopIS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoopIS.Api.Controllers;

[Authorize(Roles = "Admin,User")]
[ApiController]
[Route("api/cutoff-periods")]
public class CutoffPeriodsController : ControllerBase
{
    private readonly AppDbContext _context;

    public CutoffPeriodsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetCutoffs()
    {
        var cutoffs = await _context.CutoffPeriods
            .OrderBy(c => c.CutoffDate)
            .ToListAsync();

        return Ok(cutoffs);
    }

    /// <summary>
    /// Locks and finalizes a cutoff period so that contributions can no longer be edited.
    /// </summary>
    [HttpPost("{id:guid}/finalize")]
    [HttpPost("/api/cutoffs/{id:guid}/finalize")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> FinalizeCutoff(Guid id, CancellationToken cancellationToken)
    {
        var cutoff = await _context.CutoffPeriods.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (cutoff == null)
        {
            return NotFound(new { message = $"Cutoff period with ID '{id}' was not found." });
        }

        cutoff.IsClosed = true;
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            message = $"Cutoff '{cutoff.Label}' has been successfully locked and finalized.",
            cutoffId = cutoff.Id,
            isClosed = cutoff.IsClosed
        });
    }

    /// <summary>
    /// Reopens a locked cutoff period.
    /// </summary>
    [HttpPost("{id:guid}/reopen")]
    [HttpPost("/api/cutoffs/{id:guid}/reopen")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ReopenCutoff(Guid id, CancellationToken cancellationToken)
    {
        var cutoff = await _context.CutoffPeriods.FirstOrDefaultAsync(c => c.Id == id, cancellationToken);
        if (cutoff == null)
        {
            return NotFound(new { message = $"Cutoff period with ID '{id}' was not found." });
        }

        cutoff.IsClosed = false;
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            message = $"Cutoff '{cutoff.Label}' has been reopened.",
            cutoffId = cutoff.Id,
            isClosed = cutoff.IsClosed
        });
    }
}
