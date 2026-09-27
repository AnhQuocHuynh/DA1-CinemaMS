using FacilityService.Application.DTOs;
using FacilityService.Domain.Interfaces;
using MediatR;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;
using System;

namespace FacilityService.Application.Features.Rooms.Queries
{
    public class GetRoomsByCinemaQuery : IRequest<List<RoomDto>>
    {
        public long CinemaId { get; set; }
    }

    public class GetRoomsByCinemaQueryHandler : IRequestHandler<GetRoomsByCinemaQuery, List<RoomDto>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IDistributedCache _cache;

        public GetRoomsByCinemaQueryHandler(IUnitOfWork unitOfWork, IDistributedCache cache)
        {
            _unitOfWork = unitOfWork;
            _cache = cache;
        }

        public async Task<List<RoomDto>> Handle(GetRoomsByCinemaQuery request, CancellationToken cancellationToken)
        {
            var cacheKey = $"facility:rooms:cinema:{request.CinemaId}";
            var cachedData = await _cache.GetStringAsync(cacheKey, cancellationToken);
            if (!string.IsNullOrEmpty(cachedData))
            {
                return JsonSerializer.Deserialize<List<RoomDto>>(cachedData)!;
            }

            var rooms = await _unitOfWork.Rooms.GetRoomsByCinemaIdAsync(request.CinemaId);
            
            var result = rooms.Select(r => new RoomDto
            {
                Id = r.Id,
                CinemaId = r.CinemaId,
                Name = r.Name,
                Type = r.Type,
                TotalSeats = r.TotalSeats,
                Rows = r.Rows,
                Columns = r.Columns,
                Active = r.Active,
                UnderMaintenance = r.UnderMaintenance
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
