using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CoopIS.Api.Controllers;

[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/accounting")]
public class AccountingController : ControllerBase
{
    private readonly IAccountingService _accountingService;

    public AccountingController(IAccountingService accountingService)
    {
        _accountingService = accountingService;
    }

    /// <summary>
    /// Returns real-time assets, liabilities, and equity (Statement of Financial Position).
    /// </summary>
    [HttpGet("balance-sheet")]
    public async Task<ActionResult<BalanceSheetDto>> GetBalanceSheet(CancellationToken cancellationToken)
    {
        var balanceSheet = await _accountingService.GetBalanceSheetAsync(cancellationToken);
        return Ok(balanceSheet);
    }

    /// <summary>
    /// Returns book balance, cash in bank, and variance mirroring the 'TOTAL FUND' sheet.
    /// </summary>
    [HttpGet("fund-reconciliation")]
    public async Task<ActionResult<FundReconciliationDto>> GetFundReconciliation(CancellationToken cancellationToken)
    {
        var recon = await _accountingService.GetFundReconciliationAsync(cancellationToken);
        return Ok(recon);
    }

    /// <summary>
    /// Submits bank statement balance, gross interest, and 20% withholding tax.
    /// </summary>
    [HttpPost("bank-recon")]
    public async Task<ActionResult<BankReconciliationDto>> CreateBankReconciliation(
        [FromBody] CreateBankReconRequest request,
        CancellationToken cancellationToken)
    {
        var result = await _accountingService.CreateBankReconciliationAsync(request, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Historical list of reconciled bank statements and variances.
    /// </summary>
    [HttpGet("reconciliations")]
    public async Task<ActionResult<IEnumerable<BankReconciliationDto>>> GetReconciliations(CancellationToken cancellationToken)
    {
        var records = await _accountingService.GetReconciliationsAsync(cancellationToken);
        return Ok(records);
    }
}
