using IdentityService.Domain.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Application.Features.KeycloakSync.Commands;

public record DeleteUserFromKeycloakEventCommand(string KeycloakId) : IRequest;

public class DeleteUserFromKeycloakEventCommandHandler : IRequestHandler<DeleteUserFromKeycloakEventCommand>
{
    private readonly IUserRepository _userRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<DeleteUserFromKeycloakEventCommandHandler> _logger;

    public DeleteUserFromKeycloakEventCommandHandler(IUserRepository userRepository, IUnitOfWork unitOfWork, ILogger<DeleteUserFromKeycloakEventCommandHandler> logger)
    {
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task Handle(DeleteUserFromKeycloakEventCommand request, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByKeycloakIdAsync(request.KeycloakId, cancellationToken);
        if (user != null)
        {
            user.Deactivate();
            _userRepository.Update(user);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
            _logger.LogInformation("Successfully deactivated user with Keycloak ID: {KeycloakId}", request.KeycloakId);
        }
        else
        {
            _logger.LogWarning("Cannot deactivate user: User with Keycloak ID {KeycloakId} was not found in local database", request.KeycloakId);
        }
    }
}
