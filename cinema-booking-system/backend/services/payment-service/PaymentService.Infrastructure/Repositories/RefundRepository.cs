using Microsoft.EntityFrameworkCore;
using PaymentService.Domain.Entities;
using PaymentService.Domain.Interfaces;
using PaymentService.Infrastructure.Data;

namespace PaymentService.Infrastructure.Repositories;

public class RefundRepository : IRefundRepository
{
    private readonly PaymentDbContext _context;

    public RefundRepository(PaymentDbContext context)
    {
        _context = context;
    }

    public async Task<Refund?> GetByIdAsync(long id, CancellationToken cancellationToken = default)
    {
        return await _context.Refunds
            .FirstOrDefaultAsync(r => r.Id == id, cancellationToken);
    }

    public async Task<IEnumerable<Refund>> GetByPaymentIdAsync(long paymentId, CancellationToken cancellationToken = default)
    {
        return await _context.Refunds
            .Where(r => r.PaymentId == paymentId)
            .OrderByDescending(r => r.CreatedAt)
            .AsNoTracking()
            .ToListAsync(cancellationToken);
    }

    public async Task AddAsync(Refund refund, CancellationToken cancellationToken = default)
    {
        await _context.Refunds.AddAsync(refund, cancellationToken);
    }
}
