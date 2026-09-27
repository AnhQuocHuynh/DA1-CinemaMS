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

namespace FacilityService.Application.Features.SeatTemplates.Queries
{
    public class GetSeatTemplatesByRoomQuery : IRequest<List<SeatTemplateDto>>
    {
        public long RoomId { get; set; }
    }

    public class GetSeatTemplatesByRoomQueryHandler : IRequestHandler<GetSeatTemplatesByRoomQuery, List<SeatTemplateDto>>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IDistributedCache _cache;

        public GetSeatTemplatesByRoomQueryHandler(IUnitOfWork unitOfWork, IDistributedCache cache)
        {
            _unitOfWork = unitOfWork;
            _cache = cache;
        }

        public async Task<List<SeatTemplateDto>> Handle(GetSeatTemplatesByRoomQuery request, CancellationToken cancellationToken)
        {
            var cacheKey = $"facility:seattemplates:room:{request.RoomId}";
            var cachedData = await _cache.GetStringAsync(cacheKey, cancellationToken);
            if (!string.IsNullOrEmpty(cachedData))
            {
                return JsonSerializer.Deserialize<List<SeatTemplateDto>>(cachedData)!;
            }

            var room = await _unitOfWork.Rooms.GetByIdAsync(request.RoomId);
            if (room == null) throw new RoomNotFoundException(request.RoomId);

            var seats = await _unitOfWork.SeatTemplates.GetByRoomIdAsync(request.RoomId);
            
            var result = seats.Where(s => s.Active).Select(s => new SeatTemplateDto
            {
                Id = s.Id,
                RowLabel = s.RowLabel,
                ColumnNumber = s.ColumnNumber,
                SeatTypeCode = s.SeatType?.Code.ToString(),
                ColumnSpan = s.ColumnSpan,
                Active = s.Active
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
