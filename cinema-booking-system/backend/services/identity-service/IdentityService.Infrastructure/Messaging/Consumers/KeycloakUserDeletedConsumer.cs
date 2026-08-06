using IdentityService.Application.Features.KeycloakSync.Commands;
using MassTransit;
using MediatR;
using Microsoft.Extensions.Logging;
using System.Threading.Tasks;

namespace IdentityService.Infrastructure.Messaging.Consumers;

public class KeycloakUserDeletedConsumer : IConsumer<KeycloakDeletePayload>
{
    private readonly IMediator _mediator;
    private readonly ILogger<KeycloakUserDeletedConsumer> _logger;

    public KeycloakUserDeletedConsumer(IMediator mediator, ILogger<KeycloakUserDeletedConsumer> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<KeycloakDeletePayload> context)
    {
        var payload = context.Message;
        _logger.LogInformation("Received Keycloak Delete Event for KeycloakId: {KeycloakId}", payload.KeycloakId);

        if (!string.IsNullOrEmpty(payload.KeycloakId))
        {
            var command = new DeleteUserFromKeycloakEventCommand(payload.KeycloakId);
            await _mediator.Send(command, context.CancellationToken);
        }
    }
}

public class KeycloakDeletePayload
{
    public string KeycloakId { get; set; } = string.Empty;
}
