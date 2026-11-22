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
| `Microsoft.AspNetCore.Authentication.JwtBearer` | 9.0.0 | Native Keycloak JWT validation |

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
// All consumed payloads are wrapped in the standard EventEnvelope<T>
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
db.notifications.createIndex({ type: 1, "metadata.orderId": 1 }, { unique: true, partialFilterExpression: { "metadata.orderId": { $exists: true } } }); // Idempotency

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
4. **Idempotency via MongoDB Unique Indexes**: Exactly-once processing is guaranteed by unique constraints on the `notifications` collection (e.g., `type` + `orderId`). The consumer blindly attempts an insert; if a `DuplicateKey` exception occurs, it is swallowed and the message is safely ACKed.
5. **MailKit over System.Net.Mail**: MailKit is modern, cross-platform, and supports OAuth2 SMTP auth (important for Gmail/Outlook).
6. **SignalR for real-time**: Admin dashboard connects via SignalR hub at `/hubs/notifications` for live booking/payment notifications.
7. **Template rendering**: Simple `{{key}}` replacement — no heavy templating engine needed at this scale.
8. **Authentication via Keycloak JWT**: This service uses `JwtBearer` to validate Keycloak JWTs directly for authorization. It still reads the `X-User-Id` header (forwarded by the API Gateway) to map the internal numeric user ID to the `ClaimsPrincipal` for business logic.

---

## 12. Future Fixes


### 🟢 Nice to Have

| # | Issue | Detail |
|---|---|---|
| 15 | **Real SMS sender** | Replace `DummySmsSender` with a real adapter (e.g., Twilio). |
| 16 | **Infrastructure-layer tests** | ✅ Partially Resolved — Unit tests added for `RabbitMqConsumerBaseInboxTests`, `HttpKeycloakUserResolverTests`, and 4 event consumers (`OrderPaid`, `OrderRefunded`, `OrderCancelled`, `PaymentFailed`). Remaining: `NotificationDispatcherService`, `MailKitEmailSender`, `TemplateRenderer`, and remaining 5 consumers. |
| 17 | **Integration tests** | ✅ Resolved — Added `NotificationEndpointsIntegrationTests.cs` using `WebApplicationFactory<Program>` for REST endpoints and SignalR hub negotiation. |
| 18 | **`DummySmsSender` → real impl** | Currently `Task.CompletedTask` with a log line. |

---

## 13. Remaining Completion TODO Plan (Audit — 2026-11-06)

> **Current Completion**: ~92–95% (Merged in `dev` via PR #20 `3847721`). Core Email & Real-Time SignalR Push pipelines, 9 RabbitMQ consumers with MongoDB Transactional Inbox (`inbox_messages`), 3-tier contact resolution, YARP Gateway routing (`/api/notifications`, `/api/preferences`, `/hubs/notifications`), and React frontend (`NotificationBell`, `NotificationPreferencesCard`, `notificationHubService`) are complete and passing 135+ tests (78.8% line coverage).

### Phase 1: Unmerged Branch Synchronization (High Priority)
- [ ] **1.1 Merge Post-Payment Seat-Unavailable Compensation (`fix/payment-flow-seat-retry-compensation` @ `686b98a`)**
  - **Files**:
    - `NotificationService.Infrastructure/Messaging/Consumers/OrderCancelledEventConsumer.cs`
    - `NotificationService.Test/Unit/Infrastructure/Messaging/Consumers/OrderCancelledEventConsumerTests.cs`
  - **Task**: Cherry-pick or merge commit `686b98a` so `OrderCancelledEventConsumer` detects `payload.Reason == "SEATS_UNAVAILABLE_AFTER_PAYMENT"` and dispatches a tailored refund compensation push notification (`actionType = "ORDER_REFUNDED_SEATS_UNAVAILABLE"`, `actionUrl = "/user/booking-failed?reason=cancelled&orderId={orderId}"`) instead of the generic seat hold timeout message.
- [ ] **1.2 Port Room Rental Notification Support (When `feature/room-rental` is integrated)**
  - **Files**:
    - `NotificationService.Domain/Enums/NotificationType.cs`
    - `NotificationService.Presentation/Program.cs`
  - **Task**: Re-introduce `NotificationType.RENTAL_STATUS` and `JsonStringEnumConverter` on controller JSON options (originally in commit `d721fa6`) when room rental notifications are wired up.

### Phase 2: API Gateway & Security Hardening (High Priority)
- [ ] **2.1 Add Notification Templates Route to API Gateway**
  - **File**: `cinema-booking-system/backend/services/api-gateway/ApiGateway/appsettings.json`
  - **Task**: Add a `notification-templates` route pointing to `notification-cluster` for `/api/notification-templates/{**catch-all}` with `"AuthorizationPolicy": "admin"` so `TemplatesController` is reachable through the gateway on port `5000`.
- [ ] **2.2 Enforce User Ownership on Preferences & Notification Detail Endpoints**
  - **Files**:
    - `NotificationService.Presentation/Controllers/PreferencesController.cs`
    - `NotificationService.Presentation/Controllers/NotificationsController.cs`
  - **Task**:
    - In `PreferencesController` (`GET /api/preferences/{userId}` and `PUT /api/preferences/{userId}`), verify that the `X-User-Id` gateway header matches `userId` (unless the caller has role `ADMIN`) to prevent Horizontal Privilege Escalation (IDOR).
    - In `NotificationsController.GetNotificationById` (`GET /api/notifications/{id}`), verify `result.UserId == GetCurrentUserId()` or `User.IsInRole("ADMIN")` before returning the notification.

### Phase 3: Template Engine & Channel Completeness (Medium Priority)
- [ ] **3.1 Map All `NotificationType` Values in `SendNotificationCommandHandler`**
  - **File**: `NotificationService.Application/Features/Notifications/Commands/SendNotificationCommand.cs`
  - **Task**: Update `MapTypeToTemplateCode(NotificationType type)` (lines 193–201) to include mappings for the 4 newer enum values added in PR #20:
    - `NotificationType.BOOKING_CANCELLED => "BOOKING_CANCELLED"`
    - `NotificationType.PAYMENT_FAILED => "PAYMENT_FAILED"`
    - `NotificationType.ORDER_REFUNDED => "ORDER_REFUNDED"`
    - `NotificationType.REVIEW_MODERATION => "REVIEW_MODERATION"`
- [ ] **3.2 Seed Default MongoDB Notification Templates**
  - **File**: `NotificationService.Infrastructure/Data/MongoDbContext.cs` (or a startup seeder)
  - **Task**: Seed default active templates in `notification_templates` for each template code so admins can customize subjects/bodies without manual database inserts.
- [ ] **3.3 Implement Real SMS Provider (Optional / Production Scope)**
  - **Files**:
    - `NotificationService.Infrastructure/Services/DummySmsSender.cs`
    - `NotificationService.Infrastructure/DependencyInjection.cs`
    - `NotificationService.Presentation/appsettings.json`
  - **Task**: Implement an external SMS adapter (e.g., Twilio or SpeedSMS) behind `ISmsSender` when `Smtp/Sms` credentials are configured, keeping `DummySmsSender` as the development fallback.

### Phase 4: Testing & Documentation Cleanup (Low Priority)
- [ ] **4.1 Add Missing Unit Tests for Remaining Consumers & Services**
  - **Directory**: `NotificationService.Test/Unit/Infrastructure/`
  - **Task**: Add unit test suites for:
    - `UserRegisteredEventConsumer`, `UserProfileUpdatedEventConsumer`, `PasswordResetEventConsumer`, `ReviewCreatedEventConsumer`, `ShowtimeCreatedEventConsumer`
    - `NotificationDispatcherService` (batch polling, 3-retry transition to `FAILED`, `DeliveryLog` creation)
    - `TemplateRenderer` (`{{placeholder}}` substitution)
- [ ] **4.2 Update `docs/CURRENT_STATE.md`**
  - **File**: `docs/CURRENT_STATE.md`
  - **Task**: Update lines 72, 84, and 237 (which still state from the 2026-10-11 snapshot that the SPA has no notification inbox/SignalR client and the gateway does not route `/api/notifications`) to reflect the merged PR #20 implementation.

