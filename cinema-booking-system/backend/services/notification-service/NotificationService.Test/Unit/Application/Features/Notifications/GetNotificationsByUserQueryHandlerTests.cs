using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Moq;
using NotificationService.Application.Features.Notifications.Queries;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;
using Xunit;

namespace NotificationService.Test.Application.Features.Notifications;

public class GetNotificationsByUserQueryHandlerTests
{
    private readonly Mock<INotificationRepository> _notificationRepositoryMock;
    private readonly GetNotificationsByUserQueryHandler _handler;

    public GetNotificationsByUserQueryHandlerTests()
    {
        _notificationRepositoryMock = new Mock<INotificationRepository>();
        _handler = new GetNotificationsByUserQueryHandler(_notificationRepositoryMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldReturnEmptyList_WhenUserHasNoNotifications()
    {
        // Arrange
        var query = new GetNotificationsByUserQuery(999);

        _notificationRepositoryMock
            .Setup(x => x.GetByUserIdAsync(query.UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Notification>());

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Should().BeEmpty();
    }

    [Fact]
    public async Task Handle_ShouldReturnNotificationList_WhenUserHasNotifications()
    {
        // Arrange
        var query = new GetNotificationsByUserQuery(123);
        var notif1 = new Notification(123, NotificationType.BOOKING_CONFIRMATION, NotificationChannel.EMAIL, "Sub1", "Body1", null);
        var notif2 = new Notification(123, NotificationType.SHOWTIME_REMINDER, NotificationChannel.SMS, "Sub2", "Body2", null);

        _notificationRepositoryMock
            .Setup(x => x.GetByUserIdAsync(query.UserId, It.IsAny<CancellationToken>()))
            .ReturnsAsync(new List<Notification> { notif1, notif2 });

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Should().HaveCount(2);
        
        var list = result.ToList();
        list[0].UserId.Should().Be(123);
        list[1].UserId.Should().Be(123);
    }
}
