using IdentityService.Application.Contracts;
using IdentityService.Application.DTOs;
using IdentityService.Application.Exceptions;
using IdentityService.Domain.Enums;
using IdentityService.Domain.Interfaces;
using MediatR;

namespace IdentityService.Application.Features.Internal.Queries;

public record GetCinemaScopeQuery(long UserId) : IRequest<CinemaScopeDto>;

public class GetCinemaScopeQueryHandler : IRequestHandler<GetCinemaScopeQuery, CinemaScopeDto>
{
    private readonly IUserRepository _users;
    private readonly ICinemaAssignmentRepository _assignments;
    private readonly IKeycloakAdminClient _keycloak;

    public GetCinemaScopeQueryHandler(
        IUserRepository users,
        ICinemaAssignmentRepository assignments,
        IKeycloakAdminClient keycloak)
    {
        _users = users;
        _assignments = assignments;
        _keycloak = keycloak;
    }

    public async Task<CinemaScopeDto> Handle(GetCinemaScopeQuery request, CancellationToken cancellationToken)
    {
        var user = await _users.GetByIdAsync(request.UserId, cancellationToken)
            ?? throw new UserNotFoundException(request.UserId);
        var roles = await _keycloak.GetUserRealmRolesAsync(user.KeycloakId, cancellationToken);
        var names = roles.Select(role => role.Name.ToUpperInvariant()).ToHashSet();
        if (names.Contains("ADMIN"))
        {
            return new CinemaScopeDto("ADMIN", Array.Empty<long>());
        }
        if (names.Contains("MANAGER"))
        {
            var cinemas = await _assignments.ListCinemaIdsAsync(user.Id, AssignmentDuty.MANAGER, cancellationToken);
            return new CinemaScopeDto("MANAGER", cinemas);
        }
        if (names.Contains("STAFF"))
        {
            var cinemas = await _assignments.ListCinemaIdsAsync(user.Id, AssignmentDuty.STAFF, cancellationToken);
            return new CinemaScopeDto("STAFF", cinemas);
        }
        return new CinemaScopeDto("CUSTOMER", Array.Empty<long>());
    }
}
