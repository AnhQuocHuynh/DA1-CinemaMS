using IdentityService.Application.Contracts;
using IdentityService.Application.DTOs;
using IdentityService.Domain.Interfaces;
using MediatR;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Application.Features.Users.Queries;

public record GetUserByPhoneQuery(string Phone) : IRequest<UserDto?>;

public class GetUserByPhoneQueryHandler : IRequestHandler<GetUserByPhoneQuery, UserDto?>
{
    private readonly IUserRepository _userRepository;
    private readonly IKeycloakAdminClient _keycloakAdmin;

    public GetUserByPhoneQueryHandler(IUserRepository userRepository, IKeycloakAdminClient keycloakAdmin)
    {
        _userRepository = userRepository;
        _keycloakAdmin = keycloakAdmin;
    }

    public async Task<UserDto?> Handle(GetUserByPhoneQuery request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Phone))
            return null;

        var user = await _userRepository.GetByPhoneAsync(request.Phone.Trim(), cancellationToken);
        if (user == null)
            return null;

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
