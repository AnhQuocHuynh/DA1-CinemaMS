using FluentAssertions;
using IdentityService.Application.Features.Internal.Queries;
using IdentityService.Domain.Interfaces;
using Moq;
using System;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Features;

public class GetUserCountQueryHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock = new();
    private readonly GetUserCountQueryHandler _handler;

    public GetUserCountQueryHandlerTests()
    {
        _handler = new GetUserCountQueryHandler(_userRepositoryMock.Object);
    }

    // ─── Normal: returns count ────────────────────────────────────────────────

    [Fact]
    public async Task Handle_ReturnsCountFromRepository()
    {
        _userRepositoryMock.Setup(r => r.CountAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(42);

        var result = await _handler.Handle(new GetUserCountQuery(), CancellationToken.None);

        result.Should().Be(42);
    }

    // ─── Error: repository throws ─────────────────────────────────────────────

    [Fact]
    public async Task Handle_RepositoryThrows_PropagatesException()
    {
        _userRepositoryMock.Setup(r => r.CountAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("DB error"));

        await FluentActions.Invoking(() => _handler.Handle(new GetUserCountQuery(), CancellationToken.None))
            .Should().ThrowAsync<InvalidOperationException>().WithMessage("DB error");
    }
}
