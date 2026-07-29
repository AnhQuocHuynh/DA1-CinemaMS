using FluentAssertions;
using IdentityService.Application.Features.Users.Commands;
using IdentityService.Domain.Enums;
using System;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Validators;

public class UpdateUserProfileCommandValidatorTests
{
    private readonly UpdateUserProfileCommandValidator _validator = new();

    [Fact]
    public async Task Validate_ValidCommand_ReturnsNoErrors()
    {
        var command = new UpdateUserProfileCommand(1, "1234567890", Gender.MALE, new DateTime(2000, 1, 1));

        var result = await _validator.ValidateAsync(command);

        result.IsValid.Should().BeTrue();
        result.Errors.Should().BeEmpty();
    }

    [Fact]
    public async Task Validate_NullPhoneAndDob_Passes()
    {
        // Phone and DateOfBirth are optional — null should be allowed
        var command = new UpdateUserProfileCommand(1, null, null, null);

        var result = await _validator.ValidateAsync(command);

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Validate_UserIdZero_FailsValidation()
    {
        var command = new UpdateUserProfileCommand(0, null, null, null);

        var result = await _validator.ValidateAsync(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(command.UserId));
    }

    [Fact]
    public async Task Validate_PhoneExceeds20Chars_FailsValidation()
    {
        var command = new UpdateUserProfileCommand(1, new string('1', 21), null, null);

        var result = await _validator.ValidateAsync(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e =>
            e.PropertyName == nameof(command.Phone) &&
            e.ErrorMessage.Contains("20"));
    }

    [Fact]
    public async Task Validate_FutureDateOfBirth_FailsValidation()
    {
        var command = new UpdateUserProfileCommand(1, null, null, DateTime.UtcNow.Date.AddDays(1));

        var result = await _validator.ValidateAsync(command);

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(command.DateOfBirth));
    }
}
