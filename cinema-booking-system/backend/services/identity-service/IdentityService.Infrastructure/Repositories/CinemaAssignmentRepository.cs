using IdentityService.Domain.Entities;
using IdentityService.Domain.Enums;
using IdentityService.Domain.Interfaces;
using IdentityService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace IdentityService.Infrastructure.Repositories;

public class CinemaAssignmentRepository : ICinemaAssignmentRepository
{
    private readonly UserProfileDbContext _context;

    public CinemaAssignmentRepository(UserProfileDbContext context)
    {
        _context = context;
    }

    public async Task<IReadOnlyList<CinemaAssignment>> ListByUserAsync(long userId, CancellationToken ct = default)
    {
        return await _context.CinemaAssignments
            .Where(x => x.UserId == userId)
            .OrderBy(x => x.CinemaId)
            .ToListAsync(ct);
    }

    public async Task<IReadOnlyList<long>> ListCinemaIdsAsync(long userId, AssignmentDuty duty, CancellationToken ct = default)
    {
        return await _context.CinemaAssignments
            .Where(x => x.UserId == userId && x.Duty == duty)
            .Select(x => x.CinemaId)
            .ToListAsync(ct);
    }

    public void Add(CinemaAssignment assignment)
    {
        _context.CinemaAssignments.Add(assignment);
    }

    public void Remove(CinemaAssignment assignment)
    {
        _context.CinemaAssignments.Remove(assignment);
    }
}
