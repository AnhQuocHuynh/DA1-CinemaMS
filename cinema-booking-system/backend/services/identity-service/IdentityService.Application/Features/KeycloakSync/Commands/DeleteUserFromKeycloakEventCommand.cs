using IdentityService.Domain.Interfaces;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Application.Features.KeycloakSync.Commands;

public record DeleteUserFromKeycloakEventCommand(string KeycloakId) : IRequest;

public class DeleteUserFromKeycloakEventCommandHandler : IRequestHandler<DeleteUserFromKeycloakEventCommand>
{
    private readonly IUserRepository _userRepository;
    private readonly IUnitOfWork _unitOfWork;

    public DeleteUserFromKeycloakEventCommandHandler(IUserRepository userRepository, IUnitOfWork unitOfWork)
    {
        _userRepository = userRepository;
        _unitOfWork = unitOfWork;
    }

    public async Task Handle(DeleteUserFromKeycloakEventCommand request, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByKeycloakIdAsync(request.KeycloakId, cancellationToken);
        if (user != null)
        {
            user.Deactivate();
            _userRepository.Update(user);
            await _unitOfWork.SaveChangesAsync(cancellationToken);
        }
    }
}
