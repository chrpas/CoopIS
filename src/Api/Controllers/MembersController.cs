using System;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CoopIS.Api.Controllers;

[Authorize(Roles = "Admin,User")]
[ApiController]
[Route("api/members")]
public class MembersController : ControllerBase
{
    private readonly IMemberService _memberService;

    public MembersController(IMemberService memberService)
    {
        _memberService = memberService;
    }

    /// <summary>
    /// Gets a paginated list of members with search and sorting support.
    /// Accessible by Admin and User roles.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<PagedResult<MemberDto>>> GetMembers(
        [FromQuery] MemberQueryParams queryParams,
        CancellationToken cancellationToken)
    {
        var result = await _memberService.GetMembersAsync(queryParams, cancellationToken);
        return Ok(result);
    }

    /// <summary>
    /// Gets detailed profile, share contributions, and active loans for a specific member.
    /// Accessible by Admin and User roles.
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<MemberDetailDto>> GetMember(
        Guid id,
        CancellationToken cancellationToken)
    {
        var member = await _memberService.GetMemberByIdAsync(id, cancellationToken);
        return Ok(member);
    }

    /// <summary>
    /// Creates a new member with auto-generated or custom MemberCode.
    /// Admin only.
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<ActionResult<MemberDto>> CreateMember(
        [FromBody] CreateMemberRequest request,
        CancellationToken cancellationToken)
    {
        var created = await _memberService.CreateMemberAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetMember), new { id = created.Id }, created);
    }

    /// <summary>
    /// Updates member profile details.
    /// Admin only.
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpPut("{id:guid}")]
    public async Task<ActionResult<MemberDto>> UpdateMember(
        Guid id,
        [FromBody] UpdateMemberRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await _memberService.UpdateMemberAsync(id, request, cancellationToken);
        return Ok(updated);
    }

    /// <summary>
    /// Toggles or updates member status (ACTIVE, INACTIVE, SUSPENDED).
    /// Admin only.
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpPatch("{id:guid}/status")]
    public async Task<ActionResult<MemberDto>> UpdateMemberStatus(
        Guid id,
        [FromBody] UpdateMemberStatusRequest request,
        CancellationToken cancellationToken)
    {
        var updated = await _memberService.UpdateMemberStatusAsync(id, request, cancellationToken);
        return Ok(updated);
    }

    /// <summary>
    /// Deletes or soft-deletes/suspends a member if active loans or share contributions exist.
    /// Admin only.
    /// </summary>
    [Authorize(Roles = "Admin")]
    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> DeleteMember(
        Guid id,
        CancellationToken cancellationToken)
    {
        await _memberService.DeleteOrSuspendMemberAsync(id, cancellationToken);
        return Ok(new { message = "Member record has been processed successfully (suspended or removed)." });
    }
}
