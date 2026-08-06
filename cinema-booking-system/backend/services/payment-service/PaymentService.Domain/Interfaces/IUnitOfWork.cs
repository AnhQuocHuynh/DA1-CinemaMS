using System.Threading;
using System.Threading.Tasks;

namespace PaymentService.Domain.Interfaces;

public interface IUnitOfWork
{
    Task<int> SaveChangesAsync(CancellationToken cancellationToken = default);
}
