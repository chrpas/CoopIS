using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.Common;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using CoopIS.Domain.Entities;
using CoopIS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CoopIS.Infrastructure.Services;

public class EmailConfigurationService : IEmailConfigurationService
{
    private const string SettingKey = "EmailSettings";
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly ILogger<EmailConfigurationService> _logger;

    public EmailConfigurationService(
        AppDbContext context,
        IConfiguration configuration,
        ILogger<EmailConfigurationService> logger)
    {
        _context = context;
        _configuration = configuration;
        _logger = logger;
    }

    public async Task<EmailSettings> GetEffectiveSettingsAsync(CancellationToken ct = default)
    {
        var settings = new EmailSettings();

        // 1. Bind configuration file defaults
        _configuration.GetSection(EmailSettings.SectionName).Bind(settings);

        // 2. Apply environment variable overrides
        settings.ApplyEnvironmentOverrides();

        // 3. Overlay database configurations saved by Admin
        try
        {
            var dbSetting = await _context.AppSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Key == SettingKey, ct);

            if (dbSetting != null && !string.IsNullOrWhiteSpace(dbSetting.Value))
            {
                var stored = JsonSerializer.Deserialize<EmailSettings>(dbSetting.Value);
                if (stored != null)
                {
                    if (!string.IsNullOrWhiteSpace(stored.Provider)) settings.Provider = stored.Provider;
                    if (!string.IsNullOrWhiteSpace(stored.FromName)) settings.FromName = stored.FromName;
                    if (!string.IsNullOrWhiteSpace(stored.FromEmail)) settings.FromEmail = stored.FromEmail;
                    if (!string.IsNullOrWhiteSpace(stored.FrontendBaseUrl)) settings.FrontendBaseUrl = stored.FrontendBaseUrl;
                    if (!string.IsNullOrWhiteSpace(stored.SmtpHost)) settings.SmtpHost = stored.SmtpHost;
                    if (stored.SmtpPort > 0) settings.SmtpPort = stored.SmtpPort;
                    if (!string.IsNullOrWhiteSpace(stored.SmtpUser)) settings.SmtpUser = stored.SmtpUser;
                    if (!string.IsNullOrWhiteSpace(stored.SmtpPass)) settings.SmtpPass = stored.SmtpPass;
                    settings.UseSsl = stored.UseSsl;

                    // Re-apply environment variables if explicit overrides exist on hosting container
                    settings.ApplyEnvironmentOverrides();
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Could not read {SettingKey} from database. Using configuration defaults.", SettingKey);
        }

        return settings;
    }

    public async Task<EmailConfigDto> GetConfigDtoAsync(CancellationToken ct = default)
    {
        var settings = await GetEffectiveSettingsAsync(ct);

        DateTime? updatedAt = null;
        try
        {
            var dbSetting = await _context.AppSettings
                .AsNoTracking()
                .FirstOrDefaultAsync(s => s.Key == SettingKey, ct);
            updatedAt = dbSetting?.UpdatedAt;
        }
        catch
        {
            // Ignore DB read failure for metadata
        }

        return new EmailConfigDto(
            Provider: "Mailjet",
            FromName: settings.FromName,
            FromEmail: settings.FromEmail,
            FrontendBaseUrl: settings.FrontendBaseUrl,
            MailjetApiKey: settings.SmtpUser,
            HasMailjetSecretKey: !string.IsNullOrWhiteSpace(settings.SmtpPass),
            SmtpHost: settings.SmtpHost,
            SmtpPort: settings.SmtpPort,
            UseSsl: settings.UseSsl,
            UpdatedAt: updatedAt
        );
    }

    public async Task<EmailConfigDto> UpdateConfigAsync(UpdateEmailConfigRequest request, CancellationToken ct = default)
    {
        var current = await GetEffectiveSettingsAsync(ct);

        var settingsToStore = new EmailSettings
        {
            Provider = "Mailjet",
            FromName = string.IsNullOrWhiteSpace(request.FromName) ? "CoopIS Organization" : request.FromName.Trim(),
            FromEmail = string.IsNullOrWhiteSpace(request.FromEmail) ? "coopisorganization@gmail.com" : request.FromEmail.Trim(),
            FrontendBaseUrl = string.IsNullOrWhiteSpace(request.FrontendBaseUrl) ? "http://localhost:5173" : request.FrontendBaseUrl.Trim(),
            SmtpHost = "in-v3.mailjet.com",
            SmtpPort = 587,
            SmtpUser = string.IsNullOrWhiteSpace(request.MailjetApiKey) ? current.SmtpUser : request.MailjetApiKey.Trim(),
            UseSsl = true
        };

        // If client submitted a new Secret Key, update it; otherwise preserve existing
        if (!string.IsNullOrWhiteSpace(request.MailjetSecretKey))
        {
            settingsToStore.SmtpPass = request.MailjetSecretKey.Trim();
        }
        else
        {
            settingsToStore.SmtpPass = current.SmtpPass;
        }

        var json = JsonSerializer.Serialize(settingsToStore);

        var existing = await _context.AppSettings.FirstOrDefaultAsync(s => s.Key == SettingKey, ct);
        if (existing == null)
        {
            _context.AppSettings.Add(new AppSetting
            {
                Key = SettingKey,
                Value = json,
                UpdatedAt = DateTime.UtcNow
            });
        }
        else
        {
            existing.Value = json;
            existing.UpdatedAt = DateTime.UtcNow;
        }

        await _context.SaveChangesAsync(ct);
        _logger.LogInformation("Admin updated Mailjet email configuration (From: {From}, API Key configured: {HasKey})",
            settingsToStore.FromEmail, !string.IsNullOrWhiteSpace(settingsToStore.SmtpUser));

        return await GetConfigDtoAsync(ct);
    }
}
