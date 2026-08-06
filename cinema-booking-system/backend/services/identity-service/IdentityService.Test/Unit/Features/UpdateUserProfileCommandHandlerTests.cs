using FluentAssertions;
using IdentityService.Application.Exceptions;
using IdentityService.Application.Features.Users.Commands;
using IdentityService.Application.Messages;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Enums;
using IdentityService.Domain.Interfaces;
using MassTransit;
using Moq;
using System;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Features;

public class UpdateUserProfileCommandHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock = new();
    private readonly Mock<IUnitOfWork> _unitOfWorkMock = new();
    private readonly Mock<IPublishEndpoint> _publishEndpointMock = new();
    private readonly UpdateUserProfileCommandHandler _handler;

    public UpdateUserProfileCommandHandlerTests()
    {
        _handler = new UpdateUserProfileCommandHandler(
            _userRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _publishEndpointMock.Object);
    }

    // ─── Error: user not found ───────────────────────────────────────────────

    [Fact]
    public async Task Handle_UserNotFound_ThrowsUserNotFoundException()
    {
        var command = new UpdateUserProfileCommand(1, "123456", Gender.MALE, null);
        _userRepositoryMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
            .Should().ThrowAsync<UserNotFoundException>()
            .WithMessage("*1*");

        _userRepositoryMock.Verify(r => r.Update(It.IsAny<User>()), Times.Never);
    }

    // ─── Normal: happy path ──────────────────────────────────────────────────

    [Fact]
    public async Task Handle_ValidRequest_UpdatesUserAndPublishesEvent()
    {
        var user = new User("some-uuid", "test@test.com", "Test");
        typeof(User).GetProperty("Id")?.SetValue(user, 1L);
        var command = new UpdateUserProfileCommand(1, "123456", Gender.FEMALE, new DateTime(2000, 1, 1));

        _userRepositoryMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        await _handler.Handle(command, CancellationToken.None);

        user.Phone.Should().Be("123456");
        user.Gender.Should().Be(Gender.FEMALE);
        user.DateOfBirth.Should().Be(new DateTime(2000, 1, 1));

        _userRepositoryMock.Verify(r => r.Update(user), Times.Once);
        _unitOfWorkMock.Verify(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _publishEndpointMock.Verify(pub => pub.Publish(
            It.Is<UserProfileUpdatedPayload>(p => p.UserId == 1 && p.Email == "test@test.com" && p.FullName == "Test"),
            It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─── Normal: null optional fields ────────────────────────────────────────

    [Fact]
    public async Task Handle_NullOptionalFields_StillUpdatesAndPublishesEvent()
    {
        var user = new User("some-uuid", "test@test.com", "Test", "old-phone", Gender.MALE, null, true);
        typeof(User).GetProperty("Id")?.SetValue(user, 2L);
        var command = new UpdateUserProfileCommand(2, null, null, null);

        _userRepositoryMock.Setup(r => r.GetByIdAsync(2, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        await _handler.Handle(command, CancellationToken.None);

        // UpdateProfile with nulls clears optional fields
        user.Phone.Should().BeNull();
        user.Gender.Should().BeNull();

        _userRepositoryMock.Verify(r => r.Update(user), Times.Once);
        _unitOfWorkMock.Verify(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        _publishEndpointMock.Verify(pub => pub.Publish(
            It.IsAny<UserProfileUpdatedPayload>(), It.IsAny<CancellationToken>()), Times.Once);
    }

    // ─── Error: repository throws ────────────────────────────────────────────

    [Fact]
    public async Task Handle_RepositoryGetByIdThrows_PropagatesException()
    {
        var command = new UpdateUserProfileCommand(1, "123", null, null);
        _userRepositoryMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ThrowsAsync(new InvalidOperationException("DB error"));

        await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
            .Should().ThrowAsync<InvalidOperationException>().WithMessage("DB error");

        _unitOfWorkMock.Verify(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Never);
        _publishEndpointMock.Verify(pub => pub.Publish(It.IsAny<UserProfileUpdatedPayload>(),
            It.IsAny<CancellationToken>()), Times.Never);
    }

    // ─── Error: save fails → outbox message not committed ────────────────────

    [Fact]
    public async Task Handle_SaveChangesThrows_ExceptionPropagates()
    {
        var user = new User("some-uuid", "test@test.com", "Test");
        typeof(User).GetProperty("Id")?.SetValue(user, 1L);
        var command = new UpdateUserProfileCommand(1, "123", null, null);

        _userRepositoryMock.Setup(r => r.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);
        _unitOfWorkMock.Setup(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()))
            .ThrowsAsync(new Exception("DB write error"));

        await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
            .Should().ThrowAsync<Exception>();

        // Note: Publish will be called because it's called before SaveChanges with the Outbox pattern.
        // However, since SaveChanges throws, the outbox message is never committed to the database.
        _publishEndpointMock.Verify(pub => pub.Publish(
            It.IsAny<UserProfileUpdatedPayload>(), It.IsAny<CancellationToken>()), Times.Once);
    }
}
