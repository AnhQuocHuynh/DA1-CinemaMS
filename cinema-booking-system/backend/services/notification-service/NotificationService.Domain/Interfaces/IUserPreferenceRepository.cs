using System.Threading;
using System.Threading.Tasks;
using NotificationService.Domain.Entities;

namespace NotificationService.Domain.Interfaces;

public interface IUserPreferenceRepository
{
    Task<UserPreference?> GetByUserIdAsync(long userId, CancellationToken cancellationToken = default);
    Task UpsertAsync(UserPreference preference, CancellationToken cancellationToken = default);
}
