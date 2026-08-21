using FacilityService.Application.DTOs;
using FacilityService.Domain.Interfaces;
using MediatR;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;
using System;

namespace FacilityService.Application.Features.Cinemas.Queries
{
    public class GetCinemaByIdQuery : IRequest<CinemaDto>
    {
        public required long Id { get; set; }
    }
    public class GetCinemaByIdQueryHandler : IRequestHandler<GetCinemaByIdQuery, CinemaDto>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IDistributedCache _cache;
        
        public GetCinemaByIdQueryHandler(IUnitOfWork unitOfWork, IDistributedCache cache)
        {
            _unitOfWork = unitOfWork;
            _cache = cache;
        }

        public async Task<CinemaDto> Handle(GetCinemaByIdQuery request, CancellationToken cancellationToken)
        {
            var cacheKey = $"facility:cinema:{request.Id}";
            var cachedData = await _cache.GetStringAsync(cacheKey, cancellationToken);
            if (!string.IsNullOrEmpty(cachedData))
            {
                return JsonSerializer.Deserialize<CinemaDto>(cachedData)!;
            }

            var cinema = await _unitOfWork.Cinemas.GetByIdAsync(request.Id);
            if (cinema == null)
            {
                throw new Application.Exceptions.CinemaNotFoundException(request.Id);
            }
            var result = new CinemaDto 
            { 
                Id = cinema.Id, 
                Name = cinema.Name, 
                Address = cinema.Address, 
                City = cinema.City, 
                Phone = cinema.Phone 
            };

            await _cache.SetStringAsync(
                cacheKey,
                JsonSerializer.Serialize(result),
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromHours(24) },
                cancellationToken);

            return result;
        }
    }
}