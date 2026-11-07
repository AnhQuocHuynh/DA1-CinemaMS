using System;
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

public class GetNotificationsQueryHandlerTests
{
    private readonly Mock<INotificationRepository> _notificationRepositoryMock;
    private readonly GetNotificationsQueryHandler _handler;

    public GetNotificationsQueryHandlerTests()
    {
        _notificationRepositoryMock = new Mock<INotificationRepository>();
        _handler = new GetNotificationsQueryHandler(_notificationRepositoryMock.Object);
    }

    [Fact]
    public async Task Handle_ShouldReturnPagedResult_WithItems()
    {
        // Arrange
        var notifications = new List<Notification>
        {
            new Notification(1, NotificationType.BOOKING_CONFIRMATION, NotificationChannel.EMAIL, "Title 1", "Body 1"),
            new Notification(2, NotificationType.PASSWORD_RESET, NotificationChannel.EMAIL, "Title 2", "Body 2")
        };

        _notificationRepositoryMock
            .Setup(r => r.GetPagedAsync(1, 10, It.IsAny<CancellationToken>()))
            .ReturnsAsync((notifications.AsEnumerable(), 2L));

        var query = new GetNotificationsQuery(1, 10);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Items.Should().HaveCount(2);
        result.TotalCount.Should().Be(2);
        result.Page.Should().Be(1);
        result.PageSize.Should().Be(10);
    }

    [Fact]
    public async Task Handle_ShouldReturnEmptyPagedResult_WhenNoNotifications()
    {
        // Arrange
        _notificationRepositoryMock
            .Setup(r => r.GetPagedAsync(1, 10, It.IsAny<CancellationToken>()))
            .ReturnsAsync((Enumerable.Empty<Notification>(), 0L));

        var query = new GetNotificationsQuery(1, 10);

        // Act
        var result = await _handler.Handle(query, CancellationToken.None);

        // Assert
        result.Should().NotBeNull();
        result.Items.Should().BeEmpty();
        result.TotalCount.Should().Be(0);
    }
}
