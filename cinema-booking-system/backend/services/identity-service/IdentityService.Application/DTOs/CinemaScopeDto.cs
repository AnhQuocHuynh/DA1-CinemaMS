using System.Collections.Generic;

namespace IdentityService.Application.DTOs;

public record CinemaScopeDto(
    string RealmRole,
    IReadOnlyList<long> CinemaIds
);

