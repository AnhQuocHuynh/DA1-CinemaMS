using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using NotificationService.Application.DTOs;
using NotificationService.Domain.Interfaces;

namespace NotificationService.Application.Features.Templates.Queries;

public record GetTemplatesQuery : IRequest<IEnumerable<TemplateDto>>;

public class GetTemplatesQueryHandler : IRequestHandler<GetTemplatesQuery, IEnumerable<TemplateDto>>
{
    private readonly ITemplateRepository _templateRepository;

    public GetTemplatesQueryHandler(ITemplateRepository templateRepository)
    {
        _templateRepository = templateRepository;
    }

    public async Task<IEnumerable<TemplateDto>> Handle(GetTemplatesQuery request, CancellationToken cancellationToken)
    {
        var templates = await _templateRepository.GetAllAsync(cancellationToken);
        
        return templates.Select(t => new TemplateDto
        {
            Id = t.Id,
            Code = t.Code,
            Channel = t.Channel,
            Subject = t.Subject,
            BodyTemplate = t.BodyTemplate,
            Active = t.Active,
            CreatedAt = t.CreatedAt,
            UpdatedAt = t.UpdatedAt
        });
    }
}
