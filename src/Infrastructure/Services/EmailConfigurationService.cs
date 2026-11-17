using System;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.Common;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using CoopIS.Domain.Entities;
using CoopIS.Infrastructure.Data;
using Microsoft.AspNetCore.Http;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace CoopIS.Infrastructure.Services;

public class EmailConfigurationService : IEmailConfigurationService
{
    private const string SettingKey = "EmailSettings";
    private readonly AppDbContext _context;
    private readonly IConfiguration _configuration;
    private readonly IHttpContextAccessor _httpContextAccessor;
    private readonly ILogger<EmailConfigurationService> _logger;

    public EmailConfigurationService(
        AppDbContext context,
        IConfiguration configuration,
        IHttpContextAccessor httpContextAccessor,
        ILogger<EmailConfigurationService> logger)
    {
        _context = context;
        _configuration = configuration;
        _httpContextAccessor = httpContextAccessor;
        _logger = logger;
    }

    private string ResolveDynamicRootUrl(string? candidateUrl)
    {
        var httpContext = _httpContextAccessor.HttpContext;
        if (httpContext != null)
        {
            var originHeader = httpContext.Request.Headers["Origin"].ToString();
            if (!string.IsNullOrWhiteSpace(originHeader) && Uri.TryCreate(originHeader, UriKind.Absolute, out var originUri))
            {
                return originUri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
            }

            if (httpContext.Request.Host.HasValue)
            {
                var host = httpContext.Request.Host.Host;
                if (!host.Equals("localhost", StringComparison.OrdinalIgnoreCase) && host != "127.0.0.1" && host != "::1")
                {
                    var forwardedProto = httpContext.Request.Headers["X-Forwarded-Proto"].ToString();
                    var scheme = !string.IsNullOrWhiteSpace(forwardedProto) ? forwardedProto : httpContext.Request.Scheme;
                    return $"{scheme}://{httpContext.Request.Host.Value}".TrimEnd('/');
                }
                return "http://localhost:5173";
            }
        }

        var railwayDomain = Environment.GetEnvironmentVariable("RAILWAY_PUBLIC_DOMAIN");
        if (!string.IsNullOrWhiteSpace(railwayDomain))
        {
            return $"https://{railwayDomain.Trim().TrimEnd('/')}";
        }

        if (!string.IsNullOrWhiteSpace(candidateUrl) && Uri.TryCreate(candidateUrl.Trim(), UriKind.Absolute, out var parsedUri))
        {
            return parsedUri.GetLeftPart(UriPartial.Authority).TrimEnd('/');
        }

        return "http://localhost:5173";
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
                    if (!string.IsNullOrWhiteSpace(stored.BrevoApiKey)) settings.BrevoApiKey = stored.BrevoApiKey;
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

        // Always resolve the root URL dynamically from the active environment (http://localhost:5173 in local dev, or the live deployed origin)
        settings.FrontendBaseUrl = ResolveDynamicRootUrl(settings.FrontendBaseUrl);

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
            Provider: "Brevo",
            FromName: settings.FromName,
            FromEmail: settings.FromEmail,
            FrontendBaseUrl: settings.FrontendBaseUrl,
            MailjetApiKey: null,
            HasMailjetSecretKey: false,
            HasBrevoApiKey: !string.IsNullOrWhiteSpace(settings.BrevoApiKey),
            SmtpHost: "api.brevo.com",
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
            Provider = "Brevo",
            FromName = string.IsNullOrWhiteSpace(request.FromName) ? "CoopIS Organization" : request.FromName.Trim(),
            FromEmail = string.IsNullOrWhiteSpace(request.FromEmail) ? "coopisorganization@gmail.com" : request.FromEmail.Trim(),
            FrontendBaseUrl = ResolveDynamicRootUrl(request.FrontendBaseUrl),
            SmtpHost = "api.brevo.com",
            SmtpPort = 587,
            BrevoApiKey = string.IsNullOrWhiteSpace(request.BrevoApiKey) ? current.BrevoApiKey : request.BrevoApiKey.Trim(),
            UseSsl = true
        };

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
        _logger.LogInformation("Admin updated Brevo email configuration (From: {From}, Brevo Key Configured: {HasBrevo})",
            settingsToStore.FromEmail, !string.IsNullOrWhiteSpace(settingsToStore.BrevoApiKey));

        return await GetConfigDtoAsync(ct);
    }
}
