using FacilityService.Domain.Interfaces;
using FacilityService.Infrastructure.Data;
using FacilityService.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace FacilityService.Infrastructure
{
    public static class DependencyInjection
    {
        public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
        {
            /*
            services.AddDbContext<FacilityDbContext>(options =>
                options.UseNpgsql(configuration.GetConnectionString("DefaultConnection")));

            services.AddScoped<ICinemaRepository, CinemaRepository>();
            services.AddScoped<IUnitOfWork, UnitOfWork>();
            */
            return services;
        }
    }
}
