
namespace FacilityService.Application.Contracts
{
    public interface IEventPublisher
    {
        Task PublishAsync(string topic,string routingKey, string message);
        Task PublishAsync<T>(string topic,string routingKey, T message) where T : class;
    }
}
