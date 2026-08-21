using FacilityService.Application.DTOs;
using FacilityService.Application.Exceptions;
using FacilityService.Domain.Interfaces;
using MediatR;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;
using System;

namespace FacilityService.Application.Features.Rooms.Queries
{
    public class GetRoomByIdQuery : IRequest<RoomDto>
    {
        public long Id { get; set; }
    }

    public class GetRoomByIdQueryHandler : IRequestHandler<GetRoomByIdQuery, RoomDto>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IDistributedCache _cache;

        public GetRoomByIdQueryHandler(IUnitOfWork unitOfWork, IDistributedCache cache)
        {
            _unitOfWork = unitOfWork;
            _cache = cache;
        }

        public async Task<RoomDto> Handle(GetRoomByIdQuery request, CancellationToken cancellationToken)
        {
            var cacheKey = $"facility:room:{request.Id}";
            var cachedData = await _cache.GetStringAsync(cacheKey, cancellationToken);
            if (!string.IsNullOrEmpty(cachedData))
            {
                return JsonSerializer.Deserialize<RoomDto>(cachedData)!;
            }

            var room = await _unitOfWork.Rooms.GetByIdAsync(request.Id);
            if (room == null) throw new RoomNotFoundException(request.Id);

            var result = new RoomDto
            {
                Id = room.Id,
                CinemaId = room.CinemaId,
                Name = room.Name,
                Type = room.Type,
                TotalSeats = room.TotalSeats,
                Rows = room.Rows,
                Columns = room.Columns,
                Active = room.Active,
                UnderMaintenance = room.UnderMaintenance
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
