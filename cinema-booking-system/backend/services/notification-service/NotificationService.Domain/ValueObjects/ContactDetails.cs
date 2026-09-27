using System;
using System.Collections.Generic;

namespace NotificationService.Domain.ValueObjects;

public class ContactDetails : IEquatable<ContactDetails>
{
    public string Email { get; private set; }
    public string? PhoneNumber { get; private set; }

    public ContactDetails(string email, string? phoneNumber = null)
    {
        if (string.IsNullOrWhiteSpace(email)) throw new ArgumentException("Email is required.", nameof(email));
        
        Email = email;
        PhoneNumber = phoneNumber;
    }

    public override bool Equals(object? obj)
    {
        return Equals(obj as ContactDetails);
    }

    public bool Equals(ContactDetails? other)
    {
        if (other is null) return false;
        
        return Email == other.Email && 
               PhoneNumber == other.PhoneNumber;
    }

    public override int GetHashCode()
    {
        return HashCode.Combine(Email, PhoneNumber);
    }

    public static bool operator ==(ContactDetails? left, ContactDetails? right)
    {
        if (left is null && right is null) return true;
        if (left is null || right is null) return false;
        return left.Equals(right);
    }

    public static bool operator !=(ContactDetails? left, ContactDetails? right)
    {
        return !(left == right);
    }
}
