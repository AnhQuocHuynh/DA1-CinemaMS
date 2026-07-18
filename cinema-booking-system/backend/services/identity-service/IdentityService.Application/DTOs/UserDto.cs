using IdentityService.Domain.Enums;
using System;

namespace IdentityService.Application.DTOs;

public record UserDto(
    long Id,
    string KeycloakId,
    string Email,
    string FullName,
    string? Phone,
    Gender? Gender,
    DateTime? DateOfBirth,
    bool Active
);
