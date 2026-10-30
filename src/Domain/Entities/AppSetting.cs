using System;

namespace CoopIS.Domain.Entities;

public class AppSetting
{
    public string Key { get; set; } = string.Empty;
    public string? Value { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
