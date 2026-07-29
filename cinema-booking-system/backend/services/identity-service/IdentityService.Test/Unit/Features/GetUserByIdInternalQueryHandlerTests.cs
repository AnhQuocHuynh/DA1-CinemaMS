using FluentAssertions;
using IdentityService.Application.Contracts;
using IdentityService.Application.Exceptions;
using IdentityService.Application.Features.Internal.Queries;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Interfaces;
using Moq;
using System.Collections.Generic;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Features;

public class GetUserByIdInternalQueryHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock = new();
    private readonly Mock<IKeycloakAdminClient> _keycloakAdminMock = new();
    private readonly GetUserByIdInternalQueryHandler _handler;

    public GetUserByIdInternalQueryHandlerTests()
    {
        _handler = new GetUserByIdInternalQueryHandler(_userRepositoryMock.Object, _keycloakAdminMock.Object);
    }

    // ─── Normal: user found with roles ───────────────────────────────────────

    [Fact]
    public async Task Handle_UserFound_ReturnsDtoWithRoles()
    {
        var user = new User("kc-1", "internal@test.com", "Internal User");
        typeof(User).GetProperty("Id")?.SetValue(user, 7L);
        var roles = new List<RoleRepresentation> { new("rid", "ADMIN") };

        _userRepositoryMock.Setup(r => r.GetByIdAsync(7, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _keycloakAdminMock.Setup(k => k.GetUserRealmRolesAsync("kc-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(roles);

        var result = await _handler.Handle(new GetUserByIdInternalQuery(7), CancellationToken.None);

        result.Id.Should().Be(7L);
        result.Email.Should().Be("internal@test.com");
        result.Roles.Should().Contain("ADMIN");
    }

    // ─── Error: user not found ───────────────────────────────────────────────

    [Fact]
    public async Task Handle_UserNotFound_ThrowsUserNotFoundException()
    {
        _userRepositoryMock.Setup(r => r.GetByIdAsync(404, It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        await FluentActions.Invoking(() => _handler.Handle(new GetUserByIdInternalQuery(404), CancellationToken.None))
            .Should().ThrowAsync<UserNotFoundException>().WithMessage("*404*");

        _keycloakAdminMock.Verify(k => k.GetUserRealmRolesAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─── Error: Keycloak unavailable ─────────────────────────────────────────

    [Fact]
    public async Task Handle_KeycloakThrows_PropagatesException()
    {
        var user = new User("kc-5", "test@test.com", "Test");
        typeof(User).GetProperty("Id")?.SetValue(user, 1L);

        _userRepositoryMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _keycloakAdminMock.Setup(k => k.GetUserRealmRolesAsync("kc-5", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("Keycloak down"));

        await FluentActions.Invoking(() => _handler.Handle(new GetUserByIdInternalQuery(1), CancellationToken.None))
            .Should().ThrowAsync<HttpRequestException>();
    }
}
