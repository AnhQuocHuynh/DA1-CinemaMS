using IdentityService.Application.Exceptions;
using IdentityService.Domain.Interfaces;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Application.Features.Internal.Queries;

public record ResolveKeycloakIdQuery(string KeycloakId) : IRequest<long>;

public class ResolveKeycloakIdQueryHandler : IRequestHandler<ResolveKeycloakIdQuery, long>
{
    private readonly IUserRepository _userRepository;

    public ResolveKeycloakIdQueryHandler(IUserRepository userRepository)
    {
        _userRepository = userRepository;
    }

    public async Task<long> Handle(ResolveKeycloakIdQuery request, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByKeycloakIdAsync(request.KeycloakId, cancellationToken);
        if (user == null)
            throw new UserNotFoundException(request.KeycloakId);

        return user.Id;
    }
}
