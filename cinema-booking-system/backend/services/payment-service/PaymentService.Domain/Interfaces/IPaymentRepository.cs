using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using PaymentService.Domain.Entities;

namespace PaymentService.Domain.Interfaces;

public interface IPaymentRepository
{
    Task<Payment?> GetByIdAsync(long id, CancellationToken cancellationToken = default);
    Task<Payment?> GetByOrderIdAsync(long orderId, CancellationToken cancellationToken = default);
    Task<IEnumerable<Payment>> GetByUserIdAsync(long userId, CancellationToken cancellationToken = default);
    Task<(IEnumerable<Payment> Items, int TotalCount)> GetPaginatedAsync(int page, int pageSize, CancellationToken cancellationToken = default);
    Task AddAsync(Payment payment, CancellationToken cancellationToken = default);
}
