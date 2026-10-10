using FluentValidation;
using IdentityService.Application.Contracts;
using IdentityService.Application.DTOs;
using IdentityService.Application.Exceptions;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Enums;
using IdentityService.Domain.Interfaces;
using MediatR;

namespace IdentityService.Application.Features.Users.Commands;

public record CinemaAssignmentInput(long CinemaId, string Duty);

public record ReplaceCinemaAssignmentsCommand(
    long ActorUserId,
    IReadOnlyCollection<string> ActorRoles,
    long TargetUserId,
    IReadOnlyCollection<CinemaAssignmentInput> Assignments) : IRequest<IReadOnlyList<CinemaAssignmentDto>>;

public class ReplaceCinemaAssignmentsCommandValidator : AbstractValidator<ReplaceCinemaAssignmentsCommand>
{
    private static readonly string[] Duties = ["MANAGER", "STAFF"];

    public ReplaceCinemaAssignmentsCommandValidator()
    {
        RuleFor(x => x.ActorUserId).GreaterThan(0);
        RuleFor(x => x.TargetUserId).GreaterThan(0);
        RuleForEach(x => x.Assignments).ChildRules(assignment =>
        {
            assignment.RuleFor(x => x.CinemaId).GreaterThan(0);
            assignment.RuleFor(x => x.Duty)
                .Must(duty => Duties.Contains(duty.ToUpperInvariant()))
                .WithMessage("Duty must be MANAGER or STAFF.");
        });
    }
}

public class ReplaceCinemaAssignmentsCommandHandler : IRequestHandler<ReplaceCinemaAssignmentsCommand, IReadOnlyList<CinemaAssignmentDto>>
{
    private readonly IUserRepository _users;
    private readonly ICinemaAssignmentRepository _assignments;
    private readonly IKeycloakAdminClient _keycloak;
    private readonly IUnitOfWork _unitOfWork;

    public ReplaceCinemaAssignmentsCommandHandler(
        IUserRepository users,
        ICinemaAssignmentRepository assignments,
        IKeycloakAdminClient keycloak,
        IUnitOfWork unitOfWork)
    {
        _users = users;
        _assignments = assignments;
        _keycloak = keycloak;
        _unitOfWork = unitOfWork;
    }

    public async Task<IReadOnlyList<CinemaAssignmentDto>> Handle(ReplaceCinemaAssignmentsCommand request, CancellationToken cancellationToken)
    {
        var target = await _users.GetByIdAsync(request.TargetUserId, cancellationToken)
            ?? throw new UserNotFoundException(request.TargetUserId);
        var targetRole = await RealmRoleOf(target.KeycloakId, cancellationToken);
        if (targetRole is not ("MANAGER" or "STAFF"))
        {
            throw new ForbiddenOperationException("Only a MANAGER or STAFF user can be assigned to a cinema.");
        }

        var desired = request.Assignments
            .Select(x => new { x.CinemaId, Duty = Enum.Parse<AssignmentDuty>(x.Duty, true) })
            .ToList();
        if (desired.Select(x => x.CinemaId).Distinct().Count() != desired.Count)
        {
            throw new ForbiddenOperationException("A user can hold one duty per cinema.");
        }
        if (desired.Any(x => x.Duty.ToString() != targetRole))
        {
            throw new ForbiddenOperationException("Assignment duty must match the user's realm role.");
        }

        var existing = await _assignments.ListByUserAsync(target.Id, cancellationToken);
        if (IsAdmin(request.ActorRoles))
        {
            foreach (var row in existing)
            {
                _assignments.Remove(row);
            }
            foreach (var row in desired)
            {
                _assignments.Add(new CinemaAssignment(target, row.CinemaId, row.Duty));
            }
        }
        else if (IsManager(request.ActorRoles))
        {
            if (targetRole != "STAFF")
            {
                throw new ForbiddenOperationException("A manager can only assign staff.");
            }
            var managed = await _assignments.ListCinemaIdsAsync(request.ActorUserId, AssignmentDuty.MANAGER, cancellationToken);
            if (desired.Any(x => !managed.Contains(x.CinemaId)))
            {
                throw new ForbiddenOperationException("A manager can only assign staff inside their own cinemas.");
            }
            foreach (var row in existing.Where(x => x.Duty == AssignmentDuty.STAFF && managed.Contains(x.CinemaId)))
            {
                _assignments.Remove(row);
            }
            foreach (var row in desired)
            {
                _assignments.Add(new CinemaAssignment(target, row.CinemaId, row.Duty));
            }
        }
        else
        {
            throw new ForbiddenOperationException("You cannot assign cinema duties.");
        }

        await _unitOfWork.SaveChangesAsync(cancellationToken);
        var saved = await _assignments.ListByUserAsync(target.Id, cancellationToken);
        return saved.Select(x => new CinemaAssignmentDto(x.UserId, x.CinemaId, x.Duty.ToString())).ToList();
    }

    private async Task<string> RealmRoleOf(string keycloakId, CancellationToken cancellationToken)
    {
        var roles = await _keycloak.GetUserRealmRolesAsync(keycloakId, cancellationToken);
        var names = roles.Select(x => x.Name.ToUpperInvariant()).ToHashSet();
        if (names.Contains("ADMIN")) return "ADMIN";
        if (names.Contains("MANAGER")) return "MANAGER";
        if (names.Contains("STAFF")) return "STAFF";
        return "CUSTOMER";
    }

    private static bool IsAdmin(IReadOnlyCollection<string> roles) =>
        roles.Any(role => role.Equals("ADMIN", StringComparison.OrdinalIgnoreCase));

    private static bool IsManager(IReadOnlyCollection<string> roles) =>
        roles.Any(role => role.Equals("MANAGER", StringComparison.OrdinalIgnoreCase));
}
