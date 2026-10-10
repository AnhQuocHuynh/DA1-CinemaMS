namespace IdentityService.Application.DTOs;

public record CinemaAssignmentDto(long UserId, long CinemaId, string Duty);

public record CinemaScopeDto(string RealmRole, IReadOnlyList<long> CinemaIds);
