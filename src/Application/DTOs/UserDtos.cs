using System;
using CoopIS.Domain.Enums;

namespace CoopIS.Application.DTOs;

public record UserAccountDto(
    Guid Id,
    string Username,
    string Email,
    UserRole Role,
    bool IsActive,
    DateTime CreatedAt
);

public record CreateUserRequest(
    string Username,
    string Email,
    string Password,
    UserRole Role
);

public record UpdateUserRoleOrStatusRequest(
    UserRole? Role,
    bool? IsActive
);
