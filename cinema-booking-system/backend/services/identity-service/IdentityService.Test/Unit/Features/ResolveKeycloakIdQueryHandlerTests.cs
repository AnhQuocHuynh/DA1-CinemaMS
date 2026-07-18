using FluentAssertions;
using IdentityService.Application.Exceptions;
using IdentityService.Application.Features.Internal.Queries;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Interfaces;
using Moq;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Features;

public class ResolveKeycloakIdQueryHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly ResolveKeycloakIdQueryHandler _handler;

    public ResolveKeycloakIdQueryHandlerTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _handler = new ResolveKeycloakIdQueryHandler(_userRepositoryMock.Object);
    }

    [Fact]
    public async Task Handle_UserNotFound_ThrowsUserNotFoundException()
    {
        // Arrange
        var query = new ResolveKeycloakIdQuery("missing-uuid");
        _userRepositoryMock.Setup(repo => repo.GetByKeycloakIdAsync("missing-uuid", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        // Act & Assert
        await FluentActions.Invoking(() => _handler.Handle(query, CancellationToken.None))
            .Should().ThrowAsync<UserNotFoundException>()
            .WithMessage("*missing-uuid*");
    }

    [Fact]
    public async Task Handle_UserFound_ReturnsInternalId()
    {
        // Arrange
        var query = new ResolveKeycloakIdQuery("existing-uuid");
        var user = new User("existing-uuid", "test@test.com", "Test");
        typeof(User).GetProperty("Id")?.SetValue(user, 99L);

        _userRepositoryMock.Setup(repo => repo.GetByKeycloakIdAsync("existing-uuid", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().Be(99);
    }
}
