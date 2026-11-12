using System;

namespace CoopIS.Application.DTOs;

public record EmailStatusResponse(
    string Provider,
    string FromName,
    string FromEmail,
    string FrontendBaseUrl,
    bool IsConfigured,
    string SmtpHost,
    int SmtpPort,
    bool UseSsl
);

public record EmailConfigDto(
    string Provider,
    string FromName,
    string FromEmail,
    string FrontendBaseUrl,
    string? MailjetApiKey,
    bool HasMailjetSecretKey,
    string SmtpHost,
    int SmtpPort,
    bool UseSsl,
    DateTime? UpdatedAt
);

public record UpdateEmailConfigRequest(
    string FromName,
    string FromEmail,
    string FrontendBaseUrl,
    string? MailjetApiKey,
    string? MailjetSecretKey
);

public record TestEmailRequest(
    string RecipientEmail
);

public record TestEmailResponse(
    bool Success,
    string Message,
    string Provider
);
