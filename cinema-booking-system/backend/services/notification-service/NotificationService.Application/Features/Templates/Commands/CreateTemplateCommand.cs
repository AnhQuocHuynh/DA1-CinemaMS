using System;
using System.Threading;
using System.Threading.Tasks;
using FluentValidation;
using MediatR;
using NotificationService.Domain.Entities;
using NotificationService.Domain.Enums;
using NotificationService.Domain.Interfaces;
using NotificationService.Application.DTOs;

namespace NotificationService.Application.Features.Templates.Commands;

public record CreateTemplateCommand(
    string Code,
    NotificationChannel Channel,
    string Subject,
    string BodyTemplate) : IRequest<string>;

public class CreateTemplateCommandValidator : AbstractValidator<CreateTemplateCommand>
{
    public CreateTemplateCommandValidator()
    {
        RuleFor(x => x.Code).NotEmpty();
        RuleFor(x => x.Subject).NotEmpty();
        RuleFor(x => x.BodyTemplate).NotEmpty();
        RuleFor(x => x.Channel).IsInEnum();
    }
}

public class CreateTemplateCommandHandler : IRequestHandler<CreateTemplateCommand, string>
{
    private readonly ITemplateRepository _templateRepository;

    public CreateTemplateCommandHandler(ITemplateRepository templateRepository)
    {
        _templateRepository = templateRepository;
    }

    public async Task<string> Handle(CreateTemplateCommand request, CancellationToken cancellationToken)
    {
        var existing = await _templateRepository.GetByCodeAsync(request.Code, cancellationToken);
        if (existing != null)
        {
            throw new Exception($"Template with code {request.Code} already exists.");
        }

        var template = new NotificationTemplate(
            request.Code,
            request.Channel,
            request.Subject,
            request.BodyTemplate
        );

        await _templateRepository.InsertAsync(template, cancellationToken);

        return template.Id;
    }
}
