using System;

namespace NotificationService.Application.Exceptions;

public class TemplateNotFoundException : Exception
{
    public TemplateNotFoundException(string codeOrId) 
        : base($"Template with Code or ID '{codeOrId}' was not found.")
    {
    }
}
