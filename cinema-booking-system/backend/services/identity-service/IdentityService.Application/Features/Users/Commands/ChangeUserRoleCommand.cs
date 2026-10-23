using FluentValidation;
using IdentityService.Application.Contracts;
using IdentityService.Application.Exceptions;
using IdentityService.Domain.Interfaces;
using MediatR;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Application.Features.Users.Commands;

/// <summary>
/// Command to change the Keycloak realm role of a user.
/// Only one of CUSTOMER, ADMIN, or STAFF can be held at a time.
/// </summary>
public record ChangeUserRoleCommand(long UserId, string NewRole) : IRequest;

public class ChangeUserRoleCommandValidator : AbstractValidator<ChangeUserRoleCommand>
{
    private static readonly string[] AllowedRoles = ["CUSTOMER", "ADMIN", "STAFF"];

    public ChangeUserRoleCommandValidator()
    {
        RuleFor(x => x.UserId)
            .GreaterThan(0).WithMessage("UserId must be a positive number.");

        RuleFor(x => x.NewRole)
            .NotEmpty().WithMessage("NewRole is required.")
            .Must(r => AllowedRoles.Contains(r.ToUpperInvariant()))
            .WithMessage($"NewRole must be one of: {string.Join(", ", AllowedRoles)}.");
    }
}

public class ChangeUserRoleCommandHandler : IRequestHandler<ChangeUserRoleCommand>
{
    private static readonly string[] ManagedRoles = ["CUSTOMER", "ADMIN", "STAFF"];

    private readonly IUserRepository _userRepository;
    private readonly IKeycloakAdminClient _keycloakAdmin;

    public ChangeUserRoleCommandHandler(
        IUserRepository userRepository,
        IKeycloakAdminClient keycloakAdmin)
    {
        _userRepository = userRepository;
        _keycloakAdmin = keycloakAdmin;
    }

    public async Task Handle(ChangeUserRoleCommand request, CancellationToken cancellationToken)
    {
        // 1. Resolve local user → get their Keycloak ID
        var user = await _userRepository.GetByIdAsync(request.UserId, cancellationToken);
        if (user == null)
            throw new UserNotFoundException(request.UserId);

        var targetRole = request.NewRole.ToUpperInvariant();

        // 2. Fetch all realm roles so we have the full role representations (Id + Name)
        var allRealmRoles = (await _keycloakAdmin.GetRealmRolesAsync(cancellationToken)).ToList();

        // 3. Fetch roles the user currently has
        var currentUserRoles = (await _keycloakAdmin.GetUserRealmRolesAsync(user.KeycloakId, cancellationToken)).ToList();

        // 4. Remove all managed roles the user currently holds (except the new one)
        var rolesToRemove = currentUserRoles
            .Where(r => ManagedRoles.Contains(r.Name.ToUpperInvariant()) && r.Name.ToUpperInvariant() != targetRole)
            .ToList();

        foreach (var role in rolesToRemove)
            await _keycloakAdmin.UnassignRealmRoleAsync(user.KeycloakId, role, cancellationToken);

        // 5. Assign the new role if the user doesn't already have it
        var alreadyHasRole = currentUserRoles.Any(r => r.Name.ToUpperInvariant() == targetRole);
        if (!alreadyHasRole)
        {
            var newRoleRepresentation = allRealmRoles.FirstOrDefault(r => r.Name.ToUpperInvariant() == targetRole)
                ?? throw new System.InvalidOperationException($"Role '{targetRole}' was not found in the Keycloak realm.");

            await _keycloakAdmin.AssignRealmRoleAsync(user.KeycloakId, newRoleRepresentation, cancellationToken);
        }
    }
}
