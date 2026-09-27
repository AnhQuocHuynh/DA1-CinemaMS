using FluentAssertions;
using IdentityService.Application.Exceptions;
using IdentityService.Application.Features.KeycloakSync.Commands;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Interfaces;
using Moq;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Features;

public class SyncUserFromKeycloakCommandHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly SyncUserFromKeycloakCommandHandler _handler;

    public SyncUserFromKeycloakCommandHandlerTests()
    {
        _handler = new SyncUserFromKeycloakCommandHandler(
            _userRepositoryMock.Object,
            _unitOfWorkMock.Object);
    }

    private static User MakeUser(long id, string keycloakId, string email)
    {
        var user = new User(keycloakId, email, "Test User");
        typeof(User).GetProperty("Id")?.SetValue(user, id);
        return user;
    }

    // ─── Error: user not found ───────────────────────────────────────────────

    [Fact]
    public async Task Handle_UserNotFound_ThrowsUserNotFoundException()
    {
        _userRepositoryMock.Setup(r => r.GetByKeycloakIdAsync("missing", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        await FluentActions.Invoking(() =>
                _handler.Handle(new SyncUserFromKeycloakCommand("missing", "a@b.com", "Name", true), CancellationToken.None))
            .Should().ThrowAsync<UserNotFoundException>();

        _unitOfWorkMock.Verify(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─── Normal: email unchanged → skips email conflict check ────────────────

    [Fact]
    public async Task Handle_EmailNotChanged_SkipsEmailConflictCheck()
    {
        var user = MakeUser(1, "kc-1", "same@test.com");
        _userRepositoryMock.Setup(r => r.GetByKeycloakIdAsync("kc-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        await _handler.Handle(new SyncUserFromKeycloakCommand("kc-1", "same@test.com", "Updated Name", true), CancellationToken.None);

        // Email is same → GetByEmailAsync should never be called
        _userRepositoryMock.Verify(r => r.GetByEmailAsync(It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
        _userRepositoryMock.Verify(r => r.Update(user), Times.Once);
        _unitOfWorkMock.Verify(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─── Normal: email changed, no conflict ──────────────────────────────────

    [Fact]
    public async Task Handle_EmailChanged_NoConflict_UpdatesUser()
    {
        var user = MakeUser(1, "kc-1", "old@test.com");
        _userRepositoryMock.Setup(r => r.GetByKeycloakIdAsync("kc-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _userRepositoryMock.Setup(r => r.GetByEmailAsync("new@test.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null); // no conflict

        await _handler.Handle(new SyncUserFromKeycloakCommand("kc-1", "new@test.com", "Same Name", true), CancellationToken.None);

        user.Email.Should().Be("new@test.com");
        _userRepositoryMock.Verify(r => r.Update(user), Times.Once);
        _unitOfWorkMock.Verify(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─── Error: email changed → conflict with a DIFFERENT user ───────────────

    [Fact]
    public async Task Handle_EmailChanged_ConflictWithDifferentUser_ThrowsDuplicateEmailException()
    {
        var user = MakeUser(1, "kc-1", "old@test.com");
        var otherUser = MakeUser(2, "kc-2", "taken@test.com"); // different user owns that email

        _userRepositoryMock.Setup(r => r.GetByKeycloakIdAsync("kc-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _userRepositoryMock.Setup(r => r.GetByEmailAsync("taken@test.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(otherUser);

        await FluentActions.Invoking(() =>
                _handler.Handle(new SyncUserFromKeycloakCommand("kc-1", "taken@test.com", "Name", true), CancellationToken.None))
            .Should().ThrowAsync<DuplicateEmailException>();

        _unitOfWorkMock.Verify(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─── Normal: email changed, but conflict is the SAME user (self-conflict) ─

    [Fact]
    public async Task Handle_EmailChanged_ConflictWithSameUser_AllowsUpdate()
    {
        // Edge case: GetByEmailAsync returns the same user (e.g. case normalisation)
        var user = MakeUser(1, "kc-1", "old@test.com");

        _userRepositoryMock.Setup(r => r.GetByKeycloakIdAsync("kc-1", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        // Returns the SAME user object (Id = 1 == user.Id)
        _userRepositoryMock.Setup(r => r.GetByEmailAsync("normalized@test.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Should NOT throw — emailCheck.Id == user.Id branch passes
        await _handler.Handle(new SyncUserFromKeycloakCommand("kc-1", "normalized@test.com", "Name", true), CancellationToken.None);

        _userRepositoryMock.Verify(r => r.Update(user), Times.Once);
        _unitOfWorkMock.Verify(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }
}
