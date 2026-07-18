using IdentityService.Domain.Enums;
using System;

namespace IdentityService.Domain.Entities;

public class User
{
    public long Id { get; private set; }
    public string KeycloakId { get; private set; } = string.Empty;
    public string Email { get; private set; } = string.Empty;
    public string FullName { get; private set; } = string.Empty;
    public string? Phone { get; private set; }
    public Gender? Gender { get; private set; }
    public DateTime? DateOfBirth { get; private set; }
    public bool Active { get; private set; } = true;
    public DateTime CreatedAt { get; private set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; private set; }

    public User()
    {
    } //EF core

    public User(string keycloakId, string email, string fullName, string? phone, Gender? gender, DateTime? dateOfBirth, bool active)
    {
        KeycloakId = keycloakId;
        Email = email;
        FullName = fullName;
        Phone = phone;
        Gender = gender;
        DateOfBirth = dateOfBirth;
        Active = active;

    }

    public User(string keycloakId, string email, string fullName)
    {
        KeycloakId = keycloakId;
        Email = email;
        FullName = fullName;
        Active = true;
    }

    public void UpdateProfile(string? phone, Gender? gender, DateTime? dateOfBirth)
    {
        Phone = phone;
        Gender = gender;
        DateOfBirth = dateOfBirth;
        UpdatedAt = DateTime.UtcNow;
    }

    public void SyncKeycloakData(string email, string fullName, bool? active = null)
    {
        Email = email;
        FullName = fullName;
        if (active.HasValue)
        {
            Active = active.Value;
        }
        UpdatedAt = DateTime.UtcNow;
    }

    public void Deactivate()
    {
        if (Active)
        {
            Active = false;
            UpdatedAt = DateTime.UtcNow;
        }
    }

    public void Activate()
    {
        if (!Active)
        {
            Active = true;
            UpdatedAt = DateTime.UtcNow;
        }
    }
}
