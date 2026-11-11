using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.Common;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using CoopIS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoopIS.Api.Controllers;

[ApiController]
[Route("api/loans/queue")]
public class LoanQueueController : ControllerBase
{
    private readonly ILoanQueueService _loanQueueService;
    private readonly AppDbContext _context;

    public LoanQueueController(ILoanQueueService loanQueueService, AppDbContext context)
    {
        _loanQueueService = loanQueueService;
        _context = context;
    }

    /// <summary>
    /// Applies for a loan via the FIFO loan queue (Members and Admins).
    /// Validates loan amount against the 7-tier matrix and generates the next sequential QueueNumber.
    /// </summary>
    [HttpPost("apply")]
    [Authorize(Roles = "Member,Admin")]
    public async Task<ActionResult<LoanQueueEntryDto>> Apply(
        [FromBody] ApplyLoanQueueRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            Guid memberId;
            if (User.IsInRole("Member"))
            {
                var resolvedId = User.GetMemberId();
                if (!resolvedId.HasValue)
                {
                    var userId = User.GetUserId();
                    var userAccount = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
                    resolvedId = userAccount?.MemberId;
                }

                if (!resolvedId.HasValue)
                {
                    return BadRequest(new { message = "Authenticated member profile is not linked to a member record." });
                }
                memberId = resolvedId.Value;
            }
            else
            {
                if (!request.MemberId.HasValue || request.MemberId.Value == Guid.Empty)
                {
                    return BadRequest(new { message = "MemberId is required when originating queue entry as Admin." });
                }
                memberId = request.MemberId.Value;
            }

            var result = await _loanQueueService.ApplyAsync(memberId, request, cancellationToken);
            return Ok(result);
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }

    /// <summary>
    /// Retrieves all queued loan applications in sequential FIFO order (Admin only).
    /// </summary>
    [HttpGet]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<List<LoanQueueEntryDto>>> GetQueue(CancellationToken cancellationToken)
    {
        var queue = await _loanQueueService.GetQueueAsync(cancellationToken);
        return Ok(queue);
    }

    /// <summary>
    /// Retrieves the personal active queue position and live status for the authenticated member.
    /// </summary>
    [HttpGet("my-queue")]
    [Authorize]
    public async Task<ActionResult<MyQueueStatusDto>> GetMyQueue(CancellationToken cancellationToken)
    {
        var memberId = User.GetMemberId();
        if (!memberId.HasValue)
        {
            var userId = User.GetUserId();
            var userAccount = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
            memberId = userAccount?.MemberId;
        }

        if (!memberId.HasValue)
        {
            return Ok(new MyQueueStatusDto(
                ActiveEntry: null,
                QueuePosition: 0,
                TotalActiveInQueue: 0,
                EstimatedLiquidReserve: 0m,
                EstimatedFundingCutoff: null,
                HasActiveEntry: false
            ));
        }

        var status = await _loanQueueService.GetMyQueueStatusAsync(memberId.Value, cancellationToken);
        return Ok(status);
    }

    /// <summary>
    /// Gets active cooperative members eligible to act as co-makers (Accessible by Members and Admins).
    /// Automatically excludes the applying member themselves from the eligible list.
    /// </summary>
    [HttpGet("co-makers")]
    [Authorize(Roles = "Member,Admin")]
    public async Task<ActionResult<IEnumerable<CoMakerOptionDto>>> GetCoMakers(CancellationToken cancellationToken)
    {
        Guid? currentMemberId = null;
        if (User.IsInRole("Member"))
        {
            currentMemberId = User.GetMemberId();
            if (!currentMemberId.HasValue)
            {
                var userId = User.GetUserId();
                var userAccount = await _context.Users.FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);
                currentMemberId = userAccount?.MemberId;
            }
        }

        var coMakers = await _context.Members
            .AsNoTracking()
            .Where(m => m.Status == Domain.Enums.MemberStatus.ACTIVE)
            .Where(m => !currentMemberId.HasValue || m.Id != currentMemberId.Value)
            .OrderBy(m => m.LastName)
            .ThenBy(m => m.FirstName)
            .Select(m => new CoMakerOptionDto(
                m.Id,
                m.MemberCode,
                m.FirstName,
                m.LastName,
                $"{m.FirstName} {m.LastName} ({m.MemberCode})"
            ))
            .ToListAsync(cancellationToken);

        return Ok(coMakers);
    }

    /// <summary>
    /// Disburses a queued loan application once liquid reserves are verified (Admin only).
    /// Deducts principal from primary bank balance and transitions application to formal Loan with 5% interest and bi-monthly schedule.
    /// </summary>
    [HttpPost("{id:guid}/disburse")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<LoanResponseDto>> Disburse(
        Guid id,
        [FromQuery] Guid? bankAccountId,
        CancellationToken cancellationToken)
    {
        try
        {
            var adminUserId = User.GetUserId();
            var adminUser = await _context.Users.FirstOrDefaultAsync(u => u.Id == adminUserId, cancellationToken);
            Guid? adminMemberId = adminUser?.MemberId;

            var loan = await _loanQueueService.DisburseQueueEntryAsync(id, adminMemberId, bankAccountId, cancellationToken);
            return Ok(loan);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { message = ex.Message });
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = ex.InnerException?.Message ?? ex.Message });
        }
    }

    /// <summary>
    /// Updates the review status or administrative notes of a queue entry (Admin only).
    /// </summary>
    [HttpPut("{id:guid}/status")]
    [Authorize(Roles = "Admin")]
    public async Task<ActionResult<LoanQueueEntryDto>> UpdateStatus(
        Guid id,
        [FromBody] UpdateQueueStatusRequest request,
        CancellationToken cancellationToken)
    {
        try
        {
            var updated = await _loanQueueService.UpdateStatusAsync(id, request, cancellationToken);
            return Ok(updated);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { message = ex.Message });
        }
    }
}

