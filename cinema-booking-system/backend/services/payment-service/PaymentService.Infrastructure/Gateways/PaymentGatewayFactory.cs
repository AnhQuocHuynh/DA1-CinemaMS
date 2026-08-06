using Microsoft.Extensions.DependencyInjection;
using PaymentService.Application.Contracts;
using PaymentService.Domain.Enums;

namespace PaymentService.Infrastructure.Gateways;

/// <summary>
/// Factory that resolves the appropriate IPaymentGateway implementation 
/// based on the PaymentMethod enum value.
/// </summary>
public class PaymentGatewayFactory : IPaymentGatewayFactory
{
    private readonly IServiceProvider _serviceProvider;

    public PaymentGatewayFactory(IServiceProvider serviceProvider)
    {
        _serviceProvider = serviceProvider;
    }

    public IPaymentGateway GetGateway(PaymentMethod method)
    {
        return method switch
        {
            PaymentMethod.STRIPE => _serviceProvider.GetRequiredService<StripeGateway>(),
            PaymentMethod.PAYPAL => _serviceProvider.GetRequiredService<PayPalGateway>(),
            PaymentMethod.CASH => _serviceProvider.GetRequiredService<CashGateway>(),
            _ => throw new NotSupportedException($"Payment method '{method}' is not supported.")
        };
    }
}
