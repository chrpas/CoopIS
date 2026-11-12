using System;

namespace CoopIS.Application.Common;

public class EmailSettings
{
    public const string SectionName = "EmailSettings";

    public string Provider { get; set; } = "Mailjet";
    public string FromName { get; set; } = "CoopIS Organization";
    public string FromEmail { get; set; } = "coopisorganization@gmail.com";
    public string FrontendBaseUrl { get; set; } = "http://localhost:5173";
    public string SmtpHost { get; set; } = "in-v3.mailjet.com";
    public int SmtpPort { get; set; } = 587;
    public string? SmtpUser { get; set; } // Mailjet API Key
    public string? SmtpPass { get; set; } // Mailjet Secret Key
    public bool UseSsl { get; set; } = true;

    /// <summary>
    /// Helper to resolve effective settings considering environment variables
    /// for seamless deployment on platforms like Railway or Docker.
    /// </summary>
    public void ApplyEnvironmentOverrides()
    {
        var envFromName = Environment.GetEnvironmentVariable("EmailSettings__FromName")
            ?? Environment.GetEnvironmentVariable("EMAIL_FROM_NAME");
        if (!string.IsNullOrWhiteSpace(envFromName))
        {
            FromName = envFromName.Trim();
        }

        var envFromEmail = Environment.GetEnvironmentVariable("EmailSettings__FromEmail")
            ?? Environment.GetEnvironmentVariable("EMAIL_FROM")
            ?? Environment.GetEnvironmentVariable("SMTP_FROM");
        if (!string.IsNullOrWhiteSpace(envFromEmail))
        {
            FromEmail = envFromEmail.Trim();
        }

        var envFrontendUrl = Environment.GetEnvironmentVariable("FrontendUrl")
            ?? Environment.GetEnvironmentVariable("FRONTEND_URL")
            ?? Environment.GetEnvironmentVariable("EmailSettings__FrontendBaseUrl");
        if (!string.IsNullOrWhiteSpace(envFrontendUrl))
        {
            FrontendBaseUrl = envFrontendUrl.Trim();
        }

        var envMailjetKey = Environment.GetEnvironmentVariable("MAILJET_API_KEY")
            ?? Environment.GetEnvironmentVariable("EmailSettings__MailjetApiKey")
            ?? Environment.GetEnvironmentVariable("EmailSettings__SmtpUser")
            ?? Environment.GetEnvironmentVariable("SMTP_USER");
        if (!string.IsNullOrWhiteSpace(envMailjetKey))
        {
            SmtpUser = envMailjetKey.Trim();
        }

        var envMailjetSecret = Environment.GetEnvironmentVariable("MAILJET_SECRET_KEY")
            ?? Environment.GetEnvironmentVariable("EmailSettings__MailjetSecretKey")
            ?? Environment.GetEnvironmentVariable("EmailSettings__SmtpPass")
            ?? Environment.GetEnvironmentVariable("SMTP_PASS");
        if (!string.IsNullOrWhiteSpace(envMailjetSecret))
        {
            SmtpPass = envMailjetSecret.Trim();
        }

        var envSmtpHost = Environment.GetEnvironmentVariable("EmailSettings__SmtpHost")
            ?? Environment.GetEnvironmentVariable("SMTP_HOST");
        if (!string.IsNullOrWhiteSpace(envSmtpHost))
        {
            SmtpHost = envSmtpHost.Trim();
        }

        var envSmtpPort = Environment.GetEnvironmentVariable("EmailSettings__SmtpPort")
            ?? Environment.GetEnvironmentVariable("SMTP_PORT");
        if (!string.IsNullOrWhiteSpace(envSmtpPort) && int.TryParse(envSmtpPort, out var p) && p > 0)
        {
            SmtpPort = p;
        }
    }
}
