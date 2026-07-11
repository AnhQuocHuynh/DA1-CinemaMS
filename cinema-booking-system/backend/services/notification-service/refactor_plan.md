# Notification Service — Refactor Plan

> **Framework**: ASP.NET Core 9 (C#) | **Port**: 5004 | **Database**: MongoDB 7 (`notification_db`)
> **Bounded Context**: Notification (Email, SMS, Push)
> **Status**: Greenfield — new service

---

## 1. Responsibility

Consume events from other services and deliver notifications via email, SMS, and push channels. Provides SignalR real-time push for admin dashboards. Manages notification templates and delivery logs.

---

## 2. Architecture Pattern

**Clean Architecture** (4-layer) — consistent with other ASP.NET services. MongoDB replaces PostgreSQL as the primary store (schema flexibility for diverse notification types).

```
NotificationService.Presentation  →  NotificationService.Application  →  NotificationService.Domain
                                            ↓
                                  NotificationService.Infrastructure
```

---

## 3. NuGet Libraries

### Domain Layer (`NotificationService.Domain`)
| Package | Version | Purpose |
|---|---|---|
| *(no external packages)* | — | Pure domain, zero dependencies |

### Application Layer (`NotificationService.Application`)
| Package | Version | Purpose |
|---|---|---|
| `MediatR` | 12.4.1 | CQRS — command/query dispatching |
| `FluentValidation` | 11.11.0 | Input validation |
| `FluentValidation.DependencyInjectionExtensions` | 11.11.0 | Auto-register validators |

### Infrastructure Layer (`NotificationService.Infrastructure`)
| Package | Version | Purpose |
|---|---|---|
| `MongoDB.Driver` | 3.0.0 | MongoDB driver for .NET |
| `RabbitMQ.Client` | 7.2.1 | RabbitMQ messaging (consumer-heavy) |
| `MailKit` | 4.8.0 | SMTP email sending (modern, cross-platform) |
| `MimeKit` | 4.8.0 | Email composition (HTML templates) |
| `Microsoft.AspNetCore.SignalR.Core` | — | Real-time push (built into ASP.NET) |
| `Microsoft.AspNetCore.Authentication` | 9.0.0 | Custom authentication handler for Gateway-forwarded headers (`X-User-Id`, `X-User-Roles`) |

### Presentation Layer (`NotificationService.Presentation`)
| Package | Version | Purpose |
|---|---|---|
| `Swashbuckle.AspNetCore` | 10.2.3 | Swagger/OpenAPI UI |

---

## 4. Domain Entities (MongoDB Documents)

### `Notification`
| Property | Type | Notes |
|---|---|---|
| `Id` | `string` | MongoDB ObjectId |
| `UserId` | `long` | Target user |
| `Type` | `NotificationType` (enum) | BOOKING_CONFIRMATION, PAYMENT_RECEIPT, PASSWORD_RESET, PROMOTIONAL, SHOWTIME_REMINDER |
| `Channel` | `NotificationChannel` (enum) | EMAIL, SMS, PUSH |
| `Title` | `string` | Subject / title |
| `Body` | `string` | Rendered HTML or text body |
| `Metadata` | `Dictionary<string, object>` | Flexible key-value data |
| `Status` | `DeliveryStatus` (enum) | PENDING, SENT, FAILED, RETRYING |
| `RetryCount` | `int` | Default 0, max 3 |
| `SentAt` | `DateTime?` | |
| `FailedReason` | `string?` | |
| `CreatedAt` | `DateTime` | TTL index for auto-expiry (30 days) |

### `NotificationTemplate`
| Property | Type | Notes |
|---|---|---|
| `Id` | `string` | MongoDB ObjectId |
| `Code` | `string` | Unique: e.g., "BOOKING_CONFIRMED", "PASSWORD_RESET" |
| `Channel` | `NotificationChannel` | |
| `Subject` | `string` | Template with `{{placeholders}}` |
| `BodyTemplate` | `string` | HTML/text with `{{placeholders}}` |
| `Active` | `bool` | |
| `CreatedAt` | `DateTime` | |
| `UpdatedAt` | `DateTime?` | |

### `DeliveryLog`
| Property | Type | Notes |
|---|---|---|
| `Id` | `string` | MongoDB ObjectId |
| `NotificationId` | `string` | Ref → Notification |
| `Attempt` | `int` | 1, 2, 3 |
| `Status` | `DeliveryStatus` | |
| `ProviderResponse` | `string?` | SMTP response, SMS API response |
| `Timestamp` | `DateTime` | |

### Enums
- `NotificationType`: `BOOKING_CONFIRMATION`, `PAYMENT_RECEIPT`, `PASSWORD_RESET`, `PROMOTIONAL`, `SHOWTIME_REMINDER`
- `NotificationChannel`: `EMAIL`, `SMS`, `PUSH`
- `DeliveryStatus`: `PENDING`, `SENT`, `FAILED`, `RETRYING`

---

## 5. CQRS — Features (Commands & Queries)

### Notifications
| Type | Name | Description |
|---|---|---|
| Command | `SendNotificationCommand` | Create and dispatch a notification |
| Command | `RetryFailedNotificationCommand` | Retry a specific failed notification |
| Command | `RetryAllFailedCommand` | Admin: batch retry all failed |
| Query | `GetNotificationsByUserQuery` | User: list own notifications |
| Query | `GetNotificationsQuery` | Admin: paginated list with filters |
| Query | `GetNotificationByIdQuery` | Get notification detail |

### Templates
| Type | Name | Description |
|---|---|---|
| Command | `CreateTemplateCommand` | Admin: create notification template |
| Command | `UpdateTemplateCommand` | Admin: update template |
| Command | `ToggleTemplateActiveCommand` | Admin: enable/disable template |
| Query | `GetTemplatesQuery` | Admin: list all templates |
| Query | `GetTemplateByCodeQuery` | Lookup template by code |

---

## 6. Integration Events (RabbitMQ — Consumed Only)

This service is **consumer-only** — it does not publish events.

### Consumed Events
| Source Exchange | Routing Key | Queue | Handler Class |
|---|---|---|---|
| `user.events` | `user.registered` | `notification.user.welcome` | `UserRegisteredEventHandler` |
| `user.events` | `user.password.reset` | `notification.password.reset` | `PasswordResetEventHandler` |
| `booking.events` | `order.paid` | `notification.order.confirmation` | `OrderPaidEventHandler` |
| `booking.events` | `order.refunded` | `notification.order.refund` | `OrderRefundedEventHandler` |
| `showtime.events` | `showtime.created` | `notification.showtime.new` | `ShowtimeCreatedEventHandler` |

### Consumed Event Payloads

```csharp
// Keycloak SPI events use string KeycloakId (UUID), not internal long UserId
public record KeycloakUserRegisteredPayload(string KeycloakId, string Email, string FullName);
public record KeycloakPasswordResetPayload(string KeycloakId, string Email, string ResetToken);

public record OrderPaidPayload(
    long OrderId, long UserId, long ShowtimeId,
    decimal TotalAmount, decimal FinalAmount,
    int TicketCount, string PaymentMethod, string TransactionId);
public record OrderRefundedPayload(long OrderId, long UserId, decimal RefundAmount, string Reason);
public record ShowtimeCreatedPayload(long ShowtimeId, long MovieId, string MovieTitle, DateTime StartTime);
```

---

## 7. API Endpoints

### Notifications (User)
| Method | Route | Auth | Handler |
|---|---|---|---|
| `GET` | `/api/notifications/me` | ✓ | `GetNotificationsByUserQuery` |
| `GET` | `/api/notifications/{id}` | ✓ | `GetNotificationByIdQuery` |

### Notifications (Admin)
| Method | Route | Auth | Handler |
|---|---|---|---|
| `GET` | `/api/notifications` | ✓ (ADMIN) | `GetNotificationsQuery` |
| `POST` | `/api/notifications/{id}/retry` | ✓ (ADMIN) | `RetryFailedNotificationCommand` |
| `POST` | `/api/notifications/retry-all` | ✓ (ADMIN) | `RetryAllFailedCommand` |

### Templates (Admin)
| Method | Route | Auth | Handler |
|---|---|---|---|
| `POST` | `/api/notification-templates` | ✓ (ADMIN) | `CreateTemplateCommand` |
| `GET` | `/api/notification-templates` | ✓ (ADMIN) | `GetTemplatesQuery` |
| `PUT` | `/api/notification-templates/{id}` | ✓ (ADMIN) | `UpdateTemplateCommand` |
| `PUT` | `/api/notification-templates/{id}/toggle-active` | ✓ (ADMIN) | `ToggleTemplateActiveCommand` |

### SignalR Hub
| Hub Route | Purpose |
|---|---|
| `/hubs/notifications` | Real-time push for admin dashboard (new bookings, payments) |

### Health
| Method | Route | Purpose |
|---|---|---|
| `GET` | `/health` | Health check |

---

## 8. Email Sending Strategy

### BackgroundService Pattern
- `NotificationDispatcherService` (hosted service) polls MongoDB for PENDING notifications
- Sends via `IEmailSender` (MailKit) / `ISmsSender` (future)
- Updates status to SENT or FAILED
- Retries up to 3 times with exponential backoff

### Template Rendering
- Simple `{{placeholder}}` replacement in `NotificationTemplate.BodyTemplate`
- Uses `ITemplateRenderer` contract for testability

---

## 9. Folder Structure

```
notification-service/
├── NotificationService.slnx
│
├── NotificationService.Domain/
│   ├── NotificationService.Domain.csproj
│   ├── Entities/
│   │   ├── Notification.cs
│   │   ├── NotificationTemplate.cs
│   │   └── DeliveryLog.cs
│   ├── Enums/
│   │   ├── NotificationType.cs
│   │   ├── NotificationChannel.cs
│   │   └── DeliveryStatus.cs
│   └── Interfaces/
│       ├── INotificationRepository.cs
│       ├── ITemplateRepository.cs
│       └── IDeliveryLogRepository.cs
│
├── NotificationService.Application/
│   ├── NotificationService.Application.csproj
│   ├── DependencyInjection.cs
│   ├── Behaviors/
│   │   └── ValidationBehavior.cs
│   ├── Contracts/
│   │   ├── IEmailSender.cs
│   │   ├── ISmsSender.cs
│   │   ├── ITemplateRenderer.cs
│   │   └── IPushNotificationSender.cs
│   ├── DTOs/
│   │   ├── NotificationDto.cs
│   │   ├── TemplateDto.cs
│   │   └── PagedResult.cs
│   ├── Messages/
│   │   └── ConsumedEvents.cs
│   ├── Exceptions/
│   │   ├── NotificationNotFoundException.cs
│   │   ├── TemplateNotFoundException.cs
│   │   └── DeliveryFailedException.cs
│   └── Features/
│       ├── Notifications/
│       │   ├── Commands/
│       │   │   ├── SendNotificationCommand.cs
│       │   │   ├── RetryFailedNotificationCommand.cs
│       │   │   └── RetryAllFailedCommand.cs
│       │   └── Queries/
│       │       ├── GetNotificationsByUserQuery.cs
│       │       ├── GetNotificationsQuery.cs
│       │       └── GetNotificationByIdQuery.cs
│       └── Templates/
│           ├── Commands/
│           │   ├── CreateTemplateCommand.cs
│           │   ├── UpdateTemplateCommand.cs
│           │   └── ToggleTemplateActiveCommand.cs
│           └── Queries/
│               ├── GetTemplatesQuery.cs
│               └── GetTemplateByCodeQuery.cs
│
├── NotificationService.Infrastructure/
│   ├── NotificationService.Infrastructure.csproj
│   ├── DependencyInjection.cs
│   ├── Data/
│   │   ├── MongoDbContext.cs
│   │   └── MongoDbSettings.cs
│   ├── Repositories/
│   │   ├── NotificationRepository.cs
│   │   ├── TemplateRepository.cs
│   │   └── DeliveryLogRepository.cs
│   ├── Services/
│   │   ├── MailKitEmailSender.cs
│   │   ├── TemplateRenderer.cs
│   │   └── SignalRPushSender.cs
│   ├── BackgroundServices/
│   │   └── NotificationDispatcherService.cs
│   └── Messaging/
│       └── Consumers/
│           ├── UserRegisteredEventConsumer.cs
│           ├── PasswordResetEventConsumer.cs
│           ├── OrderPaidEventConsumer.cs
│           ├── OrderRefundedEventConsumer.cs
│           └── ShowtimeCreatedEventConsumer.cs
│
├── NotificationService.Presentation/
│   ├── NotificationService.Presentation.csproj
│   ├── Program.cs
│   ├── appsettings.json
│   ├── appsettings.Development.json
│   ├── Properties/
│   │   └── launchSettings.json
│   ├── Controllers/
│   │   ├── NotificationsController.cs
│   │   └── TemplatesController.cs
│   ├── Hubs/
│   │   └── NotificationHub.cs
│   └── Middleware/
│       └── ExceptionHandlingMiddleware.cs
│
├── NotificationService.Test/
│   ├── NotificationService.Test.csproj
│   ├── Unit/
│   │   ├── Services/
│   │   │   ├── TemplateRendererTests.cs
│   │   │   └── MailKitEmailSenderTests.cs
│   │   └── Features/
│   │       └── SendNotificationCommandHandlerTests.cs
│   └── Integration/
│       └── Consumers/
│           └── OrderPaidEventConsumerTests.cs
│
└── Dockerfile
```

---

## 10. MongoDB Collections

### `notifications`
```json
{
  "_id": "ObjectId",
  "userId": 42,
  "type": "BOOKING_CONFIRMATION",
  "channel": "EMAIL",
  "title": "Booking Confirmed — Order #1234",
  "body": "<html>...",
  "metadata": {
    "orderId": 1234,
    "movieTitle": "Inception",
    "showtime": "2026-07-01T19:00:00Z"
  },
  "status": "SENT",
  "retryCount": 0,
  "sentAt": "2026-07-01T10:00:05Z",
  "failedReason": null,
  "createdAt": "2026-07-01T10:00:00Z"
}
```
> **TTL Index**: `createdAt` with expiry after 30 days

### `notification_templates`
```json
{
  "_id": "ObjectId",
  "code": "BOOKING_CONFIRMED",
  "channel": "EMAIL",
  "subject": "Your booking #{{orderId}} is confirmed!",
  "bodyTemplate": "<h1>Hi {{fullName}}</h1><p>Your tickets for {{movieTitle}} at {{showtime}} are ready...</p>",
  "active": true,
  "createdAt": "2026-01-01T00:00:00Z",
  "updatedAt": null
}
```

### `delivery_logs`
```json
{
  "_id": "ObjectId",
  "notificationId": "ObjectId-ref",
  "attempt": 1,
  "status": "SENT",
  "providerResponse": "250 OK",
  "timestamp": "2026-07-01T10:00:05Z"
}
```

### MongoDB Indexes
```javascript
// notifications
db.notifications.createIndex({ userId: 1, createdAt: -1 });
db.notifications.createIndex({ status: 1 });
db.notifications.createIndex({ createdAt: 1 }, { expireAfterSeconds: 2592000 }); // 30-day TTL

// notification_templates
db.notification_templates.createIndex({ code: 1 }, { unique: true });

// delivery_logs
db.delivery_logs.createIndex({ notificationId: 1 });
```

---

## 11. Key Design Decisions

1. **MongoDB over PostgreSQL**: Notification data is schema-flexible (different metadata per notification type). TTL indexes auto-delete old notifications — reduces storage management overhead.
2. **Consumer-only for RabbitMQ**: This service only listens to events — it never publishes. If email delivery fails, it retries internally (not via RabbitMQ DLQ).
3. **BackgroundService for dispatch**: `NotificationDispatcherService` runs as a .NET `BackgroundService`, polling for PENDING notifications every 5 seconds and dispatching them. This decouples event consumption from actual delivery.
4. **MailKit over System.Net.Mail**: MailKit is modern, cross-platform, and supports OAuth2 SMTP auth (important for Gmail/Outlook).
5. **SignalR for real-time**: Admin dashboard connects via SignalR hub at `/hubs/notifications` for live booking/payment notifications.
6. **Template rendering**: Simple `{{key}}` replacement — no heavy templating engine needed at this scale.
7. **Authentication via Gateway**: This service does not validate JWTs directly. It trusts the API Gateway, reading user identity and roles from the `X-User-Id` and `X-User-Roles` headers to construct the `ClaimsPrincipal`.
