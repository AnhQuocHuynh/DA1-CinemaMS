using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using PaymentService.Domain.Entities;

namespace PaymentService.Domain.Interfaces;

public interface IRefundRepository
{
    Task<Refund?> GetByIdAsync(long id, CancellationToken cancellationToken = default);
    Task<IEnumerable<Refund>> GetByPaymentIdAsync(long paymentId, CancellationToken cancellationToken = default);
    Task AddAsync(Refund refund, CancellationToken cancellationToken = default);
}
