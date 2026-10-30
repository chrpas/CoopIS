using System;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;

namespace CoopIS.Application.Services;

public interface IRemoteAccessService
{
    Task<RemoteAccessStatusDto> GetStatusAsync(CancellationToken cancellationToken = default);
    Task<RemoteAccessSettingsDto> GetSettingsAsync(CancellationToken cancellationToken = default);
    Task<RemoteAccessSettingsDto> UpdateSettingsAsync(UpdateRemoteAccessSettingsDto dto, CancellationToken cancellationToken = default);
    Task<RemoteAccessStatusDto> StartTunnelAsync(CancellationToken cancellationToken = default);
    Task<RemoteAccessStatusDto> StopTunnelAsync(CancellationToken cancellationToken = default);
}
