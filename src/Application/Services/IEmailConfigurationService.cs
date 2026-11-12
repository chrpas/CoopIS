using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.Common;
using CoopIS.Application.DTOs;

namespace CoopIS.Application.Services;

public interface IEmailConfigurationService
{
    Task<EmailSettings> GetEffectiveSettingsAsync(CancellationToken ct = default);
    Task<EmailConfigDto> GetConfigDtoAsync(CancellationToken ct = default);
    Task<EmailConfigDto> UpdateConfigAsync(UpdateEmailConfigRequest request, CancellationToken ct = default);
}

