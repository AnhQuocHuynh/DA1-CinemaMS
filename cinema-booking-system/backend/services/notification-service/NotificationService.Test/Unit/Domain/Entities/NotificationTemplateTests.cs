using System;
using FluentAssertions;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using Xunit;

namespace NotificationService.Test.Domain.Entities;

public class NotificationTemplateTests
{
    [Fact]
    public void Constructor_ShouldCreateTemplate_WhenParametersAreValid()
    {
        // Arrange & Act
        var template = new NotificationTemplate("TEST_CODE", NotificationChannel.EMAIL, "Test Subject", "Test Body");

        // Assert
        template.Code.Should().Be("TEST_CODE");
        template.Channel.Should().Be(NotificationChannel.EMAIL);
        template.Subject.Should().Be("Test Subject");
        template.BodyTemplate.Should().Be("Test Body");
        template.Active.Should().BeTrue();
        template.CreatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
        template.UpdatedAt.Should().BeNull();
        template.Id.Should().BeEmpty();
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Constructor_ShouldThrowArgumentException_WhenCodeIsInvalid(string? invalidCode)
    {
        // Act
        var act = () => new NotificationTemplate(invalidCode!, NotificationChannel.EMAIL, "Subject", "Body");

        // Assert
        act.Should().Throw<ArgumentException>().WithMessage("*Code is required.*");
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Constructor_ShouldThrowArgumentException_WhenSubjectIsInvalid(string? invalidSubject)
    {
        // Act
        var act = () => new NotificationTemplate("CODE", NotificationChannel.EMAIL, invalidSubject!, "Body");

        // Assert
        act.Should().Throw<ArgumentException>().WithMessage("*Subject is required.*");
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Constructor_ShouldThrowArgumentException_WhenBodyIsInvalid(string? invalidBody)
    {
        // Act
        var act = () => new NotificationTemplate("CODE", NotificationChannel.EMAIL, "Subject", invalidBody!);

        // Assert
        act.Should().Throw<ArgumentException>().WithMessage("*BodyTemplate is required.*");
    }

    [Fact]
    public void Update_ShouldModifyProperties_WhenParametersAreValid()
    {
        // Arrange
        var template = new NotificationTemplate("CODE", NotificationChannel.EMAIL, "Old Subject", "Old Body");
        
        // Act
        template.Update("New Subject", "New Body", NotificationChannel.SMS);

        // Assert
        template.Subject.Should().Be("New Subject");
        template.BodyTemplate.Should().Be("New Body");
        template.Channel.Should().Be(NotificationChannel.SMS);
        template.UpdatedAt.Should().NotBeNull();
        template.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Update_ShouldThrowArgumentException_WhenSubjectIsInvalid(string? invalidSubject)
    {
        // Arrange
        var template = new NotificationTemplate("CODE", NotificationChannel.EMAIL, "Old Subject", "Old Body");

        // Act
        var act = () => template.Update(invalidSubject!, "New Body", NotificationChannel.SMS);

        // Assert
        act.Should().Throw<ArgumentException>().WithMessage("*Subject is required.*");
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Update_ShouldThrowArgumentException_WhenBodyIsInvalid(string? invalidBody)
    {
        // Arrange
        var template = new NotificationTemplate("CODE", NotificationChannel.EMAIL, "Old Subject", "Old Body");

        // Act
        var act = () => template.Update("New Subject", invalidBody!, NotificationChannel.SMS);

        // Assert
        act.Should().Throw<ArgumentException>().WithMessage("*BodyTemplate is required.*");
    }

    [Theory]
    [InlineData(true)]
    [InlineData(false)]
    public void ToggleActive_ShouldUpdateActiveStatusAndUpdatedAt(bool isActive)
    {
        // Arrange
        var template = new NotificationTemplate("CODE", NotificationChannel.EMAIL, "Subject", "Body");

        // Act
        template.ToggleActive(isActive);

        // Assert
        template.Active.Should().Be(isActive);
        template.UpdatedAt.Should().NotBeNull();
        template.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }
}
