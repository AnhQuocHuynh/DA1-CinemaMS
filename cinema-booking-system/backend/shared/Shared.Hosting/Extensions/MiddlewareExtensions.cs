using Microsoft.AspNetCore.Builder;
using CinemaBooking.Shared.Hosting.Middleware;

namespace CinemaBooking.Shared.Hosting.Extensions;

public static class MiddlewareExtensions
{
    public static IApplicationBuilder UseInternalApiSecurity(this IApplicationBuilder app)
    {
        return app.UseMiddleware<InternalApiSecurityMiddleware>();
    }
}
