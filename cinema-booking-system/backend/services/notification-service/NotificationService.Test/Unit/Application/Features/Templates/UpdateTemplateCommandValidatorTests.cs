using FluentAssertions;
using NotificationService.Application.Features.Templates.Commands;
using NotificationService.Domain.Enums;
using Xunit;

namespace NotificationService.Test.Application.Features.Templates;

public class UpdateTemplateCommandValidatorTests
{
    private readonly UpdateTemplateCommandValidator _validator;

    public UpdateTemplateCommandValidatorTests()
    {
        _validator = new UpdateTemplateCommandValidator();
    }

    [Fact]
    public void Validate_ShouldPass_WhenCommandIsValid()
    {
        // Arrange
        var command = new UpdateTemplateCommand("CODE", NotificationChannel.EMAIL, "Subject", "Body");

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Validate_ShouldFail_WhenCodeIsInvalid(string? invalidCode)
    {
        // Arrange
        var command = new UpdateTemplateCommand(invalidCode!, NotificationChannel.EMAIL, "Subject", "Body");

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Code");
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Validate_ShouldFail_WhenSubjectIsInvalid(string? invalidSubject)
    {
        // Arrange
        var command = new UpdateTemplateCommand("CODE", NotificationChannel.EMAIL, invalidSubject!, "Body");

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Subject");
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Validate_ShouldFail_WhenBodyIsInvalid(string? invalidBody)
    {
        // Arrange
        var command = new UpdateTemplateCommand("CODE", NotificationChannel.EMAIL, "Subject", invalidBody!);

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "BodyTemplate");
    }

    [Fact]
    public void Validate_ShouldFail_WhenChannelIsInvalid()
    {
        // Arrange
        var command = new UpdateTemplateCommand("CODE", (NotificationChannel)999, "Subject", "Body");

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Channel");
    }
}
