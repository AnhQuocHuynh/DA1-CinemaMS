using FluentAssertions;
using IdentityService.Application.Features.Users.Commands;
using System.Threading.Tasks;
using Xunit;

namespace IdentityService.Test.Unit.Validators;

public class ChangeUserRoleCommandValidatorTests
{
    private readonly ChangeUserRoleCommandValidator _validator = new();

    [Theory]
    [InlineData("CUSTOMER")]
    [InlineData("ADMIN")]
    [InlineData("STAFF")]
    public async Task Validate_ValidUppercaseRole_Passes(string role)
    {
        var result = await _validator.ValidateAsync(new ChangeUserRoleCommand(1, role));

        result.IsValid.Should().BeTrue();
    }

    [Theory]
    [InlineData("customer")]
    [InlineData("admin")]
    [InlineData("staff")]
    public async Task Validate_ValidLowercaseRole_Passes(string role)
    {
        // Validator applies ToUpperInvariant() before checking — lowercase is valid
        var result = await _validator.ValidateAsync(new ChangeUserRoleCommand(1, role));

        result.IsValid.Should().BeTrue();
    }

    [Fact]
    public async Task Validate_InvalidRole_FailsValidation()
    {
        var result = await _validator.ValidateAsync(new ChangeUserRoleCommand(1, "SUPERUSER"));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(ChangeUserRoleCommand.NewRole));
    }

    [Fact]
    public async Task Validate_EmptyRole_FailsValidation()
    {
        var result = await _validator.ValidateAsync(new ChangeUserRoleCommand(1, ""));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(ChangeUserRoleCommand.NewRole));
    }

    [Fact]
    public async Task Validate_UserIdZero_FailsValidation()
    {
        var result = await _validator.ValidateAsync(new ChangeUserRoleCommand(0, "ADMIN"));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(ChangeUserRoleCommand.UserId));
    }

    [Fact]
    public async Task Validate_UserIdNegative_FailsValidation()
    {
        var result = await _validator.ValidateAsync(new ChangeUserRoleCommand(-1, "ADMIN"));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().Contain(e => e.PropertyName == nameof(ChangeUserRoleCommand.UserId));
    }

    [Fact]
    public async Task Validate_MultipleErrors_AllReported()
    {
        // Both UserId and NewRole are invalid → expect both errors
        var result = await _validator.ValidateAsync(new ChangeUserRoleCommand(0, "INVALID"));

        result.IsValid.Should().BeFalse();
        result.Errors.Should().HaveCountGreaterThanOrEqualTo(2);
    }
}
