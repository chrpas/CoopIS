using System;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
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
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CoopIS.Api.Controllers;

[ApiController]
[Route("api/auth")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITokenService _tokenService;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IEmailService _emailService;
    private readonly IConfiguration _configuration;
    private readonly ILogger<AuthController> _logger;

    public AuthController(
        AppDbContext context,
        ITokenService tokenService,
        IPasswordHasher passwordHasher,
        IEmailService emailService,
        IConfiguration configuration,
        ILogger<AuthController> logger)
    {
        _context = context;
        _tokenService = tokenService;
        _passwordHasher = passwordHasher;
        _emailService = emailService;
        _configuration = configuration;
        _logger = logger;
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
        var memberName = user.Member != null ? $"{user.Member.FirstName} {user.Member.LastName}".Trim() : null;
        var userDto = new UserDto(user.Id, user.Username, user.Email, user.Role, user.MemberId, user.Member?.MemberCode, memberName);

        return Ok(new LoginResponse(token, userDto));
    }

    [Authorize]
    [HttpGet("me")]
    public async Task<ActionResult<UserDto>> GetCurrentUser()
    {
        var userIdClaim = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue("sub");
        if (string.IsNullOrEmpty(userIdClaim) || !Guid.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized(new { message = "Invalid token claims." });
        }

        var user = await _context.Users
            .Include(u => u.Member)
            .FirstOrDefaultAsync(u => u.Id == userId);
        if (user == null || !user.IsActive)
        {
            return Unauthorized(new { message = "User not found or inactive." });
        }

        var memberName = user.Member != null ? $"{user.Member.FirstName} {user.Member.LastName}".Trim() : null;
        return Ok(new UserDto(user.Id, user.Username, user.Email, user.Role, user.MemberId, user.Member?.MemberCode, memberName));
    }

    [AllowAnonymous]
    [EnableRateLimiting("ForgotPasswordRateLimiter")]
    [HttpPost("forgot-password")]
    public async Task<ActionResult<AuthMessageResponse>> ForgotPassword([FromBody] ForgotPasswordRequest request, CancellationToken cancellationToken)
    {
        const string genericMessage = "If an account exists for that email, a reset link has been sent.";

        if (string.IsNullOrWhiteSpace(request?.Email))
        {
            return Ok(new AuthMessageResponse(genericMessage));
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _context.Users
            .Include(u => u.Member)
            .FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken);

        if (user != null && user.IsActive)
        {
            // 32-byte cryptographically secure token
            var tokenBytes = RandomNumberGenerator.GetBytes(32);
            var rawToken = Convert.ToHexString(tokenBytes).ToLowerInvariant();

            // Store SHA-256 hash in database with 15-minute expiration
            user.PasswordResetTokenHash = ComputeSha256Hash(rawToken);
            user.PasswordResetTokenExpiresAt = DateTime.UtcNow.AddMinutes(15);
            await _context.SaveChangesAsync(cancellationToken);

            var frontendUrl = Environment.GetEnvironmentVariable("FrontendUrl")
                ?? Environment.GetEnvironmentVariable("FRONTEND_URL")
                ?? _configuration["FrontendUrl"]
                ?? "http://localhost:5173";

            var resetUrl = $"{frontendUrl.TrimEnd('/')}/reset-password?token={Uri.EscapeDataString(rawToken)}&email={Uri.EscapeDataString(user.Email)}";
            var recipientName = user.Member != null
                ? $"{user.Member.FirstName} {user.Member.LastName}".Trim()
                : user.Username;

            try
            {
                await _emailService.SendPasswordResetEmailAsync(user.Email, resetUrl, recipientName, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to send password reset email to {Email}", user.Email);
            }
        }

        // Always return 200 OK with identical message to prevent email enumeration
        return Ok(new AuthMessageResponse(genericMessage));
    }

    [AllowAnonymous]
    [HttpPost("reset-password")]
    public async Task<ActionResult<AuthMessageResponse>> ResetPassword([FromBody] ResetPasswordRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request?.Email) || string.IsNullOrWhiteSpace(request?.Token) || string.IsNullOrWhiteSpace(request?.NewPassword))
        {
            return BadRequest(new { message = "Email, token, and new password are required." });
        }

        if (!IsStrongPassword(request.NewPassword))
        {
            return BadRequest(new { message = "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one number, and one special character." });
        }

        var normalizedEmail = request.Email.Trim().ToLowerInvariant();
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Email.ToLower() == normalizedEmail, cancellationToken);

        if (user == null || !user.IsActive || string.IsNullOrEmpty(user.PasswordResetTokenHash) || !user.PasswordResetTokenExpiresAt.HasValue)
        {
            return BadRequest(new { message = "Invalid or expired password reset token." });
        }

        if (user.PasswordResetTokenExpiresAt.Value < DateTime.UtcNow)
        {
            return BadRequest(new { message = "Invalid or expired password reset token." });
        }

        // Constant-time token hash verification
        var incomingHash = ComputeSha256Hash(request.Token.Trim());
        var incomingBytes = Encoding.UTF8.GetBytes(incomingHash);
        var storedBytes = Encoding.UTF8.GetBytes(user.PasswordResetTokenHash);

        if (!CryptographicOperations.FixedTimeEquals(incomingBytes, storedBytes))
        {
            return BadRequest(new { message = "Invalid or expired password reset token." });
        }

        // Update password hash and immediately invalidate single-use token
        user.PasswordHash = _passwordHasher.HashPassword(request.NewPassword);
        user.PasswordResetTokenHash = null;
        user.PasswordResetTokenExpiresAt = null;

        await _context.SaveChangesAsync(cancellationToken);

        return Ok(new AuthMessageResponse("Password has been successfully reset. You may now log in with your new credentials."));
    }

    private static string ComputeSha256Hash(string input)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static bool IsStrongPassword(string password)
    {
        if (string.IsNullOrWhiteSpace(password) || password.Length < 8) return false;
        bool hasUpper = false, hasLower = false, hasDigit = false, hasSpecial = false;
        foreach (var c in password)
        {
            if (char.IsUpper(c)) hasUpper = true;
            else if (char.IsLower(c)) hasLower = true;
            else if (char.IsDigit(c)) hasDigit = true;
            else if (!char.IsLetterOrDigit(c)) hasSpecial = true;
        }
        return hasUpper && hasLower && hasDigit && hasSpecial;
    }
}
