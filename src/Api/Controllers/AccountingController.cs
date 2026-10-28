using System.Linq;
using System.Threading.Tasks;
using CoopIS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoopIS.Api.Controllers;

[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/accounting")]
public class AccountingController : ControllerBase
{
    private readonly AppDbContext _context;

    public AccountingController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("reconciliations")]
    public async Task<IActionResult> GetReconciliations()
    {
        var records = await _context.BankReconciliations
            .Include(b => b.CutoffPeriod)
            .OrderByDescending(b => b.StatementDate)
            .Select(b => new
            {
                b.Id,
                b.CutoffId,
                CutoffLabel = b.CutoffPeriod != null ? b.CutoffPeriod.Label : null,
                b.StatementDate,
                b.CashInBank,
                b.BankGrossInterest,
                b.WithholdingTax,
                b.NetBankInterest,
                b.ReconciledVariance,
                b.Notes,
                b.CreatedAt
            })
            .ToListAsync();

        return Ok(records);
    }
}
