using PaymentService.Domain.Enums;

namespace PaymentService.Application.Contracts;

public interface IPaymentGatewayFactory
{
    IPaymentGateway GetGateway(PaymentMethod method);
}
