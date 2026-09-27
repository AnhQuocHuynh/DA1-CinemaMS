using IdentityService.Application.DTOs;
using IdentityService.Application.Exceptions;
using IdentityService.Domain.Interfaces;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Application.Features.Users.Queries;

public record GetCurrentUserQuery(string KeycloakId) : IRequest<UserDto>;

public class GetCurrentUserQueryHandler : IRequestHandler<GetCurrentUserQuery, UserDto>
{
    private readonly IUserRepository _userRepository;

    public GetCurrentUserQueryHandler(IUserRepository userRepository)
    {
        _userRepository = userRepository;
    }

    public async Task<UserDto> Handle(GetCurrentUserQuery request, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByKeycloakIdAsync(request.KeycloakId, cancellationToken);
        if (user == null)
            throw new UserNotFoundException(request.KeycloakId);

        return new UserDto(
            user.Id,
            user.KeycloakId,
            user.Email,
            user.FullName,
            user.Phone,
            user.Gender,
            user.DateOfBirth,
            user.Active
        );
    }
}
