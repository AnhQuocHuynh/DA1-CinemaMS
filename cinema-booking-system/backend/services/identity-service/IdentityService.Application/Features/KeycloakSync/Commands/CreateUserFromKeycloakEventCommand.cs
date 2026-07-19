using IdentityService.Application.Exceptions;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Interfaces;
using IdentityService.Domain.Enums;
using MediatR;
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

    public CreateUserFromKeycloakEventCommandHandler(IUserRepository userRepository, IUnitOfWork unitOfWork)
    {
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task Handle(CreateUserFromKeycloakEventCommand request, CancellationToken cancellationToken)
    {
        // Check if user already exists
        var existingUser = await _userRepository.GetByKeycloakIdAsync(request.KeycloakId, cancellationToken);
        if (existingUser != null)
        {
            return; // Idempotent
        }

        var emailCheck = await _userRepository.GetByEmailAsync(request.Email, cancellationToken);
        if (emailCheck != null)
        {
            emailCheck.SyncKeycloakData(request.KeycloakId, request.Email, request.FullName, true);
            emailCheck.UpdateProfile(request.Phone ?? emailCheck.Phone, request.Gender ?? emailCheck.Gender, request.DateOfBirth ?? emailCheck.DateOfBirth);
            emailCheck.Activate();
            _userRepository.Update(emailCheck);
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
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
