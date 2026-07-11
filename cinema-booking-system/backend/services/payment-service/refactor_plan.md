# Payment Service — Refactor Plan

> **Framework**: ASP.NET Core 9 (C#) | **Port**: 5003 | **Database**: PostgreSQL 16 (`payment_db`)
> **Bounded Context**: Payment Processing
> **Status**: Greenfield — extracted from monolith's `booking.PaymentServiceImpl`

---

## 1. Responsibility

Payment processing, transaction management, refund processing, payment gateway integration (VNPay, Stripe). Participates in the Booking Saga via RabbitMQ events.

---

## 2. Architecture Pattern

**Clean Architecture** (4-layer) — consistent with Facility/Identity Services.

```
PaymentService.Presentation  →  PaymentService.Application  →  PaymentService.Domain
                                        ↓
                              PaymentService.Infrastructure
```

---

## 3. NuGet Libraries

### Domain Layer (`PaymentService.Domain`)
| Package | Version | Purpose |
|---|---|---|
| *(no external packages)* | — | Pure domain, zero dependencies |

### Application Layer (`PaymentService.Application`)
| Package | Version | Purpose |
|---|---|---|
| `MediatR` | 12.4.1 | CQRS — command/query dispatching |
| `FluentValidation` | 11.11.0 | Input validation for commands |
| `FluentValidation.DependencyInjectionExtensions` | 11.11.0 | Auto-register validators |

### Infrastructure Layer (`PaymentService.Infrastructure`)
| Package | Version | Purpose |
|---|---|---|
| `Microsoft.EntityFrameworkCore` | 9.0.0 | ORM |
| `Npgsql.EntityFrameworkCore.PostgreSQL` | 9.0.0 | PostgreSQL provider |
| `Microsoft.EntityFrameworkCore.Design` | 9.0.0 | EF migrations |
| `Microsoft.EntityFrameworkCore.Tools` | 9.0.0 | CLI tools |
| `RabbitMQ.Client` | 7.2.1 | RabbitMQ messaging (consume + publish) |
| `Microsoft.AspNetCore.Authentication` | 9.0.0 | Custom authentication handler for Gateway-forwarded headers (`X-User-Id`, `X-User-Roles`) |

### Presentation Layer (`PaymentService.Presentation`)
| Package | Version | Purpose |
|---|---|---|
| `Swashbuckle.AspNetCore` | 10.2.3 | Swagger/OpenAPI UI |

---

## 4. Domain Entities

### `Payment`
| Property | Type | Notes |
|---|---|---|
| `Id` | `long` | PK, auto-increment |
| `OrderId` | `long` | FK-like reference to Booking Service |
| `UserId` | `long` | FK-like reference to Identity Service |
| `TransactionId` | `string` | Unique, external gateway transaction ID |
| `Amount` | `decimal` | Total payment amount |
| `Currency` | `string` | Default: "VND" |
| `PaymentMethod` | `PaymentMethod` (enum) | CREDIT_CARD, BANK_TRANSFER, VNPAY, MOMO, CASH |
| `Status` | `PaymentStatus` (enum) | PENDING, COMPLETED, FAILED, REFUNDED, PARTIALLY_REFUNDED |
| `GatewayResponse` | `string?` | Raw response from payment gateway |
| `PaidAt` | `DateTime?` | When payment was confirmed |
| `CreatedAt` | `DateTime` | UTC |
| `UpdatedAt` | `DateTime?` | UTC |
| `Refunds` | `ICollection<Refund>` | Navigation |

### `Refund`
| Property | Type | Notes |
|---|---|---|
| `Id` | `long` | PK |
| `PaymentId` | `long` | FK → Payment |
| `Amount` | `decimal` | Refund amount |
| `Reason` | `string` | |
| `Status` | `RefundStatus` (enum) | PENDING, APPROVED, PROCESSED, REJECTED |
| `ProcessedAt` | `DateTime?` | |
| `CreatedAt` | `DateTime` | UTC |

### `TransactionLog`
| Property | Type | Notes |
|---|---|---|
| `Id` | `long` | PK |
| `PaymentId` | `long` | FK → Payment |
| `Action` | `string` | e.g., "INITIATE", "CALLBACK", "REFUND" |
| `Request` | `string?` | JSON of request sent to gateway |
| `Response` | `string?` | JSON of gateway response |
| `StatusCode` | `int?` | HTTP status from gateway |
| `Timestamp` | `DateTime` | UTC |

### Enums
- `PaymentMethod`: `CREDIT_CARD`, `BANK_TRANSFER`, `VNPAY`, `MOMO`, `CASH`
- `PaymentStatus`: `PENDING`, `COMPLETED`, `FAILED`, `REFUNDED`, `PARTIALLY_REFUNDED`
- `RefundStatus`: `PENDING`, `APPROVED`, `PROCESSED`, `REJECTED`

---

## 5. CQRS — Features (Commands & Queries)

### Payments
| Type | Name | Description |
|---|---|---|
| Command | `InitiatePaymentCommand` | Create payment record, redirect to gateway |
| Command | `HandlePaymentCallbackCommand` | Process gateway callback (VNPay IPN) |
| Command | `RequestRefundCommand` | Initiate refund for a paid order |
| Command | `ProcessRefundCommand` | Admin: approve/reject refund |
| Query | `GetPaymentByOrderIdQuery` | Get payment status by order ID |
| Query | `GetPaymentByIdQuery` | Get payment details by ID |
| Query | `GetPaymentsByUserQuery` | User: list own payment history |
| Query | `GetPaymentsQuery` | Admin: paginated payment list |

### Internal
| Type | Name | Description |
|---|---|---|
| Query | `GetPaymentStatusInternalQuery` | Internal: payment status for Booking Service |

---

## 6. Integration Events (RabbitMQ)

### Published Events
| Exchange | Routing Key | Payload Class | Triggered By |
|---|---|---|---|
| `payment.events` | `payment.completed` | `PaymentCompletedPayload` | `HandlePaymentCallbackCommand` (success) |
| `payment.events` | `payment.failed` | `PaymentFailedPayload` | `HandlePaymentCallbackCommand` (failure) |
| `payment.events` | `payment.refunded` | `PaymentRefundedPayload` | `ProcessRefundCommand` |

### Consumed Events
| Exchange | Routing Key | Queue | Handler |
|---|---|---|---|
| `booking.events` | `order.paid` | `payment.process` | `OrderPaidEventHandler` — initiates payment processing |

### Event Payloads

```csharp
// Published
public record PaymentCompletedPayload(
    long PaymentId, long OrderId, long UserId,
    decimal Amount, string TransactionId, string PaymentMethod);

public record PaymentFailedPayload(
    long PaymentId, long OrderId, long UserId,
    string Reason);

public record PaymentRefundedPayload(
    long PaymentId, long OrderId, long UserId,
    decimal RefundAmount, string Reason);

// Consumed
public record OrderPaidPayload(
    long OrderId, long UserId, long ShowtimeId,
    decimal TotalAmount, decimal FinalAmount,
    int TicketCount, string PaymentMethod, string TransactionId);
```

---

## 7. API Endpoints

### Payments
| Method | Route | Auth | Handler |
|---|---|---|---|
| `POST` | `/api/payments/initiate` | ✓ | `InitiatePaymentCommand` |
| `POST` | `/api/payments/callback/vnpay` | ✗ (IPN) | `HandlePaymentCallbackCommand` |
| `GET` | `/api/payments/order/{orderId}` | ✓ | `GetPaymentByOrderIdQuery` |
| `GET` | `/api/payments/{id}` | ✓ | `GetPaymentByIdQuery` |
| `GET` | `/api/payments/me` | ✓ | `GetPaymentsByUserQuery` |
| `GET` | `/api/payments` | ✓ (ADMIN) | `GetPaymentsQuery` |

### Refunds
| Method | Route | Auth | Handler |
|---|---|---|---|
| `POST` | `/api/payments/{id}/refund` | ✓ | `RequestRefundCommand` |
| `PUT` | `/api/payments/refunds/{refundId}` | ✓ (ADMIN) | `ProcessRefundCommand` |

### Internal (blocked at Gateway)
| Method | Route | Auth | Handler |
|---|---|---|---|
| `GET` | `/internal/payments/order/{orderId}/status` | API Key | `GetPaymentStatusInternalQuery` |

### Health
| Method | Route | Purpose |
|---|---|---|
| `GET` | `/health` | Health check |

---

## 8. Payment Gateway Integration

### VNPay
- **Initiate**: Build VNPay payment URL with HMAC-SHA512 signature → redirect user
- **Callback**: VNPay IPN hits `/api/payments/callback/vnpay` with transaction result
- **Verify**: Validate HMAC signature, check transaction status, update payment record

### Strategy Pattern
Use `IPaymentGateway` interface for gateway abstraction:
```csharp
public interface IPaymentGateway
{
    Task<PaymentInitiationResult> InitiateAsync(PaymentRequest request);
    Task<PaymentVerificationResult> VerifyCallbackAsync(IDictionary<string, string> parameters);
}
```

Implementations: `VnPayGateway`, `StripeGateway`, `CashGateway`

---

## 9. Idempotency

| Key | Format | Storage |
|---|---|---|
| Payment Transaction ID | `paymentTransactionId` | PostgreSQL unique constraint on `transaction_id` |
| Order Payment | `orderId` unique per payment | Prevents duplicate payments for same order |

---

## 10. Folder Structure

```
payment-service/
├── PaymentService.slnx
│
├── PaymentService.Domain/
│   ├── PaymentService.Domain.csproj
│   ├── Entities/
│   │   ├── Payment.cs
│   │   ├── Refund.cs
│   │   └── TransactionLog.cs
│   ├── Enums/
│   │   ├── PaymentMethod.cs
│   │   ├── PaymentStatus.cs
│   │   └── RefundStatus.cs
│   └── Interfaces/
│       ├── IPaymentRepository.cs
│       ├── IRefundRepository.cs
│       ├── ITransactionLogRepository.cs
│       └── IUnitOfWork.cs
│
├── PaymentService.Application/
│   ├── PaymentService.Application.csproj
│   ├── DependencyInjection.cs
│   ├── Behaviors/
│   │   └── ValidationBehavior.cs
│   ├── Contracts/
│   │   ├── IEventPublisher.cs
│   │   ├── IPaymentGateway.cs
│   │   └── IPaymentGatewayFactory.cs
│   ├── DTOs/
│   │   ├── PaymentDto.cs
│   │   ├── RefundDto.cs
│   │   ├── PaymentInitiationResult.cs
│   │   └── PagedResult.cs
│   ├── Messages/
│   │   └── PaymentIntegrationEvents.cs
│   ├── Exceptions/
│   │   ├── PaymentNotFoundException.cs
│   │   ├── InvalidPaymentStateException.cs
│   │   ├── DuplicateTransactionException.cs
│   │   └── PaymentGatewayException.cs
│   └── Features/
│       ├── Payments/
│       │   ├── Commands/
│       │   │   ├── InitiatePaymentCommand.cs
│       │   │   └── HandlePaymentCallbackCommand.cs
│       │   └── Queries/
│       │       ├── GetPaymentByOrderIdQuery.cs
│       │       ├── GetPaymentByIdQuery.cs
│       │       ├── GetPaymentsByUserQuery.cs
│       │       └── GetPaymentsQuery.cs
│       └── Refunds/
│           ├── Commands/
│           │   ├── RequestRefundCommand.cs
│           │   └── ProcessRefundCommand.cs
│           └── Queries/
│               └── GetRefundsByPaymentQuery.cs
│
├── PaymentService.Infrastructure/
│   ├── PaymentService.Infrastructure.csproj
│   ├── DependencyInjection.cs
│   ├── DatabaseMigration.cs
│   ├── Data/
│   │   ├── PaymentDbContext.cs
│   │   └── Configurations/
│   │       ├── PaymentConfiguration.cs
│   │       ├── RefundConfiguration.cs
│   │       └── TransactionLogConfiguration.cs
│   ├── Repositories/
│   │   ├── PaymentRepository.cs
│   │   ├── RefundRepository.cs
│   │   ├── TransactionLogRepository.cs
│   │   └── UnitOfWork.cs
│   ├── Gateways/
│   │   ├── VnPayGateway.cs
│   │   ├── StripeGateway.cs
│   │   ├── CashGateway.cs
│   │   └── PaymentGatewayFactory.cs
│   └── Messaging/
│       ├── RabbitMqEventPublisher.cs
│       └── Consumers/
│           └── OrderPaidEventConsumer.cs
│
├── PaymentService.Presentation/
│   ├── PaymentService.Presentation.csproj
│   ├── Program.cs
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   ├── Properties/
│   │   └── launchSettings.json
│   ├── Controllers/
│   │   ├── PaymentsController.cs
│   │   ├── RefundsController.cs
│   │   └── InternalPaymentsController.cs
│   └── Middleware/
│       └── ExceptionHandlingMiddleware.cs
│
├── PaymentService.Test/
│   ├── PaymentService.Test.csproj
│   ├── Unit/
│   │   ├── Entities/
│   │   │   └── PaymentTests.cs
│   │   ├── Features/
│   │   │   ├── InitiatePaymentCommandHandlerTests.cs
│   │   │   └── HandlePaymentCallbackCommandHandlerTests.cs
│   │   └── Gateways/
│   │       └── VnPayGatewayTests.cs
│   └── Integration/
│       └── PaymentsControllerTests.cs
│
└── Dockerfile
```

---

## 11. Database Schema (`payment_db`)

```sql
CREATE TABLE payments (
    id               BIGSERIAL PRIMARY KEY,
    order_id         BIGINT NOT NULL,
    user_id          BIGINT NOT NULL,
    transaction_id   VARCHAR(255) UNIQUE,
    amount           DECIMAL(15,2) NOT NULL,
    currency         VARCHAR(10) NOT NULL DEFAULT 'VND',
    payment_method   VARCHAR(30) NOT NULL,
    status           VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    gateway_response TEXT,
    paid_at          TIMESTAMPTZ,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ
);

CREATE TABLE refunds (
    id           BIGSERIAL PRIMARY KEY,
    payment_id   BIGINT NOT NULL REFERENCES payments(id),
    amount       DECIMAL(15,2) NOT NULL,
    reason       TEXT NOT NULL,
    status       VARCHAR(30) NOT NULL DEFAULT 'PENDING',
    processed_at TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE transaction_logs (
    id          BIGSERIAL PRIMARY KEY,
    payment_id  BIGINT NOT NULL REFERENCES payments(id),
    action      VARCHAR(50) NOT NULL,
    request     TEXT,
    response    TEXT,
    status_code INT,
    timestamp   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
```

---

## 12. Key Design Decisions

1. **Saga participant**: Payment Service is choreography-based — consumes `order.paid` and publishes `payment.completed`/`payment.failed`.
2. **Gateway abstraction**: `IPaymentGateway` + Factory pattern allows adding new payment providers without changing domain logic.
3. **Transaction logging**: Every gateway interaction is logged to `transaction_logs` for audit/debugging.
4. **Idempotency**: `transaction_id` has a unique constraint — replay of the same callback is safely ignored.
5. **Decimal handling**: C# `decimal` is used throughout for money calculations (128-bit precision, no floating-point errors).
6. **No direct DB access to other services**: `order_id` and `user_id` are stored as plain `long` values — no foreign key to external databases.
7. **Authentication via Gateway**: This service does not validate JWTs directly. It trusts the API Gateway, reading user identity and roles from the `X-User-Id` and `X-User-Roles` headers to construct the `ClaimsPrincipal`.
