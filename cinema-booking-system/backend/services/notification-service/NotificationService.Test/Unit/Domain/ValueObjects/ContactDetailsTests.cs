using System;
using FluentAssertions;
using NotificationService.Domain.ValueObjects;
using Xunit;

namespace NotificationService.Test.Unit.Domain.ValueObjects;

public class ContactDetailsTests
{
    [Fact]
    public void Constructor_ShouldInitializeProperties()
    {
        var contact = new ContactDetails("test@example.com", "1234567890");
        contact.Email.Should().Be("test@example.com");
        contact.PhoneNumber.Should().Be("1234567890");
    }

    [Theory]
    [InlineData("")]
    [InlineData(" ")]
    [InlineData(null)]
    public void Constructor_ShouldThrowArgumentException_WhenEmailIsInvalid(string? invalidEmail)
    {
        var act = () => new ContactDetails(invalidEmail!);
        act.Should().Throw<ArgumentException>().WithMessage("*Email is required.*");
    }

    [Fact]
    public void Equals_ShouldReturnTrue_ForIdenticalValues()
    {
        var contact1 = new ContactDetails("test@example.com", "123");
        var contact2 = new ContactDetails("test@example.com", "123");

        contact1.Should().Be(contact2);
        (contact1 == contact2).Should().BeTrue();
    }

    [Fact]
    public void Equals_ShouldReturnFalse_ForDifferentValues()
    {
        var contact1 = new ContactDetails("test@example.com", "123");
        var contact2 = new ContactDetails("other@example.com", "123");

        contact1.Should().NotBe(contact2);
        (contact1 != contact2).Should().BeTrue();
    }
}
