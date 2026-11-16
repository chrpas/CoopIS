using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
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
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(
        IEmailConfigurationService configService,
        IHttpClientFactory httpClientFactory,
        ILogger<SmtpEmailService> logger)
    {
        _configService = configService;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken ct = default)
    {
        var settings = await _configService.GetEffectiveSettingsAsync(ct);
        await SendEmailAsync(toEmail, subject, htmlBody, settings, ct);
    }

    public async Task SendEmailAsync(string toEmail, string subject, string htmlBody, EmailSettings settings, CancellationToken ct = default)
    {
        await SendViaBrevoHttpApiAsync(toEmail, subject, htmlBody, settings, ct);
    }

    private async Task SendViaBrevoHttpApiAsync(string toEmail, string subject, string htmlBody, EmailSettings settings, CancellationToken ct)
    {
        var apiKey = settings.BrevoApiKey?.Trim();
        if (string.IsNullOrWhiteSpace(apiKey))
        {
            throw new InvalidOperationException("Brevo API Key (xkeysib-...) is not configured. Please enter your Brevo API Key in Settings -> Email Configuration.");
        }

        // If the user pasted a Brevo SMTP key (xsmtpsib-...) instead of a v3 HTTP API key (xkeysib-...), dispatch via smtp-relay.brevo.com:587
        if (apiKey.StartsWith("xsmtpsib-", StringComparison.OrdinalIgnoreCase))
        {
            var smtpLogin = string.IsNullOrWhiteSpace(settings.SmtpUser) || !settings.SmtpUser.Contains("@smtp-brevo.com")
                ? "c2ab27001@smtp-brevo.com"
                : settings.SmtpUser.Trim();

            var message = new MimeMessage();
            message.From.Add(new MailboxAddress(settings.FromName, settings.FromEmail));
            message.To.Add(new MailboxAddress(toEmail, toEmail));
            message.Subject = subject;
            message.Body = new BodyBuilder { HtmlBody = htmlBody }.ToMessageBody();

            using var smtpClient = new SmtpClient { Timeout = 15000 };
            _logger.LogInformation("Connecting to Brevo SMTP smtp-relay.brevo.com:587 with login {Login}", smtpLogin);
            await smtpClient.ConnectAsync("smtp-relay.brevo.com", 587, SecureSocketOptions.StartTls, ct);
            await smtpClient.AuthenticateAsync(smtpLogin, apiKey, ct);
            await smtpClient.SendAsync(message, ct);
            await smtpClient.DisconnectAsync(true, ct);
            _logger.LogInformation("Email successfully dispatched to {Recipient} via Brevo SMTP relay", toEmail);
            return;
        }

        var payload = new
        {
            sender = new
            {
                name = string.IsNullOrWhiteSpace(settings.FromName) ? "CoopIS Organization" : settings.FromName.Trim(),
                email = settings.FromEmail.Trim()
            },
            to = new[]
            {
                new { email = toEmail.Trim() }
            },
            subject = subject,
            htmlContent = htmlBody
        };

        var httpClient = _httpClientFactory.CreateClient();
        httpClient.Timeout = TimeSpan.FromSeconds(20);

        using var request = new HttpRequestMessage(HttpMethod.Post, "https://api.brevo.com/v3/smtp/email");
        request.Headers.Add("accept", "application/json");
        request.Headers.Add("api-key", apiKey);
        request.Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");

        _logger.LogInformation("Dispatching email to {Recipient} via Brevo HTTP v3 API (From: {From})", toEmail, settings.FromEmail);

        var response = await httpClient.SendAsync(request, ct);
        var responseBody = await response.Content.ReadAsStringAsync(ct);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogError("Brevo HTTP API returned {StatusCode}: {Body}", (int)response.StatusCode, responseBody);
            throw new InvalidOperationException($"Brevo API Error ({(int)response.StatusCode}): {responseBody}");
        }

        _logger.LogInformation("Email successfully dispatched to {Recipient} via Brevo HTTP v3 API. Response: {Response}", toEmail, responseBody);
    }

    public Task SendPasswordResetEmailAsync(string toEmail, string resetUrl, string? recipientName = null, CancellationToken ct = default)
    {
        return SendEmailAsync(toEmail, "CoopIS - Password Reset Request", $"<a href='{resetUrl}'>Reset Password</a>", ct);
    }
}
