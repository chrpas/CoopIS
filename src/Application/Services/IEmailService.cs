using System.Threading;
using System.Threading.Tasks;

namespace CoopIS.Application.Services;

public interface IEmailService
{
    Task SendEmailAsync(string toEmail, string subject, string htmlBody, CancellationToken ct = default);
    Task SendPasswordResetEmailAsync(string toEmail, string resetUrl, string? recipientName = null, CancellationToken ct = default);
}
