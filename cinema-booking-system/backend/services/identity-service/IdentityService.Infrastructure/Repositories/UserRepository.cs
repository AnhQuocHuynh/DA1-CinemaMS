using IdentityService.Domain.Entities;
using IdentityService.Domain.Interfaces;
using IdentityService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Infrastructure.Repositories;

public class UserRepository : IUserRepository
{
    private readonly UserProfileDbContext _context;

    public UserRepository(UserProfileDbContext context)
    {
        _context = context;
    }

    public async Task<User?> GetByIdAsync(long id, CancellationToken ct = default)
    {
        return await _context.Users.FirstOrDefaultAsync(u => u.Id == id, ct);
    }

    public async Task<User?> GetByKeycloakIdAsync(string keycloakId, CancellationToken ct = default)
    {
        return await _context.Users.FirstOrDefaultAsync(u => u.KeycloakId == keycloakId, ct);
    }

    public async Task<User?> GetByEmailAsync(string email, CancellationToken ct = default)
    {
        return await _context.Users.FirstOrDefaultAsync(u => u.Email == email, ct);
    }

    public void Add(User user)
    {
        _context.Users.Add(user);
    }

    public void Update(User user)
    {
        _context.Users.Update(user);
    }

    public async Task<int> CountAsync(CancellationToken ct = default)
    {
        return await _context.Users.CountAsync(ct);
    }

    public async Task<(IEnumerable<User> Users, int TotalCount)> GetPagedAsync(int page, int pageSize, CancellationToken ct = default)
    {
        var query = _context.Users.AsQueryable();
        var totalCount = await query.CountAsync(ct);
        var users = await query.OrderByDescending(u => u.CreatedAt)
                               .Skip((page - 1) * pageSize)
                               .Take(pageSize)
                               .ToListAsync(ct);
        return (users, totalCount);
    }
}
