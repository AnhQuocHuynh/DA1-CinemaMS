using FluentAssertions;
using NotificationService.Application.Features.Templates.Commands;
using Xunit;

namespace NotificationService.Test.Application.Features.Templates;

public class ToggleTemplateActiveCommandValidatorTests
{
    private readonly ToggleTemplateActiveCommandValidator _validator;

    public ToggleTemplateActiveCommandValidatorTests()
    {
        _validator = new ToggleTemplateActiveCommandValidator();
    }

    [Fact]
    public void Validate_ShouldPass_WhenCommandIsValid()
    {
        // Arrange
        var command = new ToggleTemplateActiveCommand("CODE", true);

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
        var command = new ToggleTemplateActiveCommand(invalidCode!, true);

        // Act
        var result = _validator.Validate(command);

        // Assert
        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == "Code");
    }
}
