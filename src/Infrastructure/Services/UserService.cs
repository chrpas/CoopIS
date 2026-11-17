using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.Common;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using CoopIS.Domain.Entities;
using CoopIS.Domain.Enums;
using CoopIS.Domain.Exceptions;
using CoopIS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CoopIS.Infrastructure.Services;

public class UserService : IUserService
{
    private readonly AppDbContext _context;
    private readonly IPasswordHasher _passwordHasher;
    private readonly IEmailService _emailService;
    private readonly IEmailConfigurationService _emailConfigService;
    private readonly ILogger<UserService> _logger;

    public UserService(
        AppDbContext context,
        IPasswordHasher passwordHasher,
        IEmailService emailService,
        IEmailConfigurationService emailConfigService,
        ILogger<UserService> logger)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _emailService = emailService;
        _emailConfigService = emailConfigService;
        _logger = logger;
    }

    public async Task<IEnumerable<UserAccountDto>> GetAllUsersAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Users
            .AsNoTracking()
            .Include(u => u.Member)
            .OrderBy(u => u.Role == UserRole.Admin ? 0 : (u.Role == UserRole.User ? 1 : 2))
            .ThenBy(u => u.Username)
            .Select(u => new UserAccountDto(
                u.Id,
                u.Username,
                u.Email,
                u.Role,
                u.IsActive,
                u.CreatedAt,
                u.MemberId,
                u.Member != null ? u.Member.MemberCode : null,
                u.Member != null ? $"{u.Member.FirstName} {u.Member.LastName}" : null
            ))
            .ToListAsync(cancellationToken);
    }

    public async Task<UserAccountDto> GetUserByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .AsNoTracking()
            .Include(u => u.Member)
            .FirstOrDefaultAsync(u => u.Id == id, cancellationToken);

        if (user == null)
        {
            throw new NotFoundException($"User account with ID '{id}' was not found.");
        }

        return new UserAccountDto(
            user.Id,
            user.Username,
            user.Email,
            user.Role,
            user.IsActive,
            user.CreatedAt,
            user.MemberId,
            user.Member != null ? user.Member.MemberCode : null,
            user.Member != null ? $"{user.Member.FirstName} {user.Member.LastName}" : null
        );
    }

    public async Task<UserAccountDto> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken = default)
    {
        if (request == null)
        {
            throw new ValidationException("User creation request cannot be empty.");
        }

        var username = request.Username?.Trim() ?? string.Empty;
        var email = request.Email?.Trim() ?? string.Empty;
        var password = request.Password ?? string.Empty;

        if (string.IsNullOrWhiteSpace(username) || username.Length < 3)
        {
            throw new ValidationException("Username is required and must be at least 3 characters long.");
        }

        if (!Regex.IsMatch(username, @"^[a-zA-Z0-9_\.\-]+$"))
        {
            throw new ValidationException("Username can only contain alphanumeric characters, dots, dashes, and underscores.");
        }

        if (string.IsNullOrWhiteSpace(email) || !email.Contains('@'))
        {
            throw new ValidationException("A valid email address is required.");
        }

        if (string.IsNullOrWhiteSpace(password) || password.Length < 6)
        {
            throw new ValidationException("Password is required and must be at least 6 characters long.");
        }

        var usernameNormalized = username.ToLower();
        var emailNormalized = email.ToLower();

        var existingUser = await _context.Users.AnyAsync(
            u => u.Username.ToLower() == usernameNormalized,
            cancellationToken);

        if (existingUser)
        {
            throw new ValidationException($"Username '{username}' is already taken. Please choose another.");
        }

        var existingEmail = await _context.Users.AnyAsync(
            u => u.Email.ToLower() == emailNormalized,
            cancellationToken);

        if (existingEmail)
        {
            throw new ValidationException($"Email address '{email}' is already registered to another account.");
        }

        var passwordHash = _passwordHasher.HashPassword(password);

        // Generate a 24-hour password reset token so the user can immediately change their temporary password via the email link
        var tokenBytes = RandomNumberGenerator.GetBytes(32);
        var rawToken = Convert.ToHexString(tokenBytes).ToLowerInvariant();
        var tokenHash = ComputeSha256Hash(rawToken);

        var newUser = new UserAccount
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = email,
            PasswordHash = passwordHash,
            Role = request.Role,
            MemberId = request.MemberId,
            IsActive = true,
            PasswordResetTokenHash = tokenHash,
            PasswordResetTokenExpiresAt = DateTime.UtcNow.AddHours(24),
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("New user account '{Username}' ({Role}) created successfully with ID {UserId}.",
            newUser.Username, newUser.Role, newUser.Id);

        string? memberCode = null;
        string? memberName = null;
        if (newUser.MemberId.HasValue)
        {
            var m = await _context.Members.FirstOrDefaultAsync(x => x.Id == newUser.MemberId.Value, cancellationToken);
            if (m != null)
            {
                if (!string.Equals(m.Email, newUser.Email, StringComparison.OrdinalIgnoreCase))
                {
                    m.Email = newUser.Email;
                    m.UpdatedAt = DateTime.UtcNow;
                    await _context.SaveChangesAsync(cancellationToken);
                }
                memberCode = m.MemberCode;
                memberName = $"{m.FirstName} {m.LastName}".Trim();
            }
        }

        // Dispatch Portal Account Created notification email with Name, Username, Temporary Password, and Reset Password Link
        try
        {
            var emailSettings = await _emailConfigService.GetEffectiveSettingsAsync(cancellationToken);
            var frontendBaseUrl = string.IsNullOrWhiteSpace(emailSettings.FrontendBaseUrl)
                ? "http://localhost:5173"
                : emailSettings.FrontendBaseUrl.TrimEnd('/');

            var resetUrl = $"{frontendBaseUrl}/reset-password?token={Uri.EscapeDataString(rawToken)}&email={Uri.EscapeDataString(newUser.Email)}";
            var loginUrl = $"{frontendBaseUrl}/login";
            var displayName = !string.IsNullOrWhiteSpace(memberName) ? memberName : newUser.Username;

            var subject = "CoopIS - Your Cooperative Portal Account Credentials";
            var htmlBody = $@"<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
</head>
<body style='font-family:-apple-system,BlinkMacSystemFont,""Segoe UI"",Roboto,sans-serif;background:#0f172a;padding:24px 12px;margin:0;'>
  <div style='max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.2);'>
    <div style='background:#064e3b;padding:26px 28px;color:#ffffff;text-align:center;'>
      <div style='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6ee7b7;'>Portal Account Provisioned</div>
      <h2 style='margin:6px 0 4px 0;font-size:21px;font-weight:800;'>Welcome to CoopIS Portal</h2>
      <div style='font-size:13px;color:#d1fae5;'>Cooperative Financial &amp; Member Self-Service System</div>
    </div>

    <div style='padding:26px 28px;color:#1e293b;font-size:14px;line-height:1.6;'>
      <p style='margin-top:0;'>Hello <strong>{WebUtility.HtmlEncode(displayName)}</strong>,</p>
      <p style='color:#475569;font-size:13px;'>Your Cooperative Information System (CoopIS) portal account has been created. Below are your account credentials:</p>

      <table style='width:100%;border-collapse:collapse;margin:18px 0;font-size:13px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;'>
        <tr style='background:#f8fafc;'>
          <td style='padding:10px 14px;font-weight:700;color:#475569;width:160px;border-bottom:1px solid #e2e8f0;'>Name</td>
          <td style='padding:10px 14px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0;'>{WebUtility.HtmlEncode(displayName)}</td>
        </tr>
        <tr>
          <td style='padding:10px 14px;font-weight:700;color:#475569;border-bottom:1px solid #e2e8f0;'>Username</td>
          <td style='padding:10px 14px;font-family:monospace;font-weight:800;color:#059669;font-size:14px;border-bottom:1px solid #e2e8f0;'>{WebUtility.HtmlEncode(newUser.Username)}</td>
        </tr>
        <tr style='background:#f8fafc;'>
          <td style='padding:10px 14px;font-weight:700;color:#475569;border-bottom:1px solid #e2e8f0;'>Temporary Password</td>
          <td style='padding:10px 14px;font-family:monospace;font-weight:800;color:#0f172a;font-size:14px;border-bottom:1px solid #e2e8f0;'>{WebUtility.HtmlEncode(password)}</td>
        </tr>
        <tr>
          <td style='padding:10px 14px;font-weight:700;color:#475569;'>Portal Sign-In URL</td>
          <td style='padding:10px 14px;'><a href='{WebUtility.HtmlEncode(loginUrl)}' style='color:#059669;font-weight:600;'>{WebUtility.HtmlEncode(loginUrl)}</a></td>
        </tr>
      </table>

      <div style='background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:20px 0;'>
        <div style='font-weight:700;color:#14532d;font-size:13px;margin-bottom:6px;'>Want to change your temporary password right away?</div>
        <div style='color:#166534;font-size:12px;margin-bottom:14px;'>Click the button below to immediately set a new personal password for your account:</div>
        <div style='text-align:center;'>
          <a href='{WebUtility.HtmlEncode(resetUrl)}' target='_blank' style='display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:12px 24px;border-radius:10px;'>
            Change / Reset Password Now
          </a>
        </div>
        <div style='margin-top:12px;font-size:11px;color:#475569;word-break:break-all;'>
          <strong>Reset Password Link:</strong> <a href='{WebUtility.HtmlEncode(resetUrl)}' style='color:#059669;'>{WebUtility.HtmlEncode(resetUrl)}</a>
        </div>
      </div>

      <p style='font-size:12px;color:#64748b;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:12px;'>
        This is an automated account notification from CoopIS. Please keep your login credentials secure.
      </p>
    </div>
  </div>
</body>
</html>";

            await _emailService.SendEmailAsync(newUser.Email, subject, htmlBody, cancellationToken);
            _logger.LogInformation("Portal account welcome email dispatched to {Email} for user {Username}.", newUser.Email, newUser.Username);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to dispatch portal account welcome email to {Email} for user {Username}.", newUser.Email, newUser.Username);
            _context.Users.Remove(newUser);
            await _context.SaveChangesAsync(cancellationToken);
            throw new ValidationException($"User account could not be created because email dispatch failed: {ex.Message}");
        }

        return new UserAccountDto(
            newUser.Id,
            newUser.Username,
            newUser.Email,
            newUser.Role,
            newUser.IsActive,
            newUser.CreatedAt,
            newUser.MemberId,
            memberCode,
            memberName
        );
    }

    public async Task ResendMemberCredentialsAsync(Guid memberId, CancellationToken cancellationToken = default)
    {
        var member = await _context.Members.FirstOrDefaultAsync(m => m.Id == memberId, cancellationToken);
        if (member == null)
        {
            throw new NotFoundException($"Member with ID '{memberId}' was not found.");
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.MemberId == memberId, cancellationToken);
        if (user == null)
        {
            throw new NotFoundException($"No portal login account found for {member.FirstName} {member.LastName}. Please assign a login account first.");
        }

        // Generate fresh 24-hour password reset token
        var tokenBytes = RandomNumberGenerator.GetBytes(32);
        var rawToken = Convert.ToHexString(tokenBytes).ToLowerInvariant();
        var tokenHash = ComputeSha256Hash(rawToken);

        const string tempPassword = "member123";
        user.PasswordHash = _passwordHasher.HashPassword(tempPassword);
        user.PasswordResetTokenHash = tokenHash;
        user.PasswordResetTokenExpiresAt = DateTime.UtcNow.AddHours(24);
        user.Email = member.Email; // Keep in sync with member's current email

        await _context.SaveChangesAsync(cancellationToken);

        var emailSettings = await _emailConfigService.GetEffectiveSettingsAsync(cancellationToken);
        var frontendBaseUrl = string.IsNullOrWhiteSpace(emailSettings.FrontendBaseUrl)
            ? "http://localhost:5173"
            : emailSettings.FrontendBaseUrl.TrimEnd('/');

        var resetUrl = $"{frontendBaseUrl}/reset-password?token={Uri.EscapeDataString(rawToken)}&email={Uri.EscapeDataString(user.Email)}";
        var loginUrl = $"{frontendBaseUrl}/login";
        var displayName = $"{member.FirstName} {member.LastName}".Trim();

        var subject = "CoopIS - Your Cooperative Portal Account Credentials";
        var htmlBody = $@"<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
</head>
<body style='font-family:-apple-system,BlinkMacSystemFont,""Segoe UI"",Roboto,sans-serif;background:#0f172a;padding:24px 12px;margin:0;'>
  <div style='max-width:560px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 10px 25px rgba(0,0,0,0.2);'>
    <div style='background:#064e3b;padding:26px 28px;color:#ffffff;text-align:center;'>
      <div style='font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:0.08em;color:#6ee7b7;'>Portal Account Provisioned</div>
      <h2 style='margin:6px 0 4px 0;font-size:21px;font-weight:800;'>Welcome to CoopIS Portal</h2>
      <div style='font-size:13px;color:#d1fae5;'>Cooperative Financial &amp; Member Self-Service System</div>
    </div>

    <div style='padding:26px 28px;color:#1e293b;font-size:14px;line-height:1.6;'>
      <p style='margin-top:0;'>Hello <strong>{WebUtility.HtmlEncode(displayName)}</strong>,</p>
      <p style='color:#475569;font-size:13px;'>Your Cooperative Information System (CoopIS) portal account has been created. Below are your account credentials:</p>

      <table style='width:100%;border-collapse:collapse;margin:18px 0;font-size:13px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;'>
        <tr style='background:#f8fafc;'>
          <td style='padding:10px 14px;font-weight:700;color:#475569;width:160px;border-bottom:1px solid #e2e8f0;'>Name</td>
          <td style='padding:10px 14px;font-weight:700;color:#0f172a;border-bottom:1px solid #e2e8f0;'>{WebUtility.HtmlEncode(displayName)}</td>
        </tr>
        <tr>
          <td style='padding:10px 14px;font-weight:700;color:#475569;border-bottom:1px solid #e2e8f0;'>Username</td>
          <td style='padding:10px 14px;font-family:monospace;font-weight:800;color:#059669;font-size:14px;border-bottom:1px solid #e2e8f0;'>{WebUtility.HtmlEncode(user.Username)}</td>
        </tr>
        <tr style='background:#f8fafc;'>
          <td style='padding:10px 14px;font-weight:700;color:#475569;border-bottom:1px solid #e2e8f0;'>Temporary Password</td>
          <td style='padding:10px 14px;font-family:monospace;font-weight:800;color:#0f172a;font-size:14px;border-bottom:1px solid #e2e8f0;'>{WebUtility.HtmlEncode(tempPassword)}</td>
        </tr>
        <tr>
          <td style='padding:10px 14px;font-weight:700;color:#475569;'>Portal Sign-In URL</td>
          <td style='padding:10px 14px;'><a href='{WebUtility.HtmlEncode(loginUrl)}' style='color:#059669;font-weight:600;'>{WebUtility.HtmlEncode(loginUrl)}</a></td>
        </tr>
      </table>

      <div style='background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:16px;margin:20px 0;'>
        <div style='font-weight:700;color:#14532d;font-size:13px;margin-bottom:6px;'>Want to change your temporary password right away?</div>
        <div style='color:#166534;font-size:12px;margin-bottom:14px;'>Click the button below to immediately set a new personal password for your account:</div>
        <div style='text-align:center;'>
          <a href='{WebUtility.HtmlEncode(resetUrl)}' target='_blank' style='display:inline-block;background:#059669;color:#ffffff;text-decoration:none;font-weight:700;font-size:13px;padding:12px 24px;border-radius:10px;'>
            Change / Reset Password Now
          </a>
        </div>
        <div style='margin-top:12px;font-size:11px;color:#475569;word-break:break-all;'>
          <strong>Reset Password Link:</strong> <a href='{WebUtility.HtmlEncode(resetUrl)}' style='color:#059669;'>{WebUtility.HtmlEncode(resetUrl)}</a>
        </div>
      </div>

      <p style='font-size:12px;color:#64748b;margin-top:20px;border-top:1px solid #e2e8f0;padding-top:12px;'>
        This is an automated account notification from CoopIS. Please keep your login credentials secure.
      </p>
    </div>
  </div>
</body>
</html>";

        await _emailService.SendEmailAsync(user.Email, subject, htmlBody, cancellationToken);
        _logger.LogInformation("Portal credentials email resent to {Email} for user {Username}.", user.Email, user.Username);
    }

    private static string ComputeSha256Hash(string input)
    {
        using var sha256 = SHA256.Create();
        var bytes = sha256.ComputeHash(Encoding.UTF8.GetBytes(input));
        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    public async Task<UserAccountDto> UpdateUserRoleOrStatusAsync(
        Guid id,
        UpdateUserRoleOrStatusRequest request,
        Guid currentUserId,
        CancellationToken cancellationToken = default)
    {
        if (request == null)
        {
            throw new ValidationException("Update request cannot be empty.");
        }

        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user == null)
        {
            throw new NotFoundException($"User account with ID '{id}' was not found.");
        }

        // Safety rules for primary admin account
        var isPrimaryAdmin = user.Username.Equals("admin", StringComparison.OrdinalIgnoreCase);
        if (isPrimaryAdmin)
        {
            if (request.IsActive.HasValue && !request.IsActive.Value)
            {
                throw new ValidationException("The primary 'admin' account cannot be deactivated.");
            }
            if (request.Role.HasValue && request.Role.Value != UserRole.Admin)
            {
                throw new ValidationException("The primary 'admin' account cannot be demoted from Administrator.");
            }
        }

        // Safety rules for currently authenticated user
        if (user.Id == currentUserId)
        {
            if (request.IsActive.HasValue && !request.IsActive.Value)
            {
                throw new ValidationException("You cannot disable your own active user account.");
            }
            if (request.Role.HasValue && request.Role.Value != UserRole.Admin && user.Role == UserRole.Admin)
            {
                throw new ValidationException("You cannot remove your own Administrator privileges.");
            }
        }

        if (request.Role.HasValue)
        {
            user.Role = request.Role.Value;
        }

        if (request.IsActive.HasValue)
        {
            user.IsActive = request.IsActive.Value;
        }

        if (request.MemberId.HasValue)
        {
            user.MemberId = request.MemberId.Value;
        }

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("User '{Username}' updated (Role: {Role}, IsActive: {IsActive}).",
            user.Username, user.Role, user.IsActive);

        string? updatedMemberCode = null;
        string? updatedMemberName = null;
        if (user.MemberId.HasValue)
        {
            var m = await _context.Members.AsNoTracking().FirstOrDefaultAsync(x => x.Id == user.MemberId.Value, cancellationToken);
            updatedMemberCode = m?.MemberCode;
            updatedMemberName = m != null ? $"{m.FirstName} {m.LastName}" : null;
        }

        return new UserAccountDto(
            user.Id,
            user.Username,
            user.Email,
            user.Role,
            user.IsActive,
            user.CreatedAt,
            user.MemberId,
            updatedMemberCode,
            updatedMemberName
        );
    }

    public async Task DeleteOrDeactivateUserAsync(
        Guid id,
        Guid currentUserId,
        CancellationToken cancellationToken = default)
    {
        var user = await _context.Users.FirstOrDefaultAsync(u => u.Id == id, cancellationToken);
        if (user == null)
        {
            throw new NotFoundException($"User account with ID '{id}' was not found.");
        }

        if (user.Username.Equals("admin", StringComparison.OrdinalIgnoreCase))
        {
            throw new ValidationException("The primary 'admin' account is protected and cannot be deleted or deactivated.");
        }

        if (user.Id == currentUserId)
        {
            throw new ValidationException("You cannot delete or deactivate your own account.");
        }

        // Check if user has associated loan approvals or other records
        var hasLoanReferences = await _context.Loans.AnyAsync(l => l.ApprovedBy == id, cancellationToken);
        if (hasLoanReferences)
        {
            user.IsActive = false;
            _logger.LogInformation("User '{Username}' has associated records; soft-deactivated instead of deleted.", user.Username);
        }
        else
        {
            _context.Users.Remove(user);
            _logger.LogInformation("User '{Username}' deleted permanently.", user.Username);
        }

        await _context.SaveChangesAsync(cancellationToken);
    }
}
