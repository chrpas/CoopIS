using System;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;

namespace CoopIS.Application.Services;

public interface IMemberService
{
    Task<PagedResult<MemberDto>> GetMembersAsync(MemberQueryParams queryParams, CancellationToken cancellationToken = default);
    Task<MemberDetailDto> GetMemberByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<MemberDto> CreateMemberAsync(CreateMemberRequest request, CancellationToken cancellationToken = default);
    Task<MemberDto> UpdateMemberAsync(Guid id, UpdateMemberRequest request, CancellationToken cancellationToken = default);
    Task<MemberDto> UpdateMemberStatusAsync(Guid id, UpdateMemberStatusRequest request, CancellationToken cancellationToken = default);
    Task DeleteOrSuspendMemberAsync(Guid id, CancellationToken cancellationToken = default);
}
