using FluentAssertions;
using IdentityService.Domain.Entities;
using IdentityService.Domain.Enums;
using System;
using Xunit;

namespace IdentityService.Test.Unit.Entities;

public class UserTests
{
    // ─── Constructor ─────────────────────────────────────────────────────────

    [Fact]
    public void Constructor_FullParams_SetsAllFields()
    {
        var dob = new DateTime(1990, 5, 15);
        var user = new User("kc-id", "test@example.com", "Test User", "0123456789", Gender.FEMALE, dob, false);

        user.KeycloakId.Should().Be("kc-id");
        user.Email.Should().Be("test@example.com");
        user.FullName.Should().Be("Test User");
        user.Phone.Should().Be("0123456789");
        user.Gender.Should().Be(Gender.FEMALE);
        user.DateOfBirth.Should().Be(dob);
        user.Active.Should().BeFalse();
        user.UpdatedAt.Should().BeNull();
    }

    [Fact]
    public void Constructor_Minimal_SetsActiveAndDefaultNulls()
    {
        var user = new User("kc-id", "test@example.com", "Test User");

        user.KeycloakId.Should().Be("kc-id");
        user.Email.Should().Be("test@example.com");
        user.FullName.Should().Be("Test User");
        user.Active.Should().BeTrue();
        user.Phone.Should().BeNull();
        user.Gender.Should().BeNull();
        user.DateOfBirth.Should().BeNull();
        user.UpdatedAt.Should().BeNull();
    }

    // ─── UpdateProfile ───────────────────────────────────────────────────────

    [Fact]
    public void UpdateProfile_ShouldUpdateFieldsAndSetUpdatedAt()
    {
        var user = new User("test-uuid", "test@example.com", "Test User");
        typeof(User).GetProperty("Id")?.SetValue(user, 1L);
        var newPhone = "1234567890";
        var newGender = Gender.MALE;
        var newDob = new DateTime(1990, 1, 1);

        user.UpdateProfile(newPhone, newGender, newDob);

        user.Phone.Should().Be(newPhone);
        user.Gender.Should().Be(newGender);
        user.DateOfBirth.Should().Be(newDob);
        user.UpdatedAt.Should().NotBeNull();
        user.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void UpdateProfile_WithNullValues_ClearsOptionalFields()
    {
        var user = new User("kc-id", "test@example.com", "Test User", "0123456789", Gender.MALE, new DateTime(1990, 1, 1), true);

        user.UpdateProfile(null, null, null);

        user.Phone.Should().BeNull();
        user.Gender.Should().BeNull();
        user.DateOfBirth.Should().BeNull();
        user.UpdatedAt.Should().NotBeNull();
    }

    // ─── SyncKeycloakData ────────────────────────────────────────────────────

    [Fact]
    public void SyncKeycloakData_ShouldUpdateFieldsAndSetUpdatedAt()
    {
        var user = new User("test-uuid", "old@example.com", "Old Name");
        typeof(User).GetProperty("Id")?.SetValue(user, 1L);

        user.SyncKeycloakData(user.KeycloakId, "new@example.com", "New Name", true);

        user.Email.Should().Be("new@example.com");
        user.FullName.Should().Be("New Name");
        user.Active.Should().BeTrue();
        user.UpdatedAt.Should().NotBeNull();
        user.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void SyncKeycloakData_WithNullActive_DoesNotChangeActiveStatus()
    {
        var user = new User("kc-id", "test@example.com", "Test User"); // Active = true by default

        user.SyncKeycloakData("new-kc-id", "new@example.com", "New Name", active: null);

        user.Active.Should().BeTrue();   // unchanged
        user.KeycloakId.Should().Be("new-kc-id");
        user.Email.Should().Be("new@example.com");
        user.FullName.Should().Be("New Name");
        user.UpdatedAt.Should().NotBeNull();
    }

    // ─── Deactivate ──────────────────────────────────────────────────────────

    [Fact]
    public void Deactivate_WhenActive_SetsActiveFalseAndSetsUpdatedAt()
    {
        var user = new User("kc-id", "test@example.com", "Test User"); // Active = true

        user.Deactivate();

        user.Active.Should().BeFalse();
        user.UpdatedAt.Should().NotBeNull();
        user.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void Deactivate_WhenAlreadyInactive_IsIdempotent_DoesNotSetUpdatedAt()
    {
        // Created with active=false; UpdatedAt is null since no operation was run yet
        var user = new User("kc-id", "test@example.com", "Test User", null, null, null, false);

        user.Deactivate(); // guard: if (Active) → skipped

        user.Active.Should().BeFalse();
        user.UpdatedAt.Should().BeNull(); // never touched
    }

    // ─── Activate ────────────────────────────────────────────────────────────

    [Fact]
    public void Activate_WhenInactive_SetsActiveTrueAndSetsUpdatedAt()
    {
        var user = new User("kc-id", "test@example.com", "Test User", null, null, null, false);

        user.Activate();

        user.Active.Should().BeTrue();
        user.UpdatedAt.Should().NotBeNull();
        user.UpdatedAt.Should().BeCloseTo(DateTime.UtcNow, TimeSpan.FromSeconds(1));
    }

    [Fact]
    public void Activate_WhenAlreadyActive_IsIdempotent_DoesNotSetUpdatedAt()
    {
        var user = new User("kc-id", "test@example.com", "Test User"); // Active = true

        user.Activate(); // guard: if (!Active) → skipped

        user.Active.Should().BeTrue();
        user.UpdatedAt.Should().BeNull(); // never touched
    }
}
