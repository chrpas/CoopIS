using System.Linq;
using System.Threading.Tasks;
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
    private readonly AppDbContext _context;

    public ContributionsController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<IActionResult> GetContributions()
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
            .ToListAsync();

        return Ok(contributions);
    }
}
