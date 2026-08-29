using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using NotificationService.Application.Exceptions;
using NotificationService.Domain.Interfaces;

namespace NotificationService.Application.Features.Templates.Commands;

public record ToggleTemplateActiveCommand(string Code, bool Active) : IRequest;

public class ToggleTemplateActiveCommandValidator : AbstractValidator<ToggleTemplateActiveCommand>
{
    public ToggleTemplateActiveCommandValidator()
    {
        RuleFor(x => x.Code).NotEmpty();
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
        var template = await _templateRepository.GetByCodeAsync(request.Code, cancellationToken)
            ?? throw new TemplateNotFoundException(request.Code);

        template.ToggleActive(request.Active);

        await _templateRepository.UpdateAsync(template, cancellationToken);
    }
}
