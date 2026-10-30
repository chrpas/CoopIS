using System;
using System.Collections.Generic;
using System.Linq;
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
    private readonly ILogger<UserService> _logger;

    public UserService(
        AppDbContext context,
        IPasswordHasher passwordHasher,
        ILogger<UserService> logger)
    {
        _context = context;
        _passwordHasher = passwordHasher;
        _logger = logger;
    }

    public async Task<IEnumerable<UserAccountDto>> GetAllUsersAsync(CancellationToken cancellationToken = default)
    {
        return await _context.Users
            .AsNoTracking()
            .OrderBy(u => u.Role == UserRole.Admin ? 0 : 1)
            .ThenBy(u => u.Username)
            .Select(u => new UserAccountDto(
                u.Id,
                u.Username,
                u.Email,
                u.Role,
                u.IsActive,
                u.CreatedAt
            ))
            .ToListAsync(cancellationToken);
    }

    public async Task<UserAccountDto> GetUserByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var user = await _context.Users
            .AsNoTracking()
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
            user.CreatedAt
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

        var newUser = new UserAccount
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = email,
            PasswordHash = passwordHash,
            Role = request.Role,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Users.Add(newUser);
        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("New user account '{Username}' ({Role}) created successfully with ID {UserId}.",
            newUser.Username, newUser.Role, newUser.Id);

        return new UserAccountDto(
            newUser.Id,
            newUser.Username,
            newUser.Email,
            newUser.Role,
            newUser.IsActive,
            newUser.CreatedAt
        );
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

        await _context.SaveChangesAsync(cancellationToken);

        _logger.LogInformation("User '{Username}' updated (Role: {Role}, IsActive: {IsActive}).",
            user.Username, user.Role, user.IsActive);

        return new UserAccountDto(
            user.Id,
            user.Username,
            user.Email,
            user.Role,
            user.IsActive,
            user.CreatedAt
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
