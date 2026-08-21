using FacilityService.Application.DTOs;
using FacilityService.Domain.Interfaces;
using MediatR;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Extensions.Caching.Distributed;
using System.Text.Json;
using System;

namespace FacilityService.Application.Features.SeatTemplates.Queries
{
    public class GetSeatTemplateByIdQuery : IRequest<SeatTemplateDto>
    {
        public long Id { get; set; }
    }

    public class GetSeatTemplateByIdQueryHandler : IRequestHandler<GetSeatTemplateByIdQuery, SeatTemplateDto>
    {
        private readonly IUnitOfWork _unitOfWork;
        private readonly IDistributedCache _cache;

        public GetSeatTemplateByIdQueryHandler(IUnitOfWork unitOfWork, IDistributedCache cache)
        {
            _unitOfWork = unitOfWork;
            _cache = cache;
        }

        public async Task<SeatTemplateDto> Handle(GetSeatTemplateByIdQuery request, CancellationToken cancellationToken)
        {
            var cacheKey = $"facility:seattemplate:{request.Id}";
            var cachedData = await _cache.GetStringAsync(cacheKey, cancellationToken);
            if (!string.IsNullOrEmpty(cachedData))
            {
                return JsonSerializer.Deserialize<SeatTemplateDto>(cachedData)!;
            }

            var seat = await _unitOfWork.SeatTemplates.GetByIdAsync(request.Id);
            if (seat == null) throw new System.Exception($"Seat template {request.Id} not found");

            var result = new SeatTemplateDto
            {
                Id = seat.Id,
                RowLabel = seat.RowLabel,
                ColumnNumber = seat.ColumnNumber,
                SeatTypeCode = seat.SeatType?.Code.ToString(),
                ColumnSpan = seat.ColumnSpan,
                Active = seat.Active
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
