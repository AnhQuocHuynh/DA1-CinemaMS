using PaymentService.Domain.Entities;
using PaymentService.Domain.Interfaces;
using PaymentService.Infrastructure.Data;

namespace PaymentService.Infrastructure.Repositories;

public class TransactionLogRepository : ITransactionLogRepository
{
    private readonly PaymentDbContext _context;

    public TransactionLogRepository(PaymentDbContext context)
    {
        _context = context;
    }

    public async Task AddAsync(TransactionLog transactionLog, CancellationToken cancellationToken = default)
    {
        await _context.TransactionLogs.AddAsync(transactionLog, cancellationToken);
    }
}
