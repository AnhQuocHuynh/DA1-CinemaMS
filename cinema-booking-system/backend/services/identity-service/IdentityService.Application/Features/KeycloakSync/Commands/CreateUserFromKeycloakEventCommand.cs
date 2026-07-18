using IdentityService.Application.Exceptions;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Interfaces;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Application.Features.KeycloakSync.Commands;

public record CreateUserFromKeycloakEventCommand(
    string KeycloakId,
    string Email,
    string FullName
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
            throw new DuplicateEmailException(request.Email);
        }

        var newUser = new User(
            request.KeycloakId,
            request.Email,
            request.FullName
        );

        _userRepository.Add(newUser);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
