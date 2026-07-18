using FluentAssertions;
using IdentityService.Application.Contracts;
using IdentityService.Application.Exceptions;
using IdentityService.Application.Features.Users.Commands;
using IdentityService.Application.Messages;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Enums;
using IdentityService.Domain.Interfaces;
using Moq;
using System;
using System.Threading;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Features;

public class UpdateUserProfileCommandHandlerTests
{
    private readonly Mock<IUserRepository> _userRepositoryMock;
    private readonly Mock<IUnitOfWork> _unitOfWorkMock;
    private readonly Mock<IEventPublisher> _eventPublisherMock;
    private readonly UpdateUserProfileCommandHandler _handler;

    public UpdateUserProfileCommandHandlerTests()
    {
        _userRepositoryMock = new Mock<IUserRepository>();
        _unitOfWorkMock = new Mock<IUnitOfWork>();
        _eventPublisherMock = new Mock<IEventPublisher>();

        _handler = new UpdateUserProfileCommandHandler(
            _userRepositoryMock.Object,
            _unitOfWorkMock.Object,
            _eventPublisherMock.Object
        );
    }

    [Fact]
    public async Task Handle_UserNotFound_ThrowsUserNotFoundException()
    {
        // Arrange
        var command = new UpdateUserProfileCommand(1, "123456", Gender.MALE, null);
        _userRepositoryMock.Setup(repo => repo.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync((User?)null);

        // Act & Assert
        await FluentActions.Invoking(() => _handler.Handle(command, CancellationToken.None))
            .Should().ThrowAsync<UserNotFoundException>()
            .WithMessage("*1*");

        _userRepositoryMock.Verify(repo => repo.Update(It.IsAny<User>()), Times.Never);
    }

    [Fact]
    public async Task Handle_ValidRequest_UpdatesUserAndPublishesEvent()
    {
        // Arrange
        var user = new User("some-uuid", "test@test.com", "Test");
        typeof(User).GetProperty("Id")?.SetValue(user, 1L);
        var command = new UpdateUserProfileCommand(1, "123456", Gender.FEMALE, new DateTime(2000, 1, 1));
        
        _userRepositoryMock.Setup(repo => repo.GetByIdAsync(1, It.IsAny<CancellationToken>()))
            .ReturnsAsync(user);

        // Act
        await _handler.Handle(command, CancellationToken.None);

        // Assert
        user.Phone.Should().Be("123456");
        user.Gender.Should().Be(Gender.FEMALE);
        user.DateOfBirth.Should().Be(new DateTime(2000, 1, 1));

        _userRepositoryMock.Verify(repo => repo.Update(user), Times.Once);
        _unitOfWorkMock.Verify(uow => uow.SaveChangesAsync(It.IsAny<CancellationToken>()), Times.Once);
        
        _eventPublisherMock.Verify(pub => pub.PublishAsync(
            It.Is<UserProfileUpdatedPayload>(p => p.UserId == 1 && p.Email == "test@test.com" && p.FullName == "Test"),
            It.IsAny<CancellationToken>()
        ), Times.Once);
    }
}
