using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using NotificationService.Application.Exceptions;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;

namespace NotificationService.Application.Features.Templates.Commands;

public record UpdateTemplateCommand(
    string Code,
    NotificationChannel Channel,
    string Subject,
    string BodyTemplate) : IRequest;

public class UpdateTemplateCommandValidator : AbstractValidator<UpdateTemplateCommand>
{
    public UpdateTemplateCommandValidator()
    {
        RuleFor(x => x.Code).NotEmpty();
        RuleFor(x => x.Subject).NotEmpty();
        RuleFor(x => x.BodyTemplate).NotEmpty();
        RuleFor(x => x.Channel).IsInEnum();
    }
}

public class UpdateTemplateCommandHandler : IRequestHandler<UpdateTemplateCommand>
{
    private readonly ITemplateRepository _templateRepository;

    public UpdateTemplateCommandHandler(ITemplateRepository templateRepository)
    {
        _templateRepository = templateRepository;
    }

    public async Task Handle(UpdateTemplateCommand request, CancellationToken cancellationToken)
    {
        var template = await _templateRepository.GetByCodeAsync(request.Code, cancellationToken)
            ?? throw new TemplateNotFoundException(request.Code);

        template.Update(request.Subject, request.BodyTemplate, request.Channel);

        await _templateRepository.UpdateAsync(template, cancellationToken);
    }
}
