using IdentityService.Domain.Interfaces;
using IdentityService.Infrastructure.Data;
using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Infrastructure.Repositories;

public class UnitOfWork : IUnitOfWork
{
    private readonly UserProfileDbContext _context;

    public UnitOfWork(UserProfileDbContext context)
    {
        _context = context;
    }

    public async Task<int> SaveChangesAsync(CancellationToken ct = default)
    {
        return await _context.SaveChangesAsync(ct);
    }
}
