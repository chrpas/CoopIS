using System;
using CoopIS.Domain.Enums;

namespace CoopIS.Application.DTOs;

public record LoginRequest(string Username, string Password);

public record UserDto(
    Guid Id,
    string Username,
    string Email,
    UserRole Role,
    Guid? MemberId = null,
    string? MemberCode = null,
    string? MemberName = null
);

public record LoginResponse(string Token, UserDto User);
