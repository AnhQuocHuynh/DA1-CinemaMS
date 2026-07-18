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

    public GetUsersQueryHandler(IUserRepository userRepository)
    {
        _userRepository = userRepository;
    }

    public async Task<PagedResult<UserDto>> Handle(GetUsersQuery request, CancellationToken cancellationToken)
    {
        var (users, totalCount) = await _userRepository.GetPagedAsync(request.Page, request.PageSize, cancellationToken);

        var dtos = users.Select(user => new UserDto(
            user.Id,
            user.KeycloakId,
            user.Email,
            user.FullName,
            user.Phone,
            user.Gender,
            user.DateOfBirth,
            user.Active
        ));

        return new PagedResult<UserDto>(dtos, totalCount, request.Page, request.PageSize);
    }
}
