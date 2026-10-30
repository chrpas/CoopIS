using System;
using System.Collections.Generic;
using System.Security.Claims;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CoopIS.Api.Controllers;

[Authorize(Roles = "Admin")]
[ApiController]
[Route("api/users")]
public class UsersController : ControllerBase
{
    private readonly IUserService _userService;

    public UsersController(IUserService userService)
    {
        _userService = userService;
    }

    /// <summary>
    /// Gets all registered system user accounts.
    /// Admin only.
    /// </summary>
    [HttpGet]
    public async Task<ActionResult<IEnumerable<UserAccountDto>>> GetAllUsers(CancellationToken cancellationToken)
    {
        var users = await _userService.GetAllUsersAsync(cancellationToken);
        return Ok(users);
    }

    /// <summary>
    /// Gets a single user account by its identifier.
    /// Admin only.
    /// </summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<UserAccountDto>> GetUserById(Guid id, CancellationToken cancellationToken)
    {
        var user = await _userService.GetUserByIdAsync(id, cancellationToken);
        return Ok(user);
    }

    /// <summary>
    /// Creates a new system user / operator account.
    /// Admin only.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<UserAccountDto>> CreateUser(
        [FromBody] CreateUserRequest request,
        CancellationToken cancellationToken)
    {
        var created = await _userService.CreateUserAsync(request, cancellationToken);
        return CreatedAtAction(nameof(GetUserById), new { id = created.Id }, created);
    }

    /// <summary>
    /// Updates a user's role or toggles their active status.
    /// Admin only.
    /// </summary>
    [HttpPut("{id:guid}/role")]
    public async Task<ActionResult<UserAccountDto>> UpdateUserRoleOrStatus(
        Guid id,
        [FromBody] UpdateUserRoleOrStatusRequest request,
        CancellationToken cancellationToken)
    {
        var currentUserId = GetCurrentUserId();
        var updated = await _userService.UpdateUserRoleOrStatusAsync(id, request, currentUserId, cancellationToken);
        return Ok(updated);
    }

    /// <summary>
    /// Deactivates or removes a user account (primary admin is protected).
    /// Admin only.
    /// </summary>
    [HttpDelete("{id:guid}")]
    public async Task<ActionResult> DeleteOrDeactivateUser(Guid id, CancellationToken cancellationToken)
    {
        var currentUserId = GetCurrentUserId();
        await _userService.DeleteOrDeactivateUserAsync(id, currentUserId, cancellationToken);
        return Ok(new { message = "User account processed successfully." });
    }

    private Guid GetCurrentUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (!string.IsNullOrEmpty(claim) && Guid.TryParse(claim, out var id))
        {
            return id;
        }
        return Guid.Empty;
    }
}
