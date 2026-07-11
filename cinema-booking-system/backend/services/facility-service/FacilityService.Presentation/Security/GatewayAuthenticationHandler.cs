using Microsoft.AspNetCore.Authentication;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System.Security.Claims;
using System.Text.Encodings.Web;
using System.Threading.Tasks;
using System.Collections.Generic;

namespace FacilityService.Presentation.Security
{
    public class GatewayAuthenticationHandler : AuthenticationHandler<AuthenticationSchemeOptions>
    {
        public GatewayAuthenticationHandler(
            IOptionsMonitor<AuthenticationSchemeOptions> options,
            ILoggerFactory logger,
            UrlEncoder encoder)
            : base(options, logger, encoder)
        {
        }

        protected override Task<AuthenticateResult> HandleAuthenticateAsync()
        {
            if (!Request.Headers.TryGetValue("X-User-Id", out var userIdValues))
            {
                // If there's no X-User-Id header, it's either an anonymous request or not routed through the gateway properly.
                return Task.FromResult(AuthenticateResult.NoResult());
            }

            var userId = userIdValues.ToString();
            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.NameIdentifier, userId)
            };

            // Extract roles if present
            if (Request.Headers.TryGetValue("X-User-Roles", out var rolesValues))
            {
                var rolesHeader = rolesValues.ToString();
                if (!string.IsNullOrWhiteSpace(rolesHeader))
                {
                    // Roles could be comma separated
                    var roles = rolesHeader.Split(',');
                    foreach (var role in roles)
                    {
                        var trimmedRole = role.Trim();
                        if (!string.IsNullOrEmpty(trimmedRole))
                        {
                            claims.Add(new Claim(ClaimTypes.Role, trimmedRole));
                        }
                    }
                }
            }

            var identity = new ClaimsIdentity(claims, Scheme.Name);
            var principal = new ClaimsPrincipal(identity);
            var ticket = new AuthenticationTicket(principal, Scheme.Name);

            return Task.FromResult(AuthenticateResult.Success(ticket));
        }
    }
}
