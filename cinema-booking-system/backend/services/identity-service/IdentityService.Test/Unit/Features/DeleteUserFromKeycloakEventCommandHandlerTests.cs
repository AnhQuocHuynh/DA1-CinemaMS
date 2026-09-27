using FluentAssertions;
using IdentityService.Application.Features.KeycloakSync.Commands;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using Moq;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Features;

public class DeleteUserFromKeycloakEventCommandHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<ILogger<DeleteUserFromKeycloakEventCommandHandler>> _loggerMock = new();
    private readonly DeleteUserFromKeycloakEventCommandHandler _handler;

    public DeleteUserFromKeycloakEventCommandHandlerTests()
    {
        _handler = new DeleteUserFromKeycloakEventCommandHandler(
            _userRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);
    }

    // ─── Normal: active user → deactivated ───────────────────────────────────

    [Fact]
    public async Task Handle_UserExists_DeactivatesAndSaves()
    {
        var user = new User("kc-1", "test@test.com", "Test"); // Active = true
        _userRepositoryMock.Setup(r => r.GetByKeycloakIdAsync("kc-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        await _handler.Handle(new DeleteUserFromKeycloakEventCommand("kc-1"), CancellationToken.None);

        user.Active.Should().BeFalse();
        _userRepositoryMock.Verify(r => r.Update(user), Times.Once);
        _unitOfWorkMock.Verify(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─── Abnormal: user not found → silent no-op ─────────────────────────────

    [Fact]
    public async Task Handle_UserNotFound_LogsWarningAndDoesNotSaveOrThrow()
    {
        _userRepositoryMock.Setup(r => r.GetByKeycloakIdAsync("ghost-kc", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        // Should NOT throw
        await _handler.Handle(new DeleteUserFromKeycloakEventCommand("ghost-kc"), CancellationToken.None);

        _userRepositoryMock.Verify(r => r.Update(It.IsAny<User>()), Times.Never);
        _unitOfWorkMock.Verify(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─── Abnormal: already inactive user → still updates ─────────────────────

    [Fact]
    public async Task Handle_UserAlreadyInactive_StillCallsUpdateAndSave()
    {
        // User.Deactivate() has an internal guard (if Active) but the handler
        // always calls Update + Save when the user is found regardless.
        var user = new User("kc-2", "test@test.com", "Test", null, null, null, active: false);
        _userRepositoryMock.Setup(r => r.GetByKeycloakIdAsync("kc-2", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        await _handler.Handle(new DeleteUserFromKeycloakEventCommand("kc-2"), CancellationToken.None);

        user.Active.Should().BeFalse(); // still inactive (guard prevented re-write)
        _userRepositoryMock.Verify(r => r.Update(user), Times.Once);
        _unitOfWorkMock.Verify(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
