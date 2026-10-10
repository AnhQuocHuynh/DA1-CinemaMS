using System.Text.Json.Serialization;

namespace PaymentService.Domain.Enums;

[JsonConverter(typeof(JsonStringEnumConverter))]
public enum PaymentMethod
{
    STRIPE,
    PAYPAL,
    CASH
}
