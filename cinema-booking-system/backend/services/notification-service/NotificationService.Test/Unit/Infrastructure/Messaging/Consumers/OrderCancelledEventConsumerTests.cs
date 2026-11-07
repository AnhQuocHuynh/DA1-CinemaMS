using System;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using NotificationService.Application.Contracts;
using NotificationService.Application.Features.Notifications.Commands;
using NotificationService.Application.Messages;
using NotificationService.Domain.Enums;
using NotificationService.Infrastructure.Messaging;
using NotificationService.Infrastructure.Messaging.Consumers;
using Xunit;

namespace NotificationService.Test.Unit.Infrastructure.Messaging.Consumers;

public class OrderCancelledEventConsumerTests
{
    private readonly Mock<IRabbitMqConnectionProvider> _connectionProviderMock;
    private readonly Mock<ILogger<OrderCancelledEventConsumer>> _loggerMock;
    private readonly Mock<IServiceScopeFactory> _scopeFactoryMock;
    private readonly Mock<IServiceScope> _scopeMock;
    private readonly Mock<IServiceProvider> _serviceProviderMock;
    private readonly Mock<IMediator> _mediatorMock;
    private readonly OrderCancelledEventConsumer _consumer;

    public OrderCancelledEventConsumerTests()
    {
        _connectionProviderMock = new Mock<IRabbitMqConnectionProvider>();
        _loggerMock = new Mock<ILogger<OrderCancelledEventConsumer>>();
        _scopeFactoryMock = new Mock<IServiceScopeFactory>();
        _scopeMock = new Mock<IServiceScope>();
        _serviceProviderMock = new Mock<IServiceProvider>();
        _mediatorMock = new Mock<IMediator>();

        _scopeFactoryMock.Setup(s => s.CreateScope()).Returns(_scopeMock.Object);
        _scopeMock.Setup(s => s.ServiceProvider).Returns(_serviceProviderMock.Object);
        _serviceProviderMock.Setup(sp => sp.GetService(typeof(IMediator))).Returns(_mediatorMock.Object);

        _consumer = new OrderCancelledEventConsumer(
            _connectionProviderMock.Object,
            _loggerMock.Object,
            _scopeFactoryMock.Object);
    }

    [Fact]
    public async Task ProcessMessageAsync_ShouldDispatchPushNotificationForCancelledOrder()
    {
        // Arrange
        var payload = new OrderCancelledPayload(
            OrderId: 404L,
            UserId: 77L,
            Reason: "Seat hold timeout expired");

        var envelope = new EventEnvelope<OrderCancelledPayload>
        {
            EventId = Guid.NewGuid(),
            EventType = "order.cancelled",
            Source = "booking-service",
            OccurredAt = DateTime.UtcNow,
            SchemaVersion = 1,
            Payload = payload
        };

        // Act
        await _consumer.ProcessMessageAsync(envelope, CancellationToken.None);

        // Assert
        _mediatorMock.Verify(m => m.Send(
            It.Is<SendNotificationCommand>(cmd =>
                cmd.UserId == 77L &&
                cmd.Channel == NotificationChannel.PUSH &&
                cmd.Type == NotificationType.BOOKING_CANCELLED &&
                cmd.Body.Contains("Seat hold timeout expired") &&
                cmd.Metadata.ContainsKey("actionType") &&
                (string)cmd.Metadata["actionType"] == "ORDER_CANCELLED" &&
                cmd.Metadata.ContainsKey("orderId") &&
                (long)cmd.Metadata["orderId"] == 404L),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
