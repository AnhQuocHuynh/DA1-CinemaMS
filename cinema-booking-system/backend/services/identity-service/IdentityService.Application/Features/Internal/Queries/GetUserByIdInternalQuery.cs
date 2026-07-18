using IdentityService.Application.DTOs;
using IdentityService.Application.Exceptions;
using IdentityService.Domain.Interfaces;
using MediatR;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Application.Features.Internal.Queries;

public record GetUserByIdInternalQuery(long Id) : IRequest<UserDto>;

public class GetUserByIdInternalQueryHandler : IRequestHandler<GetUserByIdInternalQuery, UserDto>
{
    private readonly IUserRepository _userRepository;

    public GetUserByIdInternalQueryHandler(IUserRepository userRepository)
    {
        _userRepository = userRepository;
    }

    public async Task<UserDto> Handle(GetUserByIdInternalQuery request, CancellationToken cancellationToken)
    {
        var user = await _userRepository.GetByIdAsync(request.Id, cancellationToken);
        if (user == null)
            throw new UserNotFoundException(request.Id);

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
