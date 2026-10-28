using System.Threading.Tasks;
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
    private readonly AppDbContext _context;

    public DistributionController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetDistributions()
    {
        var distributions = await _context.SurplusDistributions
            .Include(d => d.MemberLedgers)
            .ThenInclude(m => m.Member)
            .OrderByDescending(d => d.FiscalYear)
            .ToListAsync();

        return Ok(distributions);
    }
}
