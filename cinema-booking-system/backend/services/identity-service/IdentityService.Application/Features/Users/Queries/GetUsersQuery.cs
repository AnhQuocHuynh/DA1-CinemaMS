using IdentityService.Application.Contracts;
using IdentityService.Application.DTOs;
using IdentityService.Domain.Interfaces;
using MediatR;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Application.Features.Users.Queries;

public record GetUsersQuery(int Page = 1, int PageSize = 20) : IRequest<PagedResult<UserDto>>;

public class GetUsersQueryHandler : IRequestHandler<GetUsersQuery, PagedResult<UserDto>>
{
    private readonly IUserRepository _userRepository;
    private readonly IKeycloakAdminClient _keycloakAdmin;

    public GetUsersQueryHandler(IUserRepository userRepository, IKeycloakAdminClient keycloakAdmin)
    {
        _userRepository = userRepository;
        _keycloakAdmin = keycloakAdmin;
    }

    public async System.Threading.Tasks.Task<PagedResult<UserDto>> Handle(GetUsersQuery request, CancellationToken cancellationToken)
    {
        var (users, totalCount) = await _userRepository.GetPagedAsync(request.Page, request.PageSize, cancellationToken);
        var userList = users.ToList();

        // Fetch roles for all users in parallel to avoid N sequential round-trips
        var roleTasks = userList
            .Select(u => _keycloakAdmin.GetUserRealmRolesAsync(u.KeycloakId, cancellationToken))
            .ToList();

        var allRoles = await System.Threading.Tasks.Task.WhenAll(roleTasks);

        var dtos = userList.Select((user, i) => new UserDto(
            user.Id,
            user.KeycloakId,
            user.Email,
            user.FullName,
            user.Phone,
            user.Gender,
            user.DateOfBirth,
            user.Active,
            allRoles[i].Select(r => r.Name.ToUpperInvariant())
        ));

        return new PagedResult<UserDto>(dtos, totalCount, request.Page, request.PageSize);
    }
}

