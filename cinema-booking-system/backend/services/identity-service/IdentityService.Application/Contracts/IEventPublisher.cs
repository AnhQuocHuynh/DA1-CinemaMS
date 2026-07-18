using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Application.Contracts;

public interface IEventPublisher
{
    Task PublishAsync<T>(T @event, CancellationToken ct = default) where T : class;
}
