using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CoopIS.Api.Controllers;

[ApiController]
[Route("api/bank-accounts")]
[Authorize(Roles = "Admin")]
public class BankAccountsController : ControllerBase
{
    private readonly IBankAccountService _bankAccountService;

    public BankAccountsController(IBankAccountService bankAccountService)
    {
        _bankAccountService = bankAccountService;
    }

    /// <summary>
    /// Lists all registered cooperative bank accounts (Admin only).
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<List<BankAccountDto>>> GetAllAccounts(CancellationToken cancellationToken)
    {
        var accounts = await _bankAccountService.GetAllAccountsAsync(cancellationToken);
        return Ok(accounts);
    }

    /// <summary>
    /// Computes aggregate primary bank balances minus a 20% liquid reserve cushion and active queue demands (Admin only).
    /// </summary>
    [HttpGet("liquidity")]
    public async Task<ActionResult<LiquiditySummaryDto>> GetLiquiditySummary(CancellationToken cancellationToken)
    {
        var summary = await _bankAccountService.GetLiquiditySummaryAsync(cancellationToken);
        return Ok(summary);
    }

    /// <summary>
    /// Retrieves a single bank account by ID (Admin only).
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<BankAccountDto>> GetAccountById(Guid id, CancellationToken cancellationToken)
    {
        var account = await _bankAccountService.GetAccountByIdAsync(id, cancellationToken);
        if (account == null)
        {
            return NotFound(new { message = $"Bank account with ID '{id}' was not found." });
        }
        return Ok(account);
    }

    /// <summary>
    /// Registers a new cooperative bank account (Admin only).
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<BankAccountDto>> CreateAccount(
        [FromBody] CreateBankAccountRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var created = await _bankAccountService.CreateAccountAsync(request, cancellationToken);
            return CreatedAtAction(nameof(GetAccountById), new { id = created.Id }, created);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Adjusts or reconciles a bank account balance with audit logging (Admin only).
    /// </summary>
    [HttpPut("{id:guid}/balance")]
    public async Task<ActionResult<BankAccountDto>> AdjustBalance(
        Guid id,
        [FromBody] AdjustBankBalanceRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            string adjustedBy = User.Identity?.Name ?? "Admin";
            var updated = await _bankAccountService.AdjustBalanceAsync(id, request, adjustedBy, cancellationToken);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Deletes a bank account (Admin only).
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteAccount(Guid id, CancellationToken cancellationToken)
    {
        bool deleted = await _bankAccountService.DeleteAccountAsync(id, cancellationToken);
        if (!deleted)
        {
            return NotFound(new { message = $"Bank account with ID '{id}' was not found." });
        }
        return NoContent();
    }
}

