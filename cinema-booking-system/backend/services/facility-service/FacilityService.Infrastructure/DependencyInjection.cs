using FacilityService.Application.Contracts;
using FacilityService.Domain.Interfaces;
using FacilityService.Infrastructure.Data;
using FacilityService.Infrastructure.HttpClients;
using FacilityService.Infrastructure.Repositories;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using System.Net.Http;

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
            services.AddHttpClient<IShowtimeServiceClient, ShowtimeServiceClient>(client =>
            {
                var baseUrl = configuration["ServiceUrls:ShowtimeService"] ?? throw new ArgumentNullException("ServiceUrls:ShowtimeService is missing");
                client.BaseAddress = new Uri(baseUrl);
            });
            */

            return services;
        }
    }
}
