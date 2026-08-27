using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using NotificationService.Application.Exceptions;
using NotificationService.Application.Features.Notifications.Queries;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;
using Xunit;

namespace NotificationService.Test.Application.Features.Notifications;

public class GetNotificationByIdQueryHandlerTests
{
    private readonly Mock<INotificationRepository> _notificationRepositoryMock;
    private readonly GetNotificationByIdQueryHandler _handler;

    public GetNotificationByIdQueryHandlerTests()
    {
        _notificationRepositoryMock = new Mock<INotificationRepository>();
        _handler = new GetNotificationByIdQueryHandler(_notificationRepositoryMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldReturnNotificationDto_WhenNotificationExists()
    {
        // Arrange
        var query = new GetNotificationByIdQuery("NOTIF_1");
        var notification = new Notification(123, NotificationType.BOOKING_CONFIRMATION, NotificationChannel.EMAIL, "Subject", "Body", null);

        _notificationRepositoryMock
            .Setup(x => x.GetByIdAsync(query.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync(notification);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.UserId.Should().Be(123);
        result.Type.Should().Be(NotificationType.BOOKING_CONFIRMATION);
        result.Channel.Should().Be(NotificationChannel.EMAIL);
        result.Title.Should().Be("Subject");
        result.Body.Should().Be("Body");
    }

    [Fact]
    public async Task Handle_ShouldThrowNotificationNotFoundException_WhenNotificationDoesNotExist()
    {
        // Arrange
        var query = new GetNotificationByIdQuery("NON_EXISTENT");

        _notificationRepositoryMock
            .Setup(x => x.GetByIdAsync(query.Id, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Notification?)null);

        // Act
        var act = async () => await _handler.Handle(query, CancellationToken.None);

        // Assert
        await act.Should().ThrowAsync<NotificationNotFoundException>()
            .WithMessage("*NON_EXISTENT*");
    }
}
