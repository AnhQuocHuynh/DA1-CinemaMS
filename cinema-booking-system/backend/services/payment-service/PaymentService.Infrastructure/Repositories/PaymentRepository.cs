using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.EntityFrameworkCore;
using PaymentService.Domain.Entities;
using PaymentService.Domain.Enums;
using PaymentService.Domain.Interfaces;
using PaymentService.Infrastructure.Data;

namespace PaymentService.Infrastructure.Repositories;

public class PaymentRepository : IPaymentRepository
{
    private readonly PaymentDbContext _context;

    public PaymentRepository(PaymentDbContext context)
    {
        _context = context;
    }

    public async Task<Payment?> GetByIdAsync(long id, CancellationToken cancellationToken = default)
    {
        return await _context.Payments
            .Include(p => p.Refunds)
            .FirstOrDefaultAsync(p => p.Id == id, cancellationToken);
    }

    public async Task<Payment?> GetByOrderIdAsync(long orderId, CancellationToken cancellationToken = default)
    {
        return await _context.Payments
            .Include(p => p.Refunds)
            .FirstOrDefaultAsync(p => p.OrderId == orderId, cancellationToken);
    }

    public async Task<IEnumerable<Payment>> GetByUserIdAsync(long userId, CancellationToken cancellationToken = default)
    {
        return await _context.Payments
            .Include(p => p.Refunds)
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .AsNoTracking()
            .ToListAsync(cancellationToken);
    }

    public async Task<(IEnumerable<Payment> Items, int TotalCount)> GetPaginatedAsync(
        int page, int pageSize, CancellationToken cancellationToken = default)
    {
        var query = _context.Payments
            .Include(p => p.Refunds)
            .OrderByDescending(p => p.CreatedAt)
            .AsNoTracking();

        var totalCount = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(cancellationToken);

        return (items, totalCount);
    }

    public async Task AddAsync(Payment payment, CancellationToken cancellationToken = default)
    {
        await _context.Payments.AddAsync(payment, cancellationToken);
    }

    public async Task<List<(long Id, Guid SagaId)>> ClaimExpiredPaymentsAsync(
        DateTime cutoff, int batchSize = 50, CancellationToken cancellationToken = default)
    {
        var candidates = await _context.Payments
            .Where(p => p.Status == PaymentStatus.CREATED && p.CreatedAt <= cutoff)
            .OrderBy(p => p.CreatedAt)
            .Select(p => new { p.Id, p.SagaId })
            .Take(batchSize)
            .ToListAsync(cancellationToken);

        var claimed = new List<(long Id, Guid SagaId)>();

        foreach (var candidate in candidates)
        {
            var affected = await _context.Payments
                .Where(p => p.Id == candidate.Id && p.Status == PaymentStatus.CREATED)
                .ExecuteUpdateAsync(s => s
                    .SetProperty(p => p.Status, PaymentStatus.EXPIRED)
                    .SetProperty(p => p.UpdatedAt, DateTime.UtcNow),
                    cancellationToken);

            if (affected > 0)
            {
                claimed.Add((candidate.Id, candidate.SagaId));
            }
        }

        return claimed;
    }
}
