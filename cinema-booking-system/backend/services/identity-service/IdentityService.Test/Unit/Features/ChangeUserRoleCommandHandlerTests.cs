using FluentAssertions;
using IdentityService.Application.Contracts;
using IdentityService.Application.Exceptions;
using IdentityService.Application.Features.Users.Commands;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Interfaces;
using Moq;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Features;

public class ChangeUserRoleCommandHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock = new();
    private readonly Mock<IKeycloakAdminClient> _keycloakAdminMock = new();
    private readonly ChangeUserRoleCommandHandler _handler;

    public ChangeUserRoleCommandHandlerTests()
    {
        _handler = new ChangeUserRoleCommandHandler(
            _userRepositoryMock.Object,
            _keycloakAdminMock.Object);
    }

    private static User MakeUser(long id = 1, string keycloakId = "kc-user-1")
    {
        var user = new User(keycloakId, "test@test.com", "Test User");
        typeof(User).GetProperty("Id")?.SetValue(user, id);
        return user;
    }

    // ─── Error: user not found ───────────────────────────────────────────────

    [Fact]
    public async Task Handle_UserNotFound_ThrowsUserNotFoundException()
    {
        _userRepositoryMock.Setup(r => r.GetByIdAsync(99, It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        await FluentActions.Invoking(() => _handler.Handle(new ChangeUserRoleCommand(99, "ADMIN"), CancellationToken.None))
            .Should().ThrowAsync<UserNotFoundException>();

        _keycloakAdminMock.Verify(k => k.GetRealmRolesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─── Error: target role not in realm ─────────────────────────────────────

    [Fact]
    public async Task Handle_RoleNotFoundInRealm_ThrowsInvalidOperationException()
    {
        var user = MakeUser();
        _userRepositoryMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        // Realm has no ADMIN role
        _keycloakAdminMock.Setup(k => k.GetRealmRolesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RoleRepresentation> { new("cid", "CUSTOMER"), new("sid", "STAFF") });
        // User currently has no roles
        _keycloakAdminMock.Setup(k => k.GetUserRealmRolesAsync("kc-user-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RoleRepresentation>());

        await FluentActions.Invoking(() => _handler.Handle(new ChangeUserRoleCommand(1, "ADMIN"), CancellationToken.None))
            .Should().ThrowAsync<InvalidOperationException>()
            .WithMessage("*ADMIN*");
    }

    // ─── Normal: user already has the target role ────────────────────────────

    [Fact]
    public async Task Handle_UserAlreadyHasTargetRole_SkipsAssignment()
    {
        var user = MakeUser();
        _userRepositoryMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _keycloakAdminMock.Setup(k => k.GetRealmRolesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RoleRepresentation> { new("aid", "ADMIN") });
        _keycloakAdminMock.Setup(k => k.GetUserRealmRolesAsync("kc-user-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RoleRepresentation> { new("aid", "ADMIN") }); // already has ADMIN

        await _handler.Handle(new ChangeUserRoleCommand(1, "ADMIN"), CancellationToken.None);

        _keycloakAdminMock.Verify(k => k.AssignRealmRoleAsync(It.IsAny<string>(), It.IsAny<RoleRepresentation>(), It.IsAny<CancellationToken>()), Times.Never);
        _keycloakAdminMock.Verify(k => k.UnassignRealmRoleAsync(It.IsAny<string>(), It.IsAny<RoleRepresentation>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─── Normal: swap managed role ────────────────────────────────────────────

    [Fact]
    public async Task Handle_UserHasDifferentManagedRole_RemovesOldAndAssignsNew()
    {
        var user = MakeUser();
        var customerRole = new RoleRepresentation("cid", "CUSTOMER");
        var adminRole = new RoleRepresentation("aid", "ADMIN");

        _userRepositoryMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _keycloakAdminMock.Setup(k => k.GetRealmRolesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RoleRepresentation> { customerRole, adminRole });
        _keycloakAdminMock.Setup(k => k.GetUserRealmRolesAsync("kc-user-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RoleRepresentation> { customerRole }); // currently CUSTOMER

        await _handler.Handle(new ChangeUserRoleCommand(1, "ADMIN"), CancellationToken.None);

        _keycloakAdminMock.Verify(k => k.UnassignRealmRoleAsync("kc-user-1", customerRole, It.IsAny<CancellationToken>()), Times.Once);
        _keycloakAdminMock.Verify(k => k.AssignRealmRoleAsync("kc-user-1", adminRole, It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─── Normal: multiple managed roles removed ───────────────────────────────

    [Fact]
    public async Task Handle_UserHasMultipleManagedRoles_RemovesAllExceptNew()
    {
        var user = MakeUser();
        var customerRole = new RoleRepresentation("cid", "CUSTOMER");
        var staffRole = new RoleRepresentation("sid", "STAFF");
        var adminRole = new RoleRepresentation("aid", "ADMIN");

        _userRepositoryMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _keycloakAdminMock.Setup(k => k.GetRealmRolesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RoleRepresentation> { customerRole, staffRole, adminRole });
        _keycloakAdminMock.Setup(k => k.GetUserRealmRolesAsync("kc-user-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RoleRepresentation> { customerRole, staffRole }); // has both

        await _handler.Handle(new ChangeUserRoleCommand(1, "ADMIN"), CancellationToken.None);

        _keycloakAdminMock.Verify(k => k.UnassignRealmRoleAsync("kc-user-1", It.IsAny<RoleRepresentation>(), It.IsAny<CancellationToken>()), Times.Exactly(2));
        _keycloakAdminMock.Verify(k => k.AssignRealmRoleAsync("kc-user-1", adminRole, It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─── Normal: unmanaged roles are untouched ────────────────────────────────

    [Fact]
    public async Task Handle_UserHasUnmanagedRoles_OnlyRemovesManagedOnes()
    {
        var user = MakeUser();
        var customerRole = new RoleRepresentation("cid", "CUSTOMER");
        var adminRole = new RoleRepresentation("aid", "ADMIN");
        var defaultRole = new RoleRepresentation("did", "default-roles-cinema"); // unmanaged

        _userRepositoryMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _keycloakAdminMock.Setup(k => k.GetRealmRolesAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RoleRepresentation> { customerRole, adminRole, defaultRole });
        _keycloakAdminMock.Setup(k => k.GetUserRealmRolesAsync("kc-user-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RoleRepresentation> { customerRole, defaultRole });

        await _handler.Handle(new ChangeUserRoleCommand(1, "ADMIN"), CancellationToken.None);

        // Only CUSTOMER should be removed; default-roles-cinema is not a managed role
        _keycloakAdminMock.Verify(k => k.UnassignRealmRoleAsync("kc-user-1", customerRole, It.IsAny<CancellationToken>()), Times.Once);
        _keycloakAdminMock.Verify(k => k.UnassignRealmRoleAsync("kc-user-1", defaultRole, It.IsAny<CancellationToken>()), Times.Never);
    }
}
