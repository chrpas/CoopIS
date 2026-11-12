using System;
using System.ComponentModel.DataAnnotations;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.Common;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;

namespace CoopIS.Api.Controllers;

[ApiController]
[Route("api/settings")]
[Authorize(Roles = "Admin")]
public class SettingsController : ControllerBase
{
    private readonly IEmailService _emailService;
    private readonly IEmailConfigurationService _emailConfigService;
    private readonly ILogger<SettingsController> _logger;

    public SettingsController(
        IEmailService emailService,
        IEmailConfigurationService emailConfigService,
        ILogger<SettingsController> logger)
    {
        _emailService = emailService;
        _emailConfigService = emailConfigService;
        _logger = logger;
    }

    [HttpGet("email-status")]
    public async Task<ActionResult<EmailStatusResponse>> GetEmailStatus(CancellationToken cancellationToken)
    {
        var settings = await _emailConfigService.GetEffectiveSettingsAsync(cancellationToken);
        var isConfigured = !string.IsNullOrWhiteSpace(settings.SmtpUser) && !string.IsNullOrWhiteSpace(settings.SmtpPass);

        return Ok(new EmailStatusResponse(
            Provider: "Mailjet",
            FromName: settings.FromName,
            FromEmail: settings.FromEmail,
            FrontendBaseUrl: settings.FrontendBaseUrl,
            IsConfigured: isConfigured,
            SmtpHost: settings.SmtpHost,
            SmtpPort: settings.SmtpPort,
            UseSsl: settings.UseSsl
        ));
    }

    [HttpGet("email-config")]
    public async Task<ActionResult<EmailConfigDto>> GetEmailConfig(CancellationToken cancellationToken)
    {
        var config = await _emailConfigService.GetConfigDtoAsync(cancellationToken);
        return Ok(config);
    }

    [HttpPut("email-config")]
    public async Task<ActionResult<EmailConfigDto>> UpdateEmailConfig(
        [FromBody] UpdateEmailConfigRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request?.FromEmail) ||
            !new EmailAddressAttribute().IsValid(request.FromEmail.Trim()))
        {
            return BadRequest(new { message = "A valid sender email address (FromEmail) is required." });
        }

        var updated = await _emailConfigService.UpdateConfigAsync(request, cancellationToken);
        return Ok(updated);
    }

    [HttpPost("test-email")]
    public async Task<ActionResult<TestEmailResponse>> SendTestEmail(
        [FromBody] TestEmailRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request?.RecipientEmail) ||
            !new EmailAddressAttribute().IsValid(request.RecipientEmail.Trim()))
        {
            return BadRequest(new { message = "A valid recipient email address is required." });
        }

        var settings = await _emailConfigService.GetEffectiveSettingsAsync(cancellationToken);

        var subject = "CoopIS System - Email Diagnostics & Test Dispatch";
        var timestamp = DateTime.UtcNow.ToString("yyyy-MM-dd HH:mm:ss 'UTC'");

        var htmlBody = $@"<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0f172a; padding: 24px; margin: 0; }}
    .box {{ max-width: 520px; margin: 0 auto; background: #ffffff; border-radius: 14px; padding: 28px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }}
    .badge {{ display: inline-block; background: #ecfdf5; color: #047857; font-weight: 700; font-size: 11px; padding: 4px 10px; border-radius: 9999px; text-transform: uppercase; margin-bottom: 12px; }}
    h2 {{ color: #0f172a; margin: 0 0 8px 0; font-size: 20px; }}
    p {{ color: #475569; font-size: 14px; line-height: 1.5; }}
    .table {{ width: 100%; border-collapse: collapse; margin: 20px 0; font-size: 13px; }}
    .table td {{ padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }}
    .table td.label {{ font-weight: 600; color: #64748b; width: 140px; }}
    .table td.val {{ color: #0f172a; font-family: monospace; }}
    .footer {{ font-size: 11px; color: #94a3b8; margin-top: 20px; border-top: 1px solid #f1f5f9; padding-top: 12px; }}
  </style>
</head>
<body>
  <div class='box'>
    <span class='badge'>Diagnostics Verification</span>
    <h2>CoopIS Dispatcher Verification</h2>
    <p>This automated diagnostic test confirms that your cooperative email service is properly integrated and capable of delivering notifications to external inboxes.</p>
    <table class='table'>
      <tr><td class='label'>Active Provider</td><td class='val'>{settings.Provider}</td></tr>
      <tr><td class='label'>Sender Address</td><td class='val'>{settings.FromName} &lt;{settings.FromEmail}&gt;</td></tr>
      <tr><td class='label'>Target Recipient</td><td class='val'>{request.RecipientEmail.Trim()}</td></tr>
      <tr><td class='label'>Timestamp</td><td class='val'>{timestamp}</td></tr>
      <tr><td class='label'>Frontend Base URL</td><td class='val'>{settings.FrontendBaseUrl}</td></tr>
    </table>
    <div class='footer'>
      Dispatched from CoopIS Admin Settings. If you did not trigger this test, please review your admin logs.
    </div>
  </div>
</body>
</html>";

        try
        {
            await _emailService.SendEmailAsync(request.RecipientEmail.Trim(), subject, htmlBody, cancellationToken);
            return Ok(new TestEmailResponse(
                Success: true,
                Message: $"Test email successfully sent to {request.RecipientEmail.Trim()} via {settings.Provider} provider.",
                Provider: settings.Provider
            ));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send test email to {Recipient} via provider {Provider}", request.RecipientEmail, settings.Provider);
            return BadRequest(new { message = $"Email dispatch failed ({settings.Provider}): {ex.Message}" });
        }
    }
}
