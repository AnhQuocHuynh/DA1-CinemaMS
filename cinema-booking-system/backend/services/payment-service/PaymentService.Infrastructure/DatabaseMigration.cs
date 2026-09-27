using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using PaymentService.Infrastructure.Data;

namespace PaymentService.Infrastructure;

public static class DatabaseMigration
{
    /// <summary>
    /// Auto-applies any pending EF Core migrations for the Payment database.
    /// Call this from the composition root after building the application host.
    /// </summary>
    public static void MigratePaymentDatabase(this IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<PaymentDbContext>();
        dbContext.Database.Migrate();
    }
}
