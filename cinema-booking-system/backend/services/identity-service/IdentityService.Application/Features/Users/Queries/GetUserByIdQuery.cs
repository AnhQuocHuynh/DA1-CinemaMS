using IdentityService.Application.Contracts;
using IdentityService.Application.DTOs;
using IdentityService.Application.Exceptions;
using IdentityService.Domain.Interfaces;
using MediatR;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Application.Features.Users.Queries;

public record GetUserByIdQuery(long Id) : IRequest<UserDto>;

public class GetUserByIdQueryHandler : IRequestHandler<GetUserByIdQuery, UserDto>
{
    private readonly IUserRepository _userRepository;
    private readonly IKeycloakAdminClient _keycloakAdmin;

    public GetUserByIdQueryHandler(IUserRepository userRepository, IKeycloakAdminClient keycloakAdmin)
    {
        _userRepository = userRepository;
        _keycloakAdmin = keycloakAdmin;
    }

    public async Task<UserDto> Handle(GetUserByIdQuery request, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByIdAsync(request.Id, cancellationToken);
        if (user == null)
            throw new UserNotFoundException(request.Id);

        var roles = await _keycloakAdmin.GetUserRealmRolesAsync(user.KeycloakId, cancellationToken);

        return new UserDto(
            user.Id,
            user.KeycloakId,
            user.Email,
            user.FullName,
            user.Phone,
            user.Gender,
            user.DateOfBirth,
            user.Active,
            roles.Select(r => r.Name.ToUpperInvariant())
        );
    }
}

