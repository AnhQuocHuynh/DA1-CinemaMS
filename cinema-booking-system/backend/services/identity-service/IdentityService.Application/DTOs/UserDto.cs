using IdentityService.Domain.Enums;
using System;
using System.Collections.Generic;

namespace IdentityService.Application.DTOs;

public record UserDto(
    long Id,
    string KeycloakId,
    string Email,
    string FullName,
    string? Phone,
    Gender? Gender,
    DateTime? DateOfBirth,
    bool Active,
    IEnumerable<string>? Roles = null   // Keycloak realm roles, e.g. ["CUSTOMER"], ["ADMIN"]
);

