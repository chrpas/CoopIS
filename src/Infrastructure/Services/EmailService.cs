using System;
using System.Net;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.Common;
using CoopIS.Application.Services;
using CoopIS.Infrastructure.Services.Email;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace CoopIS.Infrastructure.Services;

public class EmailService : IEmailService
{
    private readonly IServiceProvider _serviceProvider;
    private readonly IEmailConfigurationService _configService;
    private readonly ILogger<EmailService> _logger;

    public EmailService(
        IServiceProvider serviceProvider,
        IEmailConfigurationService configService,
        ILogger<EmailService> logger)
    {
        _serviceProvider = serviceProvider;
        _configService = configService;
        _logger = logger;
    }

    public async Task SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken ct = default)
    {
        var settings = await _configService.GetEffectiveSettingsAsync(ct);

        // Primary dispatch via Mailjet SMTP Relay
        var smtpService = _serviceProvider.GetRequiredService<SmtpEmailService>();
        await smtpService.SendEmailAsync(toEmail, subject, htmlBody, settings, ct);
    }

    public async Task SendPasswordResetEmailAsync(string toEmail, string resetUrl, string? recipientName = null, CancellationToken cancellationToken = default)
    {
        var greeting = string.IsNullOrWhiteSpace(recipientName) ? "Hello," : $"Hello {WebUtility.HtmlEncode(recipientName.Trim())},";
        var subject = "CoopIS - Password Reset Request";

        var htmlBody = $@"<!DOCTYPE html>
<html>
<head>
  <meta charset='utf-8'>
  <meta name='viewport' content='width=device-width, initial-scale=1.0'>
  <style>
    body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0f172a; color: #1e293b; margin: 0; padding: 24px 12px; }}
    .container {{ max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.2); }}
    .header {{ background: #064e3b; padding: 28px 32px; text-align: center; }}
    .header-title {{ color: #ffffff; font-size: 22px; font-weight: 800; letter-spacing: -0.02em; margin: 0; }}
    .header-sub {{ color: #a7f3d0; font-size: 13px; font-weight: 500; margin-top: 4px; }}
    .content {{ padding: 32px; font-size: 14px; line-height: 1.6; color: #334155; }}
    .greeting {{ font-size: 16px; font-weight: 700; color: #0f172a; margin-bottom: 12px; }}
    .callout {{ background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 12px; padding: 16px; margin: 20px 0; }}
    .callout-title {{ font-weight: 700; color: #14532d; font-size: 13px; display: flex; align-items: center; margin-bottom: 4px; }}
    .btn-container {{ text-align: center; margin: 28px 0; }}
    .btn {{ display: inline-block; background-color: #059669; color: #ffffff !important; text-decoration: none; font-weight: 700; font-size: 14px; padding: 14px 32px; border-radius: 10px; box-shadow: 0 4px 12px rgba(5, 150, 105, 0.3); }}
    .raw-link-box {{ background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; font-size: 12px; word-break: break-all; color: #059669; margin-top: 8px; }}
    .footer {{ background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 32px; font-size: 12px; color: #64748b; line-height: 1.5; text-align: center; }}
  </style>
</head>
<body>
  <div class='container'>
    <div class='header'>
      <div class='header-title'>CoopIS Financial Portal</div>
      <div class='header-sub'>Cooperative Enterprise Management System</div>
    </div>
    <div class='content'>
      <div class='greeting'>{greeting}</div>
      <p>We received an official request to reset the password for your cooperative account registered under <strong>{WebUtility.HtmlEncode(toEmail)}</strong>.</p>
      
      <div class='callout'>
        <div class='callout-title'>SECURITY NOTICE</div>
        <div style='color: #166534; font-size: 13px;'>This single-use cryptographic reset link expires in <strong>15 minutes</strong> for your protection.</div>
      </div>

      <div class='btn-container'>
        <a href='{WebUtility.HtmlEncode(resetUrl)}' class='btn' target='_blank'>Reset My Password</a>
      </div>

      <p style='color: #64748b; font-size: 13px;'>If the button above does not open directly, copy and paste this secure link into your web browser:</p>
      <div class='raw-link-box'>{WebUtility.HtmlEncode(resetUrl)}</div>
    </div>
    <div class='footer'>
      <p style='margin: 0 0 8px 0;'>If you did not initiate this request, you can safely disregard this email or notify your system administrator. Your password remains unchanged.</p>
      <p style='margin: 0;'>&copy; {DateTime.UtcNow.Year} CoopIS Cooperative Financial System. All rights reserved.</p>
    </div>
  </div>
</body>
</html>";

        await SendEmailAsync(toEmail, subject, htmlBody, cancellationToken);
    }
}
