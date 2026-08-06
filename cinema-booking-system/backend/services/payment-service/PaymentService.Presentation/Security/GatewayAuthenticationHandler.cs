using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Text.Encodings.Web;

namespace PaymentService.Presentation.Security;

/// <summary>
/// Reads identity from gateway-injected headers (X-User-Id, X-User-Roles)
/// instead of validating JWTs directly. The API Gateway handles JWT validation.
/// </summary>
public class GatewayAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
{
    public GatewayAuthenticationHandler(
        IOptionsMonitor<AuthenticationSchemeOptions> options,
        ILoggerFactory logger,
        UrlEncoder encoder)
        : base(options, logger, encoder) { }

    protected override Task<AuthenticateResult> HandleAuthenticateAsync()
    {
        if (!Request.Headers.TryGetValue("X-User-Id", out var userIdValues))
            return Task.FromResult(AuthenticateResult.NoResult());

        var userId = userIdValues.ToString();
        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, userId)
        };

        // Parse comma-separated roles from X-User-Roles header
        if (Request.Headers.TryGetValue("X-User-Roles", out var rolesValues))
        {
            var rolesHeader = rolesValues.ToString();
            if (!string.IsNullOrWhiteSpace(rolesHeader))
            {
                foreach (var role in rolesHeader.Split(','))
                {
                    var trimmed = role.Trim();
                    if (!string.IsNullOrEmpty(trimmed))
                        claims.Add(new Claim(ClaimTypes.Role, trimmed));
                }
            }
        }

        var identity = new ClaimsIdentity(claims, Scheme.Name);
        var principal = new ClaimsPrincipal(identity);
        var ticket = new AuthenticationTicket(principal, Scheme.Name);

        return Task.FromResult(AuthenticateResult.Success(ticket));
    }
}
