using FacilityService.Application.DTOs;
using FacilityService.Application.Exceptions;
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
    public class GetRoomSeatsInternalQuery : IRequest<List<InternalRoomSeatsDto>>
    {
        public long RoomId { get; set; }
    }

    public class GetRoomSeatsInternalQueryHandler : IRequestHandler<GetRoomSeatsInternalQuery, List<InternalRoomSeatsDto>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IDistributedCache _cache;

        public GetRoomSeatsInternalQueryHandler(IUnitOfWork unitOfWork, IDistributedCache cache)
        {
            _unitOfWork = unitOfWork;
            _cache = cache;
        }

        public async Task<List<InternalRoomSeatsDto>> Handle(GetRoomSeatsInternalQuery request, CancellationToken cancellationToken)
        {
            var cacheKey = $"facility:roomseats:{request.RoomId}";
            var cachedData = await _cache.GetStringAsync(cacheKey, cancellationToken);
            if (!string.IsNullOrEmpty(cachedData))
            {
                return JsonSerializer.Deserialize<List<InternalRoomSeatsDto>>(cachedData)!;
            }

            var room = await _unitOfWork.Rooms.GetByIdAsync(request.RoomId);
            if (room == null) throw new RoomNotFoundException(request.RoomId);

            var seats = await _unitOfWork.SeatTemplates.GetByRoomIdAsync(request.RoomId);
            
            var result = seats.Where(s => s.Active).Select(s => new InternalRoomSeatsDto
            {
                Id = s.Id,
                RowLabel = s.RowLabel,
                ColumnNumber = s.ColumnNumber,
                SeatTypeCode = s.SeatType?.Code.ToString(),
                ColumnSpan = s.ColumnSpan,
                Pathway = s.Pathway
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
