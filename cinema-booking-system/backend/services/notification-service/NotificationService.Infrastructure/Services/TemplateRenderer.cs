using System;
using System.Collections.Generic;
using System.Text;
using NotificationService.Application.Contracts;

namespace NotificationService.Infrastructure.Services;

public class TemplateRenderer : ITemplateRenderer
{
    public string Render(string template, Dictionary<string, object> metadata)
    {
        if (string.IsNullOrEmpty(template)) return string.Empty;
        if (metadata == null || metadata.Count == 0) return template;

        var sb = new StringBuilder(template);
        foreach (var kvp in metadata)
        {
            var placeholder = $"{{{{{kvp.Key}}}}}"; // e.g. {{orderId}}
            sb.Replace(placeholder, kvp.Value?.ToString() ?? string.Empty);
        }

        return sb.ToString();
    }
}
