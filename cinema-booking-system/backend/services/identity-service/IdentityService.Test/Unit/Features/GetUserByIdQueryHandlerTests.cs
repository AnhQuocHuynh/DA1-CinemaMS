using FluentAssertions;
using IdentityService.Application.Contracts;
using IdentityService.Application.Exceptions;
using IdentityService.Application.Features.Users.Queries;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Interfaces;
using Moq;
using System;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Features;

public class GetUserByIdQueryHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock = new();
    private readonly Mock<IKeycloakAdminClient> _keycloakAdminMock = new();
    private readonly GetUserByIdQueryHandler _handler;

    public GetUserByIdQueryHandlerTests()
    {
        _handler = new GetUserByIdQueryHandler(_userRepositoryMock.Object, _keycloakAdminMock.Object);
    }

    // ─── Normal: user found with roles ───────────────────────────────────────

    [Fact]
    public async Task Handle_UserFound_ReturnsDtoWithRoles()
    {
        var user = new User("kc-1", "test@test.com", "Test User");
        typeof(User).GetProperty("Id")?.SetValue(user, 10L);
        var roles = new List<RoleRepresentation> { new("rid", "customer") };

        _userRepositoryMock.Setup(r => r.GetByIdAsync(10, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _keycloakAdminMock.Setup(k => k.GetUserRealmRolesAsync("kc-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(roles);

        var result = await _handler.Handle(new GetUserByIdQuery(10), CancellationToken.None);

        result.Id.Should().Be(10L);
        result.Roles.Should().Contain("CUSTOMER"); // uppercased
    }

    // ─── Normal: role names are uppercased ────────────────────────────────────

    [Fact]
    public async Task Handle_RoleNamesAreUpperCased()
    {
        var user = new User("kc-2", "test@test.com", "Test");
        typeof(User).GetProperty("Id")?.SetValue(user, 1L);
        var roles = new List<RoleRepresentation> { new("r1", "admin"), new("r2", "staff") };

        _userRepositoryMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _keycloakAdminMock.Setup(k => k.GetUserRealmRolesAsync("kc-2", It.IsAny<CancellationToken>()))
            .ReturnsAsync(roles);

        var result = await _handler.Handle(new GetUserByIdQuery(1), CancellationToken.None);

        result.Roles.Should().BeEquivalentTo(new[] { "ADMIN", "STAFF" });
    }

    // ─── Normal: Keycloak returns no roles ───────────────────────────────────

    [Fact]
    public async Task Handle_KeycloakReturnsEmptyRoles_ReturnsDtoWithEmptyRoles()
    {
        var user = new User("kc-3", "test@test.com", "Test");
        typeof(User).GetProperty("Id")?.SetValue(user, 1L);

        _userRepositoryMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _keycloakAdminMock.Setup(k => k.GetUserRealmRolesAsync("kc-3", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RoleRepresentation>());

        var result = await _handler.Handle(new GetUserByIdQuery(1), CancellationToken.None);

        result.Roles.Should().BeEmpty();
    }

    // ─── Error: user not found ───────────────────────────────────────────────

    [Fact]
    public async Task Handle_UserNotFound_ThrowsUserNotFoundException()
    {
        _userRepositoryMock.Setup(r => r.GetByIdAsync(99, It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        await FluentActions.Invoking(() => _handler.Handle(new GetUserByIdQuery(99), CancellationToken.None))
            .Should().ThrowAsync<UserNotFoundException>().WithMessage("*99*");

        _keycloakAdminMock.Verify(k => k.GetUserRealmRolesAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─── Error: Keycloak unavailable ─────────────────────────────────────────

    [Fact]
    public async Task Handle_KeycloakThrows_PropagatesException()
    {
        var user = new User("kc-4", "test@test.com", "Test");
        typeof(User).GetProperty("Id")?.SetValue(user, 1L);

        _userRepositoryMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _keycloakAdminMock.Setup(k => k.GetUserRealmRolesAsync("kc-4", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("Keycloak down"));

        await FluentActions.Invoking(() => _handler.Handle(new GetUserByIdQuery(1), CancellationToken.None))
            .Should().ThrowAsync<HttpRequestException>().WithMessage("Keycloak down");
    }
}
