using FluentAssertions;
using IdentityService.Application.Exceptions;
using IdentityService.Application.Features.Internal.Queries;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Interfaces;
using Moq;
using System;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Features;

public class ResolveKeycloakIdQueryHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock = new();
    private readonly ResolveKeycloakIdQueryHandler _handler;

    public ResolveKeycloakIdQueryHandlerTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _handler = new ResolveKeycloakIdQueryHandler(_userRepositoryMock.Object);
    }

    // ─── Error: user not found ───────────────────────────────────────────────

    [Fact]
    public async Task Handle_UserNotFound_ThrowsUserNotFoundException()
    {
        var query = new ResolveKeycloakIdQuery("missing-uuid");
        _userRepositoryMock.Setup(repo => repo.GetByKeycloakIdAsync("missing-uuid", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        await FluentActions.Invoking(() => _handler.Handle(query, CancellationToken.None))
            .Should().ThrowAsync<UserNotFoundException>()
            .WithMessage("*missing-uuid*");
    }

    // ─── Normal: user found → returns internal ID ────────────────────────────

    [Fact]
    public async Task Handle_UserFound_ReturnsInternalId()
    {
        var query = new ResolveKeycloakIdQuery("existing-uuid");
        var user = new User("existing-uuid", "test@test.com", "Test");
        typeof(User).GetProperty("Id")?.SetValue(user, 99L);

        _userRepositoryMock.Setup(repo => repo.GetByKeycloakIdAsync("existing-uuid", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var result = await _handler.Handle(query, CancellationToken.None);

        result.Should().Be(99L);
    }

    // ─── Error: repository throws ─────────────────────────────────────────────

    [Fact]
    public async Task Handle_RepositoryThrows_PropagatesException()
    {
        _userRepositoryMock.Setup(repo => repo.GetByKeycloakIdAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("DB unavailable"));

        await FluentActions.Invoking(() => _handler.Handle(new ResolveKeycloakIdQuery("any"), CancellationToken.None))
            .Should().ThrowAsync<InvalidOperationException>().WithMessage("DB unavailable");
    }
}
