using System.Threading;
using System.Threading.Tasks;
using RabbitMQ.Client;

namespace NotificationService.Infrastructure.Messaging;

public interface IRabbitMqConnectionProvider
{
    Task<IConnection> GetConnectionAsync(CancellationToken cancellationToken = default);
}
