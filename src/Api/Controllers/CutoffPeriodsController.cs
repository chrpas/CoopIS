using System;
using System.Linq;
using System.Threading;
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
    public async Task<IActionResult> GetCutoffs([FromQuery] int? fiscalYear = null)
    {
        var query = _context.CutoffPeriods.AsQueryable();

        if (fiscalYear.HasValue)
        {
            query = query.Where(c => c.FiscalYear == fiscalYear.Value);
        }

        var cutoffs = await query
            .OrderBy(c => c.CutoffDate)
            .ToListAsync();

        return Ok(cutoffs);
    }

    /// <summary>
    /// Generates the 24 semi-monthly cutoff periods (Jan-15 through Dec-31) for the specified fiscal year if not yet created.
    /// </summary>
    [HttpPost("generate/{fiscalYear:int}")]
    [HttpPost("/api/cutoffs/generate/{fiscalYear:int}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GenerateFiscalYearCutoffs(int fiscalYear, CancellationToken cancellationToken)
    {
        if (fiscalYear < 2020 || fiscalYear > 2100)
        {
            return BadRequest(new { message = "Fiscal year must be between 2020 and 2100." });
        }

        bool alreadyExists = await _context.CutoffPeriods.AnyAsync(c => c.FiscalYear == fiscalYear, cancellationToken);
        var cutoffs = await DbInitializer.EnsureFiscalYearCutoffsAsync(_context, fiscalYear, cancellationToken);

        return Ok(new
        {
            message = alreadyExists
                ? $"Fiscal Year {fiscalYear} cutoff periods already exist ({cutoffs.Count} periods)."
                : $"Successfully generated {cutoffs.Count} semi-monthly cutoff periods for Fiscal Year {fiscalYear}.",
            fiscalYear,
            alreadyExists,
            count = cutoffs.Count,
            cutoffs
        });
    }

    /// <summary>
    /// Locks and finalizes a cutoff period so that contributions can no longer be edited.
    /// If all cutoffs for the fiscal year become closed, automatically rolls over and generates next fiscal year's cutoffs.
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

        var now = DateTime.UtcNow;
        var currentYear = now.Year;

        // 1. Year greater than current year cannot be locked
        if (cutoff.FiscalYear > currentYear)
        {
            return BadRequest(new
            {
                message = $"Cutoff '{cutoff.Label}' belongs to future Fiscal Year {cutoff.FiscalYear}. Future fiscal year periods cannot be locked."
            });
        }

        // 2. Cutoff date must have already passed by more than a day
        var daysPassed = (now.Date - cutoff.CutoffDate.Date).TotalDays;
        if (daysPassed <= 1)
        {
            return BadRequest(new
            {
                message = $"Cutoff '{cutoff.Label}' ({cutoff.CutoffDate:MMM dd, yyyy}) cannot be closed yet because today is {now:MMM dd, yyyy}. A cutoff period can only be closed once its cutoff date has passed by more than a day."
            });
        }

        // 3. Sequential requirement: All previous cutoffs must already be closed
        var previousOpenCutoff = await _context.CutoffPeriods
            .Where(c => c.CutoffDate < cutoff.CutoffDate && !c.IsClosed)
            .OrderBy(c => c.CutoffDate)
            .FirstOrDefaultAsync(cancellationToken);

        if (previousOpenCutoff != null)
        {
            return BadRequest(new
            {
                message = $"Cannot close cutoff '{cutoff.Label}' ({cutoff.CutoffDate:MMM dd, yyyy}) because previous cutoff '{previousOpenCutoff.Label}' ({previousOpenCutoff.CutoffDate:MMM dd, yyyy}) has not been closed yet. Cutoffs must be closed in sequential chronological order."
            });
        }

        cutoff.IsClosed = true;
        await _context.SaveChangesAsync(cancellationToken);

        // Check if all cutoffs in this fiscal year are now closed; if so, auto-generate next fiscal year
        bool anyOpenRemaining = await _context.CutoffPeriods
            .AnyAsync(c => c.FiscalYear == cutoff.FiscalYear && !c.IsClosed, cancellationToken);

        int? rolledOverToFiscalYear = null;
        if (!anyOpenRemaining)
        {
            int nextYear = cutoff.FiscalYear + 1;
            bool nextYearExisted = await _context.CutoffPeriods.AnyAsync(c => c.FiscalYear == nextYear, cancellationToken);
            await DbInitializer.EnsureFiscalYearCutoffsAsync(_context, nextYear, cancellationToken);
            if (!nextYearExisted)
            {
                rolledOverToFiscalYear = nextYear;
            }
        }

        string msg = rolledOverToFiscalYear.HasValue
            ? $"Cutoff '{cutoff.Label}' locked. All FY {cutoff.FiscalYear} cutoffs are now closed — FY {rolledOverToFiscalYear} cutoffs have been automatically generated!"
            : $"Cutoff '{cutoff.Label}' has been successfully locked and finalized.";

        return Ok(new
        {
            message = msg,
            cutoffId = cutoff.Id,
            isClosed = cutoff.IsClosed,
            rolledOverToFiscalYear
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

    /// <summary>
    /// Locks/Finalizes all cutoff periods for a given fiscal year.
    /// </summary>
    [HttpPost("fiscal-year/{fiscalYear:int}/finalize-all")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> FinalizeAllCutoffsForYear(int fiscalYear, CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var currentYear = now.Year;

        // 1. Year greater than current year cannot be locked
        if (fiscalYear > currentYear)
        {
            return BadRequest(new
            {
                message = $"Cannot lock cutoff periods for future Fiscal Year {fiscalYear}. Future fiscal years cannot be locked."
            });
        }

        var cutoffs = await _context.CutoffPeriods.Where(c => c.FiscalYear == fiscalYear).ToListAsync(cancellationToken);
        if (cutoffs.Count == 0)
        {
            return NotFound(new { message = $"No cutoff periods found for Fiscal Year {fiscalYear}." });
        }

        // 2. Check if any previous cutoff from a prior year is still open
        var priorOpenCutoff = await _context.CutoffPeriods
            .Where(c => c.FiscalYear < fiscalYear && !c.IsClosed)
            .OrderBy(c => c.CutoffDate)
            .FirstOrDefaultAsync(cancellationToken);

        if (priorOpenCutoff != null)
        {
            return BadRequest(new
            {
                message = $"Cannot lock all cutoff periods for FY {fiscalYear} because previous cutoff '{priorOpenCutoff.Label}' (FY {priorOpenCutoff.FiscalYear}) has not been closed yet. Cutoffs must be closed in sequential chronological order."
            });
        }

        // 3. Verify all open cutoffs have passed by more than a day
        var unpassedOpenCutoffs = cutoffs.Where(c => !c.IsClosed && (now.Date - c.CutoffDate.Date).TotalDays <= 1).ToList();
        if (unpassedOpenCutoffs.Any())
        {
            var firstUnpassed = unpassedOpenCutoffs.First();
            return BadRequest(new
            {
                message = $"Cannot lock all cutoff periods for FY {fiscalYear} because upcoming cutoff '{firstUnpassed.Label}' ({firstUnpassed.CutoffDate:MMM dd, yyyy}) has not yet passed by more than a day."
            });
        }

        var cutoffsToClose = cutoffs.Where(c => !c.IsClosed).ToList();
        foreach (var c in cutoffsToClose)
        {
            c.IsClosed = true;
        }
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            message = $"All {cutoffsToClose.Count} eligible cutoff periods for Fiscal Year {fiscalYear} have been locked.",
            fiscalYear,
            closedCount = cutoffs.Count(c => c.IsClosed)
        });
    }

    /// <summary>
    /// Reopens all cutoff periods for a given fiscal year.
    /// </summary>
    [HttpPost("fiscal-year/{fiscalYear:int}/reopen-all")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> ReopenAllCutoffsForYear(int fiscalYear, CancellationToken cancellationToken)
    {
        var cutoffs = await _context.CutoffPeriods.Where(c => c.FiscalYear == fiscalYear).ToListAsync(cancellationToken);
        if (cutoffs.Count == 0)
        {
            return NotFound(new { message = $"No cutoff periods found for Fiscal Year {fiscalYear}." });
        }

        foreach (var c in cutoffs)
        {
            c.IsClosed = false;
        }
        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            message = $"All {cutoffs.Count} cutoff periods for Fiscal Year {fiscalYear} have been reopened.",
            fiscalYear,
            openCount = cutoffs.Count
        });
    }
}
