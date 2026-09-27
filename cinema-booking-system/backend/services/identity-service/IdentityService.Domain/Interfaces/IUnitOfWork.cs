using System.Threading;
using System.Threading.Tasks;

namespace IdentityService.Domain.Interfaces;

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken ct = default);
}
