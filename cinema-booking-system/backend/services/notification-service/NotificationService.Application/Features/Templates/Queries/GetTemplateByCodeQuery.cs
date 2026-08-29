using System.Threading;
using System.Threading.Tasks;
using MediatR;
using NotificationService.Application.DTOs;
using NotificationService.Application.Exceptions;
using NotificationService.Domain.Interfaces;

namespace NotificationService.Application.Features.Templates.Queries;

public record GetTemplateByCodeQuery(string Code) : IRequest<TemplateDto>;

public class GetTemplateByCodeQueryHandler : IRequestHandler<GetTemplateByCodeQuery, TemplateDto>
{
    private readonly ITemplateRepository _templateRepository;

    public GetTemplateByCodeQueryHandler(ITemplateRepository templateRepository)
    {
        _templateRepository = templateRepository;
    }

    public async Task<TemplateDto> Handle(GetTemplateByCodeQuery request, CancellationToken cancellationToken)
    {
        var template = await _templateRepository.GetByCodeAsync(request.Code, cancellationToken)
            ?? throw new TemplateNotFoundException(request.Code);
            
        return new TemplateDto
        {
            Id = template.Id,
            Code = template.Code,
            Channel = template.Channel,
            Subject = template.Subject,
            BodyTemplate = template.BodyTemplate,
            Active = template.Active,
            CreatedAt = template.CreatedAt,
            UpdatedAt = template.UpdatedAt
        };
    }
}
