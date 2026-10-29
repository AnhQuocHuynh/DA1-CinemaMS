using FluentAssertions;
using IdentityService.Application.Contracts;
using IdentityService.Application.Exceptions;
using IdentityService.Application.Features.Users.Commands;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Interfaces;
using Moq;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Features;

public class AssignStaffCinemaCommandHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock = new();
    private readonly Mock<IKeycloakAdminClient> _keycloakAdminMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly AssignStaffCinemaCommandHandler _handler;
    private readonly AssignStaffCinemaCommandValidator _validator = new();

    public AssignStaffCinemaCommandHandlerTests()
    {
        _handler = new AssignStaffCinemaCommandHandler(
            _userRepositoryMock.Object,
            _keycloakAdminMock.Object,
            _unitOfWorkMock.Object);
    }

    private static User MakeUser(long id = 1, string keycloakId = "kc-user-1")
    {
        var user = new User(keycloakId, "staff@test.com", "Staff Member");
        typeof(User).GetProperty("Id")?.SetValue(user, id);
        return user;
    }

    [Fact]
    public async Task Handle_UserNotFound_ThrowsUserNotFoundException()
    {
        _userRepositoryMock.Setup(r => r.GetByIdAsync(99, It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        await FluentActions.Invoking(() => _handler.Handle(new AssignStaffCinemaCommand(99, 1L), CancellationToken.None))
            .Should().ThrowAsync<UserNotFoundException>();

        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        _keycloakAdminMock.Verify(k => k.SetUserAttributeAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ValidCinemaId_AssignsCinemaPersistsAndSyncsToKeycloak()
    {
        var user = MakeUser(10, "kc-staff-10");
        _userRepositoryMock.Setup(r => r.GetByIdAsync(10, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        await _handler.Handle(new AssignStaffCinemaCommand(10, 5L), CancellationToken.None);

        user.CinemaId.Should().Be(5L);
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _keycloakAdminMock.Verify(k => k.SetUserAttributeAsync("kc-staff-10", "cinema_id", "5", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Fact]
    public async Task Handle_NullCinemaId_UnassignsCinemaAndSyncsEmptyStringToKeycloak()
    {
        var user = MakeUser(10, "kc-staff-10");
        user.AssignCinema(5L);

        _userRepositoryMock.Setup(r => r.GetByIdAsync(10, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        await _handler.Handle(new AssignStaffCinemaCommand(10, null), CancellationToken.None);

        user.CinemaId.Should().BeNull();
        _unitOfWorkMock.Verify(u => u.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _keycloakAdminMock.Verify(k => k.SetUserAttributeAsync("kc-staff-10", "cinema_id", "", It.IsAny<CancellationToken>()), Times.Once);
    }

    [Theory]
    [InlineData(0, null, false)]
    [InlineData(-1, null, false)]
    [InlineData(1, 0L, false)]
    [InlineData(1, -5L, false)]
    [InlineData(1, null, true)]
    [InlineData(1, 10L, true)]
    public void Validator_ValidatesUserIdAndCinemaId(long userId, long? cinemaId, bool shouldBeValid)
    {
        var result = _validator.Validate(new AssignStaffCinemaCommand(userId, cinemaId));
        result.IsValid.Should().Be(shouldBeValid);
    }
}
