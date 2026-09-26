using System;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using FluentAssertions;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Moq;
using NotificationService.Application.Messages;
using NotificationService.Domain.Interfaces;
using NotificationService.Infrastructure.Messaging;
using Xunit;

namespace NotificationService.Test.Infrastructure.Messaging;

public record TestPayload(string Message, int Code);

public class TestConsumer : RabbitMqConsumerBase<EventEnvelope<TestPayload>>
{
    public bool ProcessCalled { get; private set; }
    public EventEnvelope<TestPayload>? LastReceivedEnvelope { get; private set; }
    public bool ShouldThrowOnProcess { get; set; }

    protected override string ExchangeName => "test.exchange";
    protected override string QueueName => "test.queue";
    protected override string RoutingKey => "test.key";

    public TestConsumer(
        IRabbitMqConnectionProvider connectionProvider,
        ILogger logger,
        IServiceScopeFactory scopeFactory) : base(connectionProvider, logger, scopeFactory)
    {
    }

    protected override Task ProcessMessageAsync(EventEnvelope<TestPayload> message, CancellationToken cancellationToken)
    {
        ProcessCalled = true;
        LastReceivedEnvelope = message;

        if (ShouldThrowOnProcess)
        {
            throw new InvalidOperationException("Simulation: Processing failed");
        }

        return Task.CompletedTask;
    }
}

public class PlainPayloadTestConsumer : RabbitMqConsumerBase<TestPayload>
{
    public bool ProcessCalled { get; private set; }

    protected override string ExchangeName => "test.plain.exchange";
    protected override string QueueName => "test.plain.queue";
    protected override string RoutingKey => "test.plain.key";

    public PlainPayloadTestConsumer(
        IRabbitMqConnectionProvider connectionProvider,
        ILogger logger,
        IServiceScopeFactory scopeFactory) : base(connectionProvider, logger, scopeFactory)
    {
    }

    protected override Task ProcessMessageAsync(TestPayload message, CancellationToken cancellationToken)
    {
        ProcessCalled = true;
        return Task.CompletedTask;
    }
}

public class RabbitMqConsumerBaseInboxTests
{
    private readonly Mock<IRabbitMqConnectionProvider> _mockConnectionProvider = new();
    private readonly Mock<ILogger> _mockLogger = new();
    private readonly Mock<IServiceScopeFactory> _mockScopeFactory = new();
    private readonly Mock<IServiceScope> _mockScope = new();
    private readonly Mock<IServiceProvider> _mockServiceProvider = new();
    private readonly Mock<IInboxRepository> _mockInboxRepository = new();

    public RabbitMqConsumerBaseInboxTests()
    {
        _mockScopeFactory.Setup(x => x.CreateScope()).Returns(_mockScope.Object);
        _mockScope.Setup(x => x.ServiceProvider).Returns(_mockServiceProvider.Object);
        _mockServiceProvider.Setup(x => x.GetService(typeof(IInboxRepository))).Returns(_mockInboxRepository.Object);
    }

    [Fact]
    public async Task HandleDeliveryAsync_ShouldProcessAndMarkProcessed_WhenMessageIsNew()
    {
        // Arrange
        var consumer = new TestConsumer(_mockConnectionProvider.Object, _mockLogger.Object, _mockScopeFactory.Object);
        var envelope = new EventEnvelope<TestPayload>
        {
            EventId = Guid.NewGuid(),
            EventType = "TestEvent",
            Payload = new TestPayload("Hello", 42)
        };
        var body = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(envelope));

        _mockInboxRepository
            .Setup(x => x.TryAcquireAsync(envelope.EventId.ToString(), "test.queue", "TestEvent", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var ackCalled = false;
        var nackCalled = false;

        // Act
        await consumer.HandleDeliveryAsync(
            body,
            null,
            1,
            (tag, multiple, ct) => { ackCalled = true; return ValueTask.CompletedTask; },
            (tag, multiple, requeue, ct) => { nackCalled = true; return ValueTask.CompletedTask; },
            CancellationToken.None);

        // Assert
        consumer.ProcessCalled.Should().BeTrue();
        consumer.LastReceivedEnvelope!.Payload.Message.Should().Be("Hello");
        ackCalled.Should().BeTrue();
        nackCalled.Should().BeFalse();

        _mockInboxRepository.Verify(x => x.MarkProcessedAsync(envelope.EventId.ToString(), "test.queue", It.IsAny<CancellationToken>()), Times.Once);
        _mockInboxRepository.Verify(x => x.MarkFailedAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleDeliveryAsync_ShouldSkipProcessingAndAck_WhenMessageIsDuplicate()
    {
        // Arrange
        var consumer = new TestConsumer(_mockConnectionProvider.Object, _mockLogger.Object, _mockScopeFactory.Object);
        var envelope = new EventEnvelope<TestPayload>
        {
            EventId = Guid.NewGuid(),
            EventType = "TestEvent",
            Payload = new TestPayload("Duplicate", 99)
        };
        var body = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(envelope));

        _mockInboxRepository
            .Setup(x => x.TryAcquireAsync(envelope.EventId.ToString(), "test.queue", "TestEvent", It.IsAny<CancellationToken>()))
            .ReturnsAsync(false);

        var ackCalled = false;
        var nackCalled = false;

        // Act
        await consumer.HandleDeliveryAsync(
            body,
            null,
            2,
            (tag, multiple, ct) => { ackCalled = true; return ValueTask.CompletedTask; },
            (tag, multiple, requeue, ct) => { nackCalled = true; return ValueTask.CompletedTask; },
            CancellationToken.None);

        // Assert
        consumer.ProcessCalled.Should().BeFalse();
        ackCalled.Should().BeTrue();
        nackCalled.Should().BeFalse();

        _mockInboxRepository.Verify(x => x.MarkProcessedAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleDeliveryAsync_ShouldMarkFailedAndNack_WhenProcessMessageThrows()
    {
        // Arrange
        var consumer = new TestConsumer(_mockConnectionProvider.Object, _mockLogger.Object, _mockScopeFactory.Object)
        {
            ShouldThrowOnProcess = true
        };
        var envelope = new EventEnvelope<TestPayload>
        {
            EventId = Guid.NewGuid(),
            EventType = "TestEvent",
            Payload = new TestPayload("WillFail", 500)
        };
        var body = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(envelope));

        _mockInboxRepository
            .Setup(x => x.TryAcquireAsync(envelope.EventId.ToString(), "test.queue", "TestEvent", It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var ackCalled = false;
        var nackCalled = false;
        var requeueValue = true;

        // Act
        await consumer.HandleDeliveryAsync(
            body,
            null,
            3,
            (tag, multiple, ct) => { ackCalled = true; return ValueTask.CompletedTask; },
            (tag, multiple, requeue, ct) => { nackCalled = true; requeueValue = requeue; return ValueTask.CompletedTask; },
            CancellationToken.None);

        // Assert
        consumer.ProcessCalled.Should().BeTrue();
        ackCalled.Should().BeFalse();
        nackCalled.Should().BeTrue();
        requeueValue.Should().BeFalse();

        _mockInboxRepository.Verify(x => x.MarkFailedAsync(envelope.EventId.ToString(), "test.queue", It.Is<string>(msg => msg.Contains("Simulation: Processing failed")), It.IsAny<CancellationToken>()), Times.Once);
        _mockInboxRepository.Verify(x => x.MarkProcessedAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleDeliveryAsync_ShouldAckAndDrop_WhenMessagePayloadIsNull()
    {
        // Arrange
        var consumer = new TestConsumer(_mockConnectionProvider.Object, _mockLogger.Object, _mockScopeFactory.Object);
        var body = Encoding.UTF8.GetBytes("null");

        var ackCalled = false;
        var nackCalled = false;

        // Act
        await consumer.HandleDeliveryAsync(
            body,
            null,
            4,
            (tag, multiple, ct) => { ackCalled = true; return ValueTask.CompletedTask; },
            (tag, multiple, requeue, ct) => { nackCalled = true; return ValueTask.CompletedTask; },
            CancellationToken.None);

        // Assert
        consumer.ProcessCalled.Should().BeFalse();
        ackCalled.Should().BeTrue();
        nackCalled.Should().BeFalse();

        _mockInboxRepository.Verify(x => x.TryAcquireAsync(It.IsAny<string>(), It.IsAny<string>(), It.IsAny<string>(), It.IsAny<CancellationToken>()), Times.Never);
    }

    [Fact]
    public async Task HandleDeliveryAsync_ShouldFallbackToBasicPropertiesMessageId_WhenNotEventEnvelope()
    {
        // Arrange
        var consumer = new PlainPayloadTestConsumer(_mockConnectionProvider.Object, _mockLogger.Object, _mockScopeFactory.Object);
        var payload = new TestPayload("Plain", 123);
        var body = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload));
        var rmqMessageId = "RMQ-MSG-12345";

        _mockInboxRepository
            .Setup(x => x.TryAcquireAsync(rmqMessageId, "test.plain.queue", nameof(TestPayload), It.IsAny<CancellationToken>()))
            .ReturnsAsync(true);

        var ackCalled = false;

        // Act
        await consumer.HandleDeliveryAsync(
            body,
            rmqMessageId,
            5,
            (tag, multiple, ct) => { ackCalled = true; return ValueTask.CompletedTask; },
            (tag, multiple, requeue, ct) => ValueTask.CompletedTask,
            CancellationToken.None);

        // Assert
        consumer.ProcessCalled.Should().BeTrue();
        ackCalled.Should().BeTrue();
        _mockInboxRepository.Verify(x => x.TryAcquireAsync(rmqMessageId, "test.plain.queue", nameof(TestPayload), It.IsAny<CancellationToken>()), Times.Once);
        _mockInboxRepository.Verify(x => x.MarkProcessedAsync(rmqMessageId, "test.plain.queue", It.IsAny<CancellationToken>()), Times.Once);
    }
}
