using IdentityService.Domain.Entities;
using IdentityService.Domain.Enums;

namespace IdentityService.Domain.Interfaces;

public interface ICinemaAssignmentRepository
{
    Task<IReadOnlyList<CinemaAssignment>> ListByUserAsync(long userId, CancellationToken ct = default);

    Task<IReadOnlyList<long>> ListCinemaIdsAsync(long userId, AssignmentDuty duty, CancellationToken ct = default);

    void Add(CinemaAssignment assignment);

    void Remove(CinemaAssignment assignment);
}
