using System;
using System.Security.Claims;

namespace CoopIS.Application.Common;

public static class ClaimsPrincipalExtensions
{
    public static Guid? GetMemberId(this ClaimsPrincipal principal)
    {
        var raw = principal.FindFirst("member_id")?.Value
            ?? principal.FindFirst("MemberId")?.Value;

        return Guid.TryParse(raw, out var id) ? id : null;
    }

    public static Guid? GetUserId(this ClaimsPrincipal principal)
    {
        var raw = principal.FindFirst("sub")?.Value
            ?? principal.FindFirst(ClaimTypes.NameIdentifier)?.Value;

        return Guid.TryParse(raw, out var id) ? id : null;
    }

    public static bool IsMember(this ClaimsPrincipal principal)
    {
        return principal.IsInRole("Member");
    }
}
