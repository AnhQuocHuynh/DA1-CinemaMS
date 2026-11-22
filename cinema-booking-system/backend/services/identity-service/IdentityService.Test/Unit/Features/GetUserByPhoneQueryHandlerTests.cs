using FluentAssertions;
using IdentityService.Application.Contracts;
using IdentityService.Application.Features.Users.Queries;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Enums;
using IdentityService.Domain.Interfaces;
using Moq;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Features;

public class GetUserByPhoneQueryHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock = new();
    private readonly Mock<IKeycloakAdminClient> _keycloakAdminMock = new();
    private readonly GetUserByPhoneQueryHandler _handler;

    public GetUserByPhoneQueryHandlerTests()
    {
        _handler = new GetUserByPhoneQueryHandler(_userRepositoryMock.Object, _keycloakAdminMock.Object);
    }

    [Fact]
    public async Task Handle_UserFound_ReturnsDtoWithRoles()
    {
        var user = new User("kc-1", "test@test.com", "Test User", "0901234567", Gender.MALE, null, true);
        typeof(User).GetProperty("Id")?.SetValue(user, 10L);
        var roles = new List<RoleRepresentation> { new("rid", "customer") };

        _userRepositoryMock.Setup(r => r.GetByPhoneAsync("0901234567", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _keycloakAdminMock.Setup(k => k.GetUserRealmRolesAsync("kc-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(roles);

        var result = await _handler.Handle(new GetUserByPhoneQuery("0901234567"), CancellationToken.None);

        result.Should().NotBeNull();
        result!.Id.Should().Be(10L);
        result.Phone.Should().Be("0901234567");
        result.Roles.Should().Contain("CUSTOMER");
    }

    [Fact]
    public async Task Handle_UserNotFound_ReturnsNull()
    {
        _userRepositoryMock.Setup(r => r.GetByPhoneAsync("0999999999", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        var result = await _handler.Handle(new GetUserByPhoneQuery("0999999999"), CancellationToken.None);

        result.Should().BeNull();
    }
}
