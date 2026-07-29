using FluentAssertions;
using IdentityService.Application.Features.KeycloakSync.Commands;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Enums;
using IdentityService.Domain.Interfaces;
using Microsoft.Extensions.Logging;
using Moq;
using System;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Features;

public class CreateUserFromKeycloakEventCommandHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<ILogger<CreateUserFromKeycloakEventCommandHandler>> _loggerMock = new();
    private readonly CreateUserFromKeycloakEventCommandHandler _handler;

    public CreateUserFromKeycloakEventCommandHandlerTests()
    {
        _handler = new CreateUserFromKeycloakEventCommandHandler(
            _userRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _loggerMock.Object);
    }

    // ─── Normal: brand-new user ──────────────────────────────────────────────

    [Fact]
    public async Task Handle_BrandNewUser_AddsAndSaves()
    {
        var command = new CreateUserFromKeycloakEventCommand("kc-new", "new@test.com", "New User");

        _userRepositoryMock.Setup(r => r.GetByKeycloakIdAsync("kc-new", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);
        _userRepositoryMock.Setup(r => r.GetByEmailAsync("new@test.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        await _handler.Handle(command, CancellationToken.None);

        _userRepositoryMock.Verify(r => r.Add(It.Is<User>(u =>
            u.KeycloakId == "kc-new" &&
            u.Email == "new@test.com" &&
            u.FullName == "New User" &&
            u.Active)), Times.Once);
        _unitOfWorkMock.Verify(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─── Abnormal: already exists by KeycloakId → idempotent ─────────────────

    [Fact]
    public async Task Handle_UserAlreadyExistsByKeycloakId_IsIdempotent_SkipsCreation()
    {
        var existingUser = new User("kc-exists", "existing@test.com", "Existing");
        var command = new CreateUserFromKeycloakEventCommand("kc-exists", "existing@test.com", "Existing");

        _userRepositoryMock.Setup(r => r.GetByKeycloakIdAsync("kc-exists", It.IsAny<CancellationToken>()))
            .ReturnsAsync(existingUser);

        await _handler.Handle(command, CancellationToken.None);

        // Must not attempt any DB write
        _userRepositoryMock.Verify(r => r.Add(It.IsAny<User>()), Times.Never);
        _userRepositoryMock.Verify(r => r.Update(It.IsAny<User>()), Times.Never);
        _unitOfWorkMock.Verify(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─── Abnormal: existing local user matched by email → sync ───────────────

    [Fact]
    public async Task Handle_UserExistsByEmail_SyncsKeycloakDataAndSaves()
    {
        var emailUser = new User("old-kc-id", "same@test.com", "Old Name", "old-phone", Gender.MALE, null, false);
        typeof(User).GetProperty("Id")?.SetValue(emailUser, 5L);
        var command = new CreateUserFromKeycloakEventCommand("new-kc-id", "same@test.com", "New Name");

        _userRepositoryMock.Setup(r => r.GetByKeycloakIdAsync("new-kc-id", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);
        _userRepositoryMock.Setup(r => r.GetByEmailAsync("same@test.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(emailUser);

        await _handler.Handle(command, CancellationToken.None);

        emailUser.KeycloakId.Should().Be("new-kc-id");
        emailUser.FullName.Should().Be("New Name");
        emailUser.Active.Should().BeTrue(); // Activate() called

        _userRepositoryMock.Verify(r => r.Update(emailUser), Times.Once);
        _userRepositoryMock.Verify(r => r.Add(It.IsAny<User>()), Times.Never);
        _unitOfWorkMock.Verify(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─── Normal: null phone in command → keeps existing phone ─────────────────

    [Fact]
    public async Task Handle_UserExistsByEmail_CommandHasNullPhone_KeepsExistingPhone()
    {
        var emailUser = new User("old-kc-id", "same@test.com", "Old Name", "existing-phone", null, null, true);
        // Command carries no phone
        var command = new CreateUserFromKeycloakEventCommand("new-kc-id", "same@test.com", "New Name", Phone: null);

        _userRepositoryMock.Setup(r => r.GetByKeycloakIdAsync("new-kc-id", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);
        _userRepositoryMock.Setup(r => r.GetByEmailAsync("same@test.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync(emailUser);

        await _handler.Handle(command, CancellationToken.None);

        // request.Phone ?? emailCheck.Phone → "existing-phone" preserved
        emailUser.Phone.Should().Be("existing-phone");
    }

    // ─── Error: save throws ──────────────────────────────────────────────────

    [Fact]
    public async Task Handle_SaveChangesThrows_PropagatesException()
    {
        var command = new CreateUserFromKeycloakEventCommand("kc-new", "new@test.com", "New User");

        _userRepositoryMock.Setup(r => r.GetByKeycloakIdAsync("kc-new", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);
        _userRepositoryMock.Setup(r => r.GetByEmailAsync("new@test.com", It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);
        _unitOfWorkMock.Setup(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB error"));

        await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
            .Should().ThrowAsync<Exception>().WithMessage("DB error");
    }
}
