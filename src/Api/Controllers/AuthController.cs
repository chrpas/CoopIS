using System;
using System.Security.Claims;
using System.Threading.Tasks;
using BCrypt.Net;
using CoopIS.Application.Common;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using CoopIS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;

namespace CoopIS.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITokenService _tokenService;
    private readonly IPasswordHasher _passwordHasher;

    public AuthController(AppDbContext context, ITokenService tokenService, IPasswordHasher passwordHasher)
    {
        _context = context;
        _tokenService = tokenService;
        _passwordHasher = passwordHasher;
    }

    [AllowAnonymous]
    [EnableRateLimiting("LoginRateLimiter")]
    [HttpPost("login")]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Username) || string.IsNullOrWhiteSpace(request.Password))
        {
            return BadRequest(new { message = "Username and password are required." });
        }

        var normalized = request.Username.Trim().ToLower();
        var user = await _context.Users.FirstOrDefaultAsync(u =>
            u.Username.ToLower() == normalized || u.Email.ToLower() == normalized);

        if (user == null || !_passwordHasher.VerifyPassword(request.Password, user.PasswordHash))
        {
            return Unauthorized(new { message = "Invalid username/email or password." });
        }

        if (!user.IsActive)
        {
            return Unauthorized(new { message = "Your user account has been disabled." });
        }

        var token = _tokenService.GenerateJwtToken(user);
        var userDto = new UserDto(user.Id, user.Username, user.Email, user.Role);

        return Ok(new LoginResponse(token, userDto));
    }

    [Authorize(Roles = "Admin,User")]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> GetCurrentUser()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "Invalid token claims." });
        }

        var user = await _context.Users.FindAsync(userId);
        if (user == null || !user.IsActive)
        {
            return Unauthorized(new { message = "User not found or inactive." });
        }

        return Ok(new UserDto(user.Id, user.Username, user.Email, user.Role));
    }
}
