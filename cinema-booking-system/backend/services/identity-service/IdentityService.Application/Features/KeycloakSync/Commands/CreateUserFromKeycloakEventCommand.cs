using IdentityService.Application.Exceptions;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Interfaces;
using IdentityService.Domain.Enums;
using MediatR;
using Microsoft.Extensions.Logging;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Application.Features.KeycloakSync.Commands;

public record CreateUserFromKeycloakEventCommand(
    string KeycloakId,
    string Email,
    string FullName,
    string? Phone = null,
    Gender? Gender = null,
    System.DateTime? DateOfBirth = null
) : IRequest;

public class CreateUserFromKeycloakEventCommandHandler : IRequestHandler<CreateUserFromKeycloakEventCommand>
{
    private readonly IUserRepository _userRepository;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<CreateUserFromKeycloakEventCommandHandler> _logger;

    public CreateUserFromKeycloakEventCommandHandler(IUserRepository userRepository, IUnitOfWork unitOfWork, ILogger<CreateUserFromKeycloakEventCommandHandler> logger)
    {
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    public async Task Handle(CreateUserFromKeycloakEventCommand request, CancellationToken cancellationToken)
    {
        // Check if user already exists
        var existingUser = await _userRepository.GetByKeycloakIdAsync(request.KeycloakId, cancellationToken);
        if (existingUser != null)
        {
            _logger.LogInformation("User with Keycloak ID {KeycloakId} already exists locally. Skipping creation.", request.KeycloakId);
            return; // Idempotent
        }

        var emailCheck = await _userRepository.GetByEmailAsync(request.Email, cancellationToken);
        if (emailCheck != null)
        {
            emailCheck.SyncKeycloakData(request.KeycloakId, request.Email, request.FullName, true);
            emailCheck.UpdateProfile(request.Phone ?? emailCheck.Phone, request.Gender ?? emailCheck.Gender, request.DateOfBirth ?? emailCheck.DateOfBirth);
            emailCheck.Activate();
            _userRepository.Update(emailCheck);
            _logger.LogInformation("Synced existing local user by email {Email} with new Keycloak ID {KeycloakId}", request.Email, request.KeycloakId);
        }
        else
        {
            var newUser = new User(
                request.KeycloakId,
                request.Email,
                request.FullName,
                request.Phone,
                request.Gender,
                request.DateOfBirth,
                true // active
            );
            _userRepository.Add(newUser);
            _logger.LogInformation("Created new local user profile for Keycloak ID {KeycloakId} ({Email})", request.KeycloakId, request.Email);
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
