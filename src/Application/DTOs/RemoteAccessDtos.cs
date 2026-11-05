using System;

namespace CoopIS.Application.DTOs;

public enum RemoteAccessStatusState
{
    Disabled,
    Starting,
    Running,
    Stopped,
    Error,
    NgrokNotFound
}

public record RemoteAccessStatusDto(
    RemoteAccessStatusState State,
    string? PublicUrl,
    string? LocalAddress,
    DateTime? StartedAt,
    string? ErrorMessage,
    string? LanAddress = null
);

public record RemoteAccessSettingsDto(
    bool Enabled,
    string NgrokPath,
    bool HasAuthtoken,
    bool AutoStart,
    string? NgrokVersion,
    bool IsNgrokDetected
);

public record UpdateRemoteAccessSettingsDto(
    string? NgrokPath,
    string? Authtoken,
    bool? AutoStart
);
