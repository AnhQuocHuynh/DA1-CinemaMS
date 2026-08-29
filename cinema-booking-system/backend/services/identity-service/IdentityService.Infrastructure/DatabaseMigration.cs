using IdentityService.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using System;
using System.Threading.Tasks;

namespace IdentityService.Infrastructure;

public static class DatabaseMigration
{
    public static async Task ApplyMigrationAsync(IServiceProvider serviceProvider)
    {
        using var scope = serviceProvider.CreateScope();
        var context = scope.ServiceProvider.GetRequiredService<UserProfileDbContext>();
        if (context.Database.IsRelational())
        {
            await context.Database.MigrateAsync();
        }

        if (!await context.Users.AnyAsync(u => u.Email == "admin@cinema.com"))
        {
            var adminUser = new Domain.Entities.User(
                "9d3daeff-b47a-417c-9897-3dbb35a7627b",
                "admin@cinema.com",
                "admin test",
                null,
                Domain.Enums.Gender.MALE,
                null,
                true
            );
            context.Users.Add(adminUser);
        }

        if (!await context.Users.AnyAsync(u => u.Email == "user@cinema.com"))
        {
            var normalUser = new Domain.Entities.User(
                "cb0855ef-fd6f-4a1c-9aa9-f509a46ac3e7",
                "user@cinema.com",
                "User User",
                "0908808888",
                Domain.Enums.Gender.MALE,
                null,
                true
            );
            context.Users.Add(normalUser);
        }

        await context.SaveChangesAsync();
    }
}
