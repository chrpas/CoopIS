using System;
using CoopIS.Domain.Enums;

namespace CoopIS.Application.DTOs;

public record UserAccountDto(
    Guid Id,
    string Username,
    string Email,
    UserRole Role,
    bool IsActive,
    DateTime CreatedAt,
    Guid? MemberId = null,
    string? MemberCode = null,
    string? MemberName = null
);

public record CreateUserRequest(
    string Username,
    string Email,
    string Password,
    UserRole Role,
    Guid? MemberId = null
);

public record UpdateUserRoleOrStatusRequest(
    UserRole? Role,
    bool? IsActive,
    Guid? MemberId = null
);
