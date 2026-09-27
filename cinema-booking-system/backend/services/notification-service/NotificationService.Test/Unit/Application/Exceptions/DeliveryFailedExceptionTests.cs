using System;
using FluentAssertions;
using NotificationService.Application.Exceptions;
using Xunit;

namespace NotificationService.Test.Application.Exceptions;

public class DeliveryFailedExceptionTests
{
    [Fact]
    public void Constructor_WithMessage_ShouldSetMessage()
    {
        // Arrange & Act
        var exception = new DeliveryFailedException("Test error message");

        // Assert
        exception.Message.Should().Be("Test error message");
    }

    [Fact]
    public void Constructor_WithMessageAndInnerException_ShouldSetBoth()
    {
        // Arrange
        var innerException = new Exception("Inner error");

        // Act
        var exception = new DeliveryFailedException("Test error message", innerException);

        // Assert
        exception.Message.Should().Be("Test error message");
        exception.InnerException.Should().Be(innerException);
    }
}
