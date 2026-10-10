using IdentityService.Application.DTOs;
using IdentityService.Application.Exceptions;
using IdentityService.Domain.Enums;
using IdentityService.Domain.Interfaces;
using MediatR;

namespace IdentityService.Application.Features.Users.Queries;

public record GetCinemaAssignmentsQuery(
    long ActorUserId,
    IReadOnlyCollection<string> ActorRoles,
    long TargetUserId) : IRequest<IReadOnlyList<CinemaAssignmentDto>>;

public class GetCinemaAssignmentsQueryHandler : IRequestHandler<GetCinemaAssignmentsQuery, IReadOnlyList<CinemaAssignmentDto>>
{
    private readonly IUserRepository _users;
    private readonly ICinemaAssignmentRepository _assignments;

    public GetCinemaAssignmentsQueryHandler(IUserRepository users, ICinemaAssignmentRepository assignments)
    {
        _users = users;
        _assignments = assignments;
    }

    public async Task<IReadOnlyList<CinemaAssignmentDto>> Handle(GetCinemaAssignmentsQuery request, CancellationToken cancellationToken)
    {
        var target = await _users.GetByIdAsync(request.TargetUserId, cancellationToken)
            ?? throw new UserNotFoundException(request.TargetUserId);
        var rows = await _assignments.ListByUserAsync(target.Id, cancellationToken);
        var admin = request.ActorRoles.Any(role => role.Equals("ADMIN", StringComparison.OrdinalIgnoreCase));
        var manager = request.ActorRoles.Any(role => role.Equals("MANAGER", StringComparison.OrdinalIgnoreCase));
        if (!admin && request.ActorUserId != target.Id)
        {
            if (!manager)
            {
                throw new ForbiddenOperationException("You cannot view these cinema assignments.");
            }
            var managed = await _assignments.ListCinemaIdsAsync(request.ActorUserId, AssignmentDuty.MANAGER, cancellationToken);
            rows = rows.Where(row => managed.Contains(row.CinemaId)).ToList();
        }

        return rows.Select(row => new CinemaAssignmentDto(row.UserId, row.CinemaId, row.Duty.ToString())).ToList();
    }
}
