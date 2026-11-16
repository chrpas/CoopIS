using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
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
[Route("api/accounting")]
public class AccountingController : ControllerBase
{
    private readonly IAccountingService _accountingService;
    private readonly AppDbContext _context;

    public AccountingController(IAccountingService accountingService, AppDbContext context)
    {
        _accountingService = accountingService;
        _context = context;
    }

    /// <summary>
    /// Returns aggregate cooperative dashboard KPI metrics without exposing individual member loan records.
    /// </summary>
    [HttpGet("dashboard-summary")]
    public async Task<ActionResult<DashboardSummaryDto>> GetDashboardSummary(CancellationToken cancellationToken)
    {
        var totalMembersCount = await _context.Members.CountAsync(cancellationToken);
        var activeMembersCount = await _context.Members.CountAsync(m => m.Status == MemberStatus.ACTIVE, cancellationToken);
        var totalLoansCount = await _context.Loans.CountAsync(cancellationToken);
        var totalLoanPrincipal = await _context.Loans.SumAsync(l => (decimal?)l.PrincipalAmount, cancellationToken) ?? 0m;
        var totalInterestEarned = await _context.Loans.SumAsync(l => (decimal?)l.InterestEarned, cancellationToken) ?? 0m;
        var totalRepayments = await _context.LoanRepayments.SumAsync(r => (decimal?)r.PrincipalPaid, cancellationToken) ?? 0m;

        return Ok(new DashboardSummaryDto(
            ActiveMembersCount: activeMembersCount,
            TotalMembersCount: totalMembersCount,
            TotalLoanPrincipal: totalLoanPrincipal,
            TotalLoansCount: totalLoansCount,
            TotalInterestEarned: totalInterestEarned,
            TotalRepayments: totalRepayments
        ));
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
    [Authorize(Roles = "Admin")]
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
