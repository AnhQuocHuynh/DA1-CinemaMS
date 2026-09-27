using System.Threading;
using System.Threading.Tasks;
using PaymentService.Domain.Entities;

namespace PaymentService.Domain.Interfaces;

public interface ITransactionLogRepository
{
    Task AddAsync(TransactionLog transactionLog, CancellationToken cancellationToken = default);
}
