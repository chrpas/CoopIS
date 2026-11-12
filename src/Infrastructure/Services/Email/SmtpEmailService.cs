using System;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.Common;
using CoopIS.Application.Services;
using MailKit.Net.Smtp;
using MailKit.Security;
using Microsoft.Extensions.Logging;
using MimeKit;

namespace CoopIS.Infrastructure.Services.Email;

public class SmtpEmailService : IEmailService
{
    private readonly IEmailConfigurationService _configService;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(IEmailConfigurationService configService, ILogger<SmtpEmailService> logger)
    {
        _configService = configService;
        _logger = logger;
    }

    public async Task SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken ct = default)
    {
        var settings = await _configService.GetEffectiveSettingsAsync(ct);
        await SendEmailAsync(toEmail, subject, htmlBody, settings, ct);
    }

    public async Task SendEmailAsync(string toEmail, string subject, string htmlBody, EmailSettings settings, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(settings.SmtpUser) || string.IsNullOrWhiteSpace(settings.SmtpPass))
        {
            throw new InvalidOperationException("Mailjet API Key or Secret Key is not configured. Please enter your Mailjet credentials in Settings -> Email Configuration.");
        }

        var message = new MimeMessage();
        message.From.Add(new MailboxAddress(settings.FromName, settings.FromEmail));
        message.To.Add(new MailboxAddress(toEmail, toEmail));
        message.Subject = subject;

        var bodyBuilder = new BodyBuilder
        {
            HtmlBody = htmlBody
        };
        message.Body = bodyBuilder.ToMessageBody();

        using var client = new SmtpClient();
        client.Timeout = 15000;

        var host = string.IsNullOrWhiteSpace(settings.SmtpHost) ? "in-v3.mailjet.com" : settings.SmtpHost;
        var port = settings.SmtpPort > 0 ? settings.SmtpPort : 587;
        var secureOption = port == 465 ? SecureSocketOptions.SslOnConnect : SecureSocketOptions.StartTls;

        try
        {
            _logger.LogInformation("Connecting to Mailjet SMTP {Host}:{Port} (From: {From})", host, port, settings.FromEmail);
            await client.ConnectAsync(host, port, secureOption, ct);

            await client.AuthenticateAsync(settings.SmtpUser, settings.SmtpPass, ct);

            await client.SendAsync(message, ct);
            await client.DisconnectAsync(true, ct);

            _logger.LogInformation("Email successfully dispatched to {Recipient} via Mailjet SMTP {Host}:{Port}", toEmail, host, port);
        }
        catch (AuthenticationException authEx)
        {
            _logger.LogError(authEx, "Mailjet SMTP Authentication failed for user {User}", settings.SmtpUser);
            throw new InvalidOperationException($"Mailjet Authentication Failed: {authEx.Message}. Please double check your Mailjet API Key (Username) and Secret Key (Password).", authEx);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Mailjet dispatch failed to {Recipient} on {Host}:{Port}", toEmail, host, port);
            throw new InvalidOperationException($"Mailjet dispatch failed: {ex.Message}", ex);
        }
    }

    public Task SendPasswordResetEmailAsync(string toEmail, string resetUrl, string? recipientName = null, CancellationToken ct = default)
    {
        return SendEmailAsync(toEmail, "CoopIS - Password Reset Request", $"<a href='{resetUrl}'>Reset Password</a>", ct);
    }
}
