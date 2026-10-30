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
}
