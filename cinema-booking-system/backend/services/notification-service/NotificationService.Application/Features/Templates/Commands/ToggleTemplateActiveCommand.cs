using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using NotificationService.Application.Exceptions;
using NotificationService.Domain.Interfaces;

namespace NotificationService.Application.Features.Templates.Commands;

public record ToggleTemplateActiveCommand(string Id, bool Active) : IRequest;

public class ToggleTemplateActiveCommandValidator : AbstractValidator<ToggleTemplateActiveCommand>
{
    public ToggleTemplateActiveCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
    }
}

public class ToggleTemplateActiveCommandHandler : IRequestHandler<ToggleTemplateActiveCommand>
{
    private readonly ITemplateRepository _templateRepository;

    public ToggleTemplateActiveCommandHandler(ITemplateRepository templateRepository)
    {
        _templateRepository = templateRepository;
    }

    public async Task Handle(ToggleTemplateActiveCommand request, CancellationToken cancellationToken)
    {
        var template = await _templateRepository.GetByIdAsync(request.Id, cancellationToken)
            ?? throw new TemplateNotFoundException(request.Id);

        template.ToggleActive(request.Active);

        await _templateRepository.UpdateAsync(template, cancellationToken);
    }
}
