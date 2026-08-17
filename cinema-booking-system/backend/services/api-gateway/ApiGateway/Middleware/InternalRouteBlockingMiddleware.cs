using Microsoft.AspNetCore.Http;
using System.Threading.Tasks;

namespace ApiGateway.Middleware
{
    public class InternalRouteBlockingMiddleware
    {
        private readonly RequestDelegate _next;

        public InternalRouteBlockingMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            if (context.Request.Path.StartsWithSegments("/internal"))
            {
                context.Response.StatusCode = StatusCodes.Status403Forbidden;
                await context.Response.WriteAsync("Access to internal routes is forbidden from the gateway.");
                return;
            }

            await _next(context);
        }
    }
}
