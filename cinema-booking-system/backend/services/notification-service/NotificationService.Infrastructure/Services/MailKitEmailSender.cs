using System.Threading;
using System.Threading.Tasks;
using MailKit.Net.Smtp;
using Microsoft.Extensions.Configuration;
using MimeKit;
using NotificationService.Application.Contracts;

namespace NotificationService.Infrastructure.Services;

public class MailKitEmailSender : IEmailSender
{
    private readonly IConfiguration _configuration;

    public MailKitEmailSender(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public async Task SendEmailAsync(string to, string subject, string htmlBody, CancellationToken cancellationToken = default)
    {
        var message = new MimeMessage();
        
        var fromName = _configuration["Smtp:FromName"] ?? "Cinema Booking System";
        var fromAddress = _configuration["Smtp:FromAddress"] ?? "noreply@cinema.com";
        message.From.Add(new MailboxAddress(fromName, fromAddress));
        
        message.To.Add(new MailboxAddress("", to));
        message.Subject = subject;

        var bodyBuilder = new BodyBuilder
        {
            HtmlBody = htmlBody,
            TextBody = "Please view this email in an HTML-compatible client."
        };

        message.Body = bodyBuilder.ToMessageBody();

        using var client = new SmtpClient();
        
        var host = _configuration["Smtp:Host"] ?? "localhost";
        var port = int.Parse(_configuration["Smtp:Port"] ?? "1025");
        var username = _configuration["Smtp:Username"];
        var password = _configuration["Smtp:Password"];
        
        await client.ConnectAsync(host, port, MailKit.Security.SecureSocketOptions.Auto, cancellationToken);
        
        if (!string.IsNullOrEmpty(username) && !string.IsNullOrEmpty(password))
        {
            await client.AuthenticateAsync(username, password, cancellationToken);
        }

        await client.SendAsync(message, cancellationToken);
        await client.DisconnectAsync(true, cancellationToken);
    }
}
