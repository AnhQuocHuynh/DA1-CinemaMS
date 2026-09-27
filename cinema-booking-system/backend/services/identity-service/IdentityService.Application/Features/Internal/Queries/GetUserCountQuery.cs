using IdentityService.Domain.Interfaces;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Application.Features.Internal.Queries;

public record GetUserCountQuery : IRequest<int>;

public class GetUserCountQueryHandler : IRequestHandler<GetUserCountQuery, int>
{
    private readonly IUserRepository _userRepository;

    public GetUserCountQueryHandler(IUserRepository userRepository)
    {
        _userRepository = userRepository;
    }

    public async Task<int> Handle(GetUserCountQuery request, CancellationToken cancellationToken)
    {
        return await _userRepository.CountAsync(cancellationToken);
    }
}
