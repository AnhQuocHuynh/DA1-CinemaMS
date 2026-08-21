using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using FacilityService.Application.DTOs;
using FacilityService.Domain.Interfaces;
using MediatR;
using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;
using System;

namespace FacilityService.Application.Features.Cinemas.Queries
{
    public class GetCinemasQuery : IRequest<IEnumerable<CinemaDto>>
    {
    }

    public class GetCinemasQueryHandler : IRequestHandler<GetCinemasQuery, IEnumerable<CinemaDto>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IDistributedCache _cache;
        
        public GetCinemasQueryHandler(IUnitOfWork unitOfWork, IDistributedCache cache)
        {
            _unitOfWork = unitOfWork;
            _cache = cache;
        }

        public async Task<IEnumerable<CinemaDto>> Handle(GetCinemasQuery request, CancellationToken cancellationToken)
        {
            var cacheKey = "facility:cinemas:all";
            var cachedData = await _cache.GetStringAsync(cacheKey, cancellationToken);
            if (!string.IsNullOrEmpty(cachedData))
            {
                return JsonSerializer.Deserialize<IEnumerable<CinemaDto>>(cachedData)!;
            }

            var cinemas = await _unitOfWork.Cinemas.GetAllAsync();
            var result = cinemas.Where(c => c.Active).Select(c => new CinemaDto 
            { 
                Id = c.Id, 
                Name = c.Name, 
                Address = c.Address, 
                City = c.City, 
                Phone = c.Phone 
            }).ToList();

            await _cache.SetStringAsync(
                cacheKey,
                JsonSerializer.Serialize(result),
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24) },
                cancellationToken);

            return result;
        }
    }
}
