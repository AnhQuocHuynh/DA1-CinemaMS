using Microsoft.Extensions.Diagnostics.HealthChecks;
using System.Threading;
using System.Threading.Tasks;

namespace ApiGateway.HealthChecks
{
    public class AggregateHealthCheck : IHealthCheck
    {
        public Task<HealthCheckResult> CheckHealthAsync(HealthCheckContext context, CancellationToken cancellationToken = default)
        {
            // In a real scenario, this could query all upstream services or the YARP health check state
            return Task.FromResult(HealthCheckResult.Healthy("API Gateway is healthy and routing."));
        }
    }
}
