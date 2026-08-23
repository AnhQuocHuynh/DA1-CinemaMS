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
    public class GetCinemasWithRoomsQuery : IRequest<IEnumerable<CinemaWithRoomsDto>>
    {
    }

    public class GetCinemasWithRoomsQueryHandler : IRequestHandler<GetCinemasWithRoomsQuery, IEnumerable<CinemaWithRoomsDto>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IDistributedCache _cache;

        public GetCinemasWithRoomsQueryHandler(IUnitOfWork unitOfWork, IDistributedCache cache)
        {
            _unitOfWork = unitOfWork;
            _cache = cache;
        }

        public async Task<IEnumerable<CinemaWithRoomsDto>> Handle(GetCinemasWithRoomsQuery request, CancellationToken cancellationToken)
        {
            var cacheKey = "facility:cinemas:with-rooms";
            var cachedData = await _cache.GetStringAsync(cacheKey, cancellationToken);
            if (!string.IsNullOrEmpty(cachedData))
            {
                return JsonSerializer.Deserialize<IEnumerable<CinemaWithRoomsDto>>(cachedData)!;
            }

            var cinemas = await _unitOfWork.Cinemas.GetAllWithRoomsAsync();
            var result = cinemas.Where(c => c.Active).Select(c => new CinemaWithRoomsDto
            {
                Id = c.Id,
                Name = c.Name,
                Address = c.Address,
                City = c.City,
                Phone = c.Phone,
                Active = c.Active,
                Rooms = c.Rooms.Select(r => new RoomDto
                {
                    Id = r.Id,
                    CinemaId = r.CinemaId,
                    Name = r.Name,
                    Type = r.Type,
                    TotalSeats = r.TotalSeats,
                    Rows = r.Rows,
                    Columns = r.Columns,
                    Active = r.Active,
                    UnderMaintenance = r.UnderMaintenance,
                }).ToList()
            }).ToList();

            await _cache.SetStringAsync(
                cacheKey,
                JsonSerializer.Serialize(result),
                new DistributedCacheEntryOptions { AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(10) },
                cancellationToken);

            return result;
        }
    }
}
