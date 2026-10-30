using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;

namespace CoopIS.Application.Services;

public interface IUserService
{
    Task<IEnumerable<UserAccountDto>> GetAllUsersAsync(CancellationToken cancellationToken = default);
    Task<UserAccountDto> GetUserByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<UserAccountDto> CreateUserAsync(CreateUserRequest request, CancellationToken cancellationToken = default);
    Task<UserAccountDto> UpdateUserRoleOrStatusAsync(Guid id, UpdateUserRoleOrStatusRequest request, Guid currentUserId, CancellationToken cancellationToken = default);
    Task DeleteOrDeactivateUserAsync(Guid id, Guid currentUserId, CancellationToken cancellationToken = default);
}
