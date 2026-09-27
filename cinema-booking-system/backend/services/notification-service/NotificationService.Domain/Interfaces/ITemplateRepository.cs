using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using NotificationService.Domain.Entities;

namespace NotificationService.Domain.Interfaces;

public interface ITemplateRepository
{
    Task InsertAsync(NotificationTemplate template, CancellationToken cancellationToken = default);
    Task UpdateAsync(NotificationTemplate template, CancellationToken cancellationToken = default);
    Task<NotificationTemplate?> GetByCodeAsync(string code, CancellationToken cancellationToken = default);
    Task<IEnumerable<NotificationTemplate>> GetAllAsync(CancellationToken cancellationToken = default);
}
