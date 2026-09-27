using FluentAssertions;
using IdentityService.Application.Contracts;
using IdentityService.Application.Features.Users.Queries;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Interfaces;
using Moq;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Features;

public class GetUsersQueryHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock = new();
    private readonly Mock<IKeycloakAdminClient> _keycloakAdminMock = new();
    private readonly GetUsersQueryHandler _handler;

    public GetUsersQueryHandlerTests()
    {
        _handler = new GetUsersQueryHandler(_userRepositoryMock.Object, _keycloakAdminMock.Object);
    }

    // ─── Normal: paged result with correct metadata ───────────────────────────

    [Fact]
    public async Task Handle_ReturnsPagedResultWithCorrectMetadata()
    {
        var users = new List<User>
        {
            new("kc-1", "a@test.com", "Alice"),
            new("kc-2", "b@test.com", "Bob"),
        };
        _userRepositoryMock.Setup(r => r.GetPagedAsync(2, 5, It.IsAny<CancellationToken>()))
            .ReturnsAsync((users, 50));
        _keycloakAdminMock.Setup(k => k.GetUserRealmRolesAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RoleRepresentation>());

        var result = await _handler.Handle(new GetUsersQuery(2, 5), CancellationToken.None);

        result.TotalCount.Should().Be(50);
        result.Page.Should().Be(2);
        result.PageSize.Should().Be(5);
        result.Items.Should().HaveCount(2);
    }

    // ─── Normal: empty page ───────────────────────────────────────────────────

    [Fact]
    public async Task Handle_EmptyPage_ReturnsDtoWithEmptyItems()
    {
        _userRepositoryMock.Setup(r => r.GetPagedAsync(1, 10, It.IsAny<CancellationToken>()))
            .ReturnsAsync((new List<User>(), 0));

        var result = await _handler.Handle(new GetUsersQuery(1, 10), CancellationToken.None);

        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
        _keycloakAdminMock.Verify(k => k.GetUserRealmRolesAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─── Normal: roles fetched once per user ──────────────────────────────────

    [Fact]
    public async Task Handle_FetchesRolesOncePerUser()
    {
        var users = new List<User>
        {
            new("kc-1", "a@test.com", "Alice"),
            new("kc-2", "b@test.com", "Bob"),
        };
        _userRepositoryMock.Setup(r => r.GetPagedAsync(1, 10, It.IsAny<CancellationToken>()))
            .ReturnsAsync((users, 2));
        _keycloakAdminMock.Setup(k => k.GetUserRealmRolesAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RoleRepresentation>());

        await _handler.Handle(new GetUsersQuery(1, 10), CancellationToken.None);

        _keycloakAdminMock.Verify(k => k.GetUserRealmRolesAsync("kc-1", It.IsAny<CancellationToken>()), Times.Once);
        _keycloakAdminMock.Verify(k => k.GetUserRealmRolesAsync("kc-2", It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─── Normal: role names are uppercased ───────────────────────────────────

    [Fact]
    public async Task Handle_RoleNamesAreUpperCased()
    {
        var users = new List<User> { new("kc-1", "a@test.com", "Alice") };
        _userRepositoryMock.Setup(r => r.GetPagedAsync(1, 10, It.IsAny<CancellationToken>()))
            .ReturnsAsync((users, 1));
        _keycloakAdminMock.Setup(k => k.GetUserRealmRolesAsync("kc-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<RoleRepresentation> { new("rid", "customer") });

        var result = await _handler.Handle(new GetUsersQuery(1, 10), CancellationToken.None);

        result.Items.First().Roles.Should().Contain("CUSTOMER");
    }

    // ─── Error: Keycloak throws ───────────────────────────────────────────────

    [Fact]
    public async Task Handle_KeycloakThrows_PropagatesException()
    {
        var users = new List<User> { new("kc-1", "a@test.com", "Alice") };
        _userRepositoryMock.Setup(r => r.GetPagedAsync(1, 10, It.IsAny<CancellationToken>()))
            .ReturnsAsync((users, 1));
        _keycloakAdminMock.Setup(k => k.GetUserRealmRolesAsync("kc-1", It.IsAny<CancellationToken>()))
            .ThrowsAsync(new HttpRequestException("Keycloak down"));

        await FluentActions.Invoking(() => _handler.Handle(new GetUsersQuery(1, 10), CancellationToken.None))
            .Should().ThrowAsync<HttpRequestException>();
    }
}
