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

public class PaymentFailedEventConsumerTests
{
    private readonly Mock<IRabbitMqConnectionProvider> _connectionProviderMock;
    private readonly Mock<ILogger<PaymentFailedEventConsumer>> _loggerMock;
    private readonly Mock<IServiceScopeFactory> _scopeFactoryMock;
    private readonly Mock<IServiceScope> _scopeMock;
    private readonly Mock<IServiceProvider> _serviceProviderMock;
    private readonly Mock<IMediator> _mediatorMock;
    private readonly PaymentFailedEventConsumer _consumer;

    public PaymentFailedEventConsumerTests()
    {
        _connectionProviderMock = new Mock<IRabbitMqConnectionProvider>();
        _loggerMock = new Mock<ILogger<PaymentFailedEventConsumer>>();
        _scopeFactoryMock = new Mock<IServiceScopeFactory>();
        _scopeMock = new Mock<IServiceScope>();
        _serviceProviderMock = new Mock<IServiceProvider>();
        _mediatorMock = new Mock<IMediator>();

        _scopeFactoryMock.Setup(s => s.CreateScope()).Returns(_scopeMock.Object);
        _scopeMock.Setup(s => s.ServiceProvider).Returns(_serviceProviderMock.Object);
        _serviceProviderMock.Setup(sp => sp.GetService(typeof(IMediator))).Returns(_mediatorMock.Object);

        _consumer = new PaymentFailedEventConsumer(
            _connectionProviderMock.Object,
            _loggerMock.Object,
            _scopeFactoryMock.Object);
    }

    [Fact]
    public async Task ProcessMessageAsync_ShouldDispatchPushNotificationWithFailureReason()
    {
        // Arrange
        var payload = new PaymentFailedPayload(
            CorrelationId: "corr-1",
            PaymentId: 88L,
            OrderId: 303L,
            UserId: 66L,
            Reason: "Card declined by issuer");

        var envelope = new EventEnvelope<PaymentFailedPayload>
        {
            EventId = Guid.NewGuid(),
            EventType = "payment.failed",
            Source = "payment-service",
            OccurredAt = DateTime.UtcNow,
            SchemaVersion = 1,
            Payload = payload
        };

        // Act
        await _consumer.ProcessMessageAsync(envelope, CancellationToken.None);

        // Assert
        _mediatorMock.Verify(m => m.Send(
            It.Is<SendNotificationCommand>(cmd =>
                cmd.UserId == 66L &&
                cmd.Channel == NotificationChannel.PUSH &&
                cmd.Type == NotificationType.PAYMENT_FAILED &&
                cmd.Body.Contains("Card declined by issuer") &&
                cmd.Metadata.ContainsKey("actionType") &&
                (string)cmd.Metadata["actionType"] == "PAYMENT_FAILED" &&
                cmd.Metadata.ContainsKey("orderId") &&
                (long)cmd.Metadata["orderId"] == 303L),
            It.IsAny<CancellationToken>()), Times.Once);
    }
}
