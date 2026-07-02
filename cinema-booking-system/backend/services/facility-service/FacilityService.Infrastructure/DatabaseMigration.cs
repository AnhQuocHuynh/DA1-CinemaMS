using FacilityService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;

namespace FacilityService.Infrastructure
{
    public static class DatabaseMigration
    {
        /// <summary>
        /// Auto-applies any pending EF Core migrations for the Facility database.
        /// Call this from the composition root after building the application host.
        /// </summary>
        public static void MigrateFacilityDatabase(this IServiceProvider serviceProvider)
        {
            using var scope = serviceProvider.CreateScope();
            var dbContext = scope.ServiceProvider.GetRequiredService<FacilityDbContext>();
            dbContext.Database.Migrate();
        }
    }
}
