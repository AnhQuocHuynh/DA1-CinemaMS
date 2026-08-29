using System.Collections.Generic;

namespace NotificationService.Application.Contracts;

public interface ITemplateRenderer
{
    string Render(string template, Dictionary<string, object> metadata);
}
