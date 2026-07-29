using System.Threading;
using System.Threading.Tasks;
using RabbitMQ.Client;

namespace IdentityService.Infrastructure.Messaging;

public interface IRabbitMQConnectionProvider
{
    Task<IConnection> GetConnectionAsync(CancellationToken cancellationToken = default);
}
