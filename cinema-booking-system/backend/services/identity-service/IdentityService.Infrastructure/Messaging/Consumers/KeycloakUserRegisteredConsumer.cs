using IdentityService.Application.Features.KeycloakSync.Commands;
using IdentityService.Domain.Enums;
using MassTransit;
using MediatR;
using Microsoft.Extensions.Logging;
using System;
using System.Threading.Tasks;

namespace IdentityService.Infrastructure.Messaging.Consumers;

public class KeycloakUserRegisteredConsumer : IConsumer<KeycloakRegistrationPayload>
{
    private readonly IMediator _mediator;
    private readonly ILogger<KeycloakUserRegisteredConsumer> _logger;

    public KeycloakUserRegisteredConsumer(IMediator mediator, ILogger<KeycloakUserRegisteredConsumer> logger)
    {
        _mediator = mediator;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<KeycloakRegistrationPayload> context)
    {
        var payload = context.Message;
        _logger.LogInformation("Received Keycloak Registration Event for KeycloakId: {KeycloakId}", payload.KeycloakId);

        if (!string.IsNullOrEmpty(payload.KeycloakId))
        {
            var fullName = $"{payload.FirstName} {payload.LastName}".Trim();
            
            Gender? parsedGender = null;
            if (!string.IsNullOrEmpty(payload.Gender) && Enum.TryParse<Gender>(payload.Gender, true, out var gender))
            {
                parsedGender = gender;
            }

            DateTime? parsedDob = null;
            if (!string.IsNullOrEmpty(payload.DateOfBirth) && DateTime.TryParse(payload.DateOfBirth, out var dob))
            {
                parsedDob = dob;
            }

            var command = new CreateUserFromKeycloakEventCommand(
                payload.KeycloakId,
                payload.Email,
                fullName,
                payload.Phone,
                parsedGender,
                parsedDob
            );

            await _mediator.Send(command, context.CancellationToken);
        }
    }
}

public class KeycloakRegistrationPayload
{
    public string KeycloakId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public string? Gender { get; set; }
    public string? DateOfBirth { get; set; }
}
