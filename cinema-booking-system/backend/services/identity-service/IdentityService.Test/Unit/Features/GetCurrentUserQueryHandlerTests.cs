using FluentAssertions;
using IdentityService.Application.DTOs;
using IdentityService.Application.Exceptions;
using IdentityService.Application.Features.Users.Queries;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Enums;
using IdentityService.Domain.Interfaces;
using Moq;
using System;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Features;

public class GetCurrentUserQueryHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock = new();
    private readonly GetCurrentUserQueryHandler _handler;

    public GetCurrentUserQueryHandlerTests()
    {
        _handler = new GetCurrentUserQueryHandler(_userRepositoryMock.Object);
    }

    // ─── Normal: user found → mapped DTO ─────────────────────────────────────

    [Fact]
    public async Task Handle_UserFound_ReturnsMappedDto()
    {
        var dob = new DateTime(1990, 1, 1);
        var user = new User("kc-1", "test@test.com", "Test User", "0123456789", Gender.FEMALE, dob, true);
        typeof(User).GetProperty("Id")?.SetValue(user, 42L);

        _userRepositoryMock.Setup(r => r.GetByKeycloakIdAsync("kc-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var result = await _handler.Handle(new GetCurrentUserQuery("kc-1"), CancellationToken.None);

        result.Id.Should().Be(42L);
        result.KeycloakId.Should().Be("kc-1");
        result.Email.Should().Be("test@test.com");
        result.FullName.Should().Be("Test User");
        result.Phone.Should().Be("0123456789");
        result.Gender.Should().Be(Gender.FEMALE);
        result.DateOfBirth.Should().Be(dob);
        result.Active.Should().BeTrue();
        result.Roles.Should().BeNull(); // GetCurrentUser does not include roles
    }

    // ─── Normal: user with all optional fields null ───────────────────────────

    [Fact]
    public async Task Handle_UserWithNullOptionalFields_ReturnsDtoWithNulls()
    {
        var user = new User("kc-2", "minimal@test.com", "Minimal User");
        typeof(User).GetProperty("Id")?.SetValue(user, 1L);

        _userRepositoryMock.Setup(r => r.GetByKeycloakIdAsync("kc-2", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        var result = await _handler.Handle(new GetCurrentUserQuery("kc-2"), CancellationToken.None);

        result.Phone.Should().BeNull();
        result.Gender.Should().BeNull();
        result.DateOfBirth.Should().BeNull();
    }

    // ─── Error: user not found ───────────────────────────────────────────────

    [Fact]
    public async Task Handle_UserNotFound_ThrowsUserNotFoundException()
    {
        _userRepositoryMock.Setup(r => r.GetByKeycloakIdAsync("ghost", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        await FluentActions.Invoking(() => _handler.Handle(new GetCurrentUserQuery("ghost"), CancellationToken.None))
            .Should().ThrowAsync<UserNotFoundException>()
            .WithMessage("*ghost*");
    }
}
