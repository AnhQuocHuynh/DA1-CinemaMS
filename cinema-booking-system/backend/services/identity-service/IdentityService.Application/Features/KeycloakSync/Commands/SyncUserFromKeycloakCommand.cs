using IdentityService.Application.Exceptions;
using IdentityService.Domain.Interfaces;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Application.Features.KeycloakSync.Commands;

public record SyncUserFromKeycloakCommand(
    string KeycloakId,
    string Email,
    string FullName,
    bool Active
) : IRequest;

public class SyncUserFromKeycloakCommandHandler : IRequestHandler<SyncUserFromKeycloakCommand>
{
    private readonly IUserRepository _userRepository;
    private readonly IUnitOfWork _unitOfWork;

    public SyncUserFromKeycloakCommandHandler(IUserRepository userRepository, IUnitOfWork unitOfWork)
    {
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task Handle(SyncUserFromKeycloakCommand request, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByKeycloakIdAsync(request.KeycloakId, cancellationToken);
        if (user == null)
            throw new UserNotFoundException(request.KeycloakId);

        // Check if email changed and is taken
        if (user.Email != request.Email)
        {
            var emailCheck = await _userRepository.GetByEmailAsync(request.Email, cancellationToken);
            if (emailCheck != null && emailCheck.Id != user.Id)
            {
                throw new DuplicateEmailException(request.Email);
            }
        }

        user.SyncKeycloakData(request.Email, request.FullName, request.Active);

        _userRepository.Update(user);
        await _unitOfWork.SaveChangesAsync(cancellationToken);
    }
}
