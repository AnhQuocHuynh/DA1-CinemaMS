# Payment Service Audit Report

**Date:** 2026-08-20
**Scope:** Payment Service (`c:\DoAn1\DA1-CinemaMS\cinema-booking-system\backend\services\payment-service`)

This document outlines the missing features, unfinished features, and architectural discrepancies found during the audit of the Payment Service.

## 1. Missing Refund Gateway Implementation
**Location:** `PaymentService.Application\Features\Refunds\Commands\ProcessRefundCommand.cs`

**Issue:** The actual refund gateway integration is missing. 
When an admin approves a refund via `ProcessRefundCommand`, the handler currently simulates the success and marks it as processed immediately, explicitly noting:
```csharp
// In a real system, call the Payment Gateway to execute the refund (Stripe/PayPal API)
// For now, simulate success and mark as processed immediately.
```
Additionally, the `IPaymentGateway` interface (`PaymentService.Application\Contracts\IPaymentGateway.cs`) does not define a `RefundAsync` method, meaning the underlying gateways (`StripeGateway`, `PayPalGateway`) are not yet equipped to handle refunds.

## 2. Saga Consumer & Workflow Contradiction
**Location:** `PaymentService.Infrastructure\Messaging\Consumers\OrderPaidConsumer.cs`

**Issue:** The implemented `OrderPaidConsumer` directly contradicts the documented `refactor_plan.md`.
- **Plan:** `refactor_plan.md` states that the `OrderPaidEventHandler` is responsible for *initiating payment processing*.
- **Implementation:** The actual `OrderPaidConsumer` has no functionality other than logging. The comments explicitly state:
  > *"Payment Service currently has no action to take when order.paid is received (the payment was already completed before the booking service generates this event). This consumer exists as the extension point for future analytics / reconciliation."*

This mismatch indicates an incomplete or evolving Saga design, which needs to be reconciled with the expected teammate-owned payload and Booking Saga state machine mentioned in `docs/SESSION_BOOTSTRAP.md`.

## 3. Messaging Infrastructure Discrepancy (MassTransit vs RabbitMQ.Client)
**Location:** `PaymentService.Infrastructure\PaymentService.Infrastructure.csproj`

**Issue:** 
- The `refactor_plan.md` explicitly lists `RabbitMQ.Client` as the package for RabbitMQ messaging.
- However, the `csproj` file imports `MassTransit` and `MassTransit.RabbitMQ` instead.
- **Risk:** This goes against the explicit warning in `docs/SESSION_BOOTSTRAP.md`: *"Do not accept a raw MassTransit payload as the cross-framework contract."* Even if the service attempts to use a custom `EventEnvelope<T>`, using MassTransit could cause issues with cross-framework compatibility (Spring Boot vs ASP.NET) if not carefully configured to produce raw JSON matching the canonical envelope.

## 4. Missing Integration Tests
**Location:** `PaymentService.Test`

**Issue:** The `refactor_plan.md` dictates a folder structure that includes integration tests:
```text
PaymentService.Test/
  ├── Integration/
      └── PaymentsControllerTests.cs
```
The `Integration` directory and all integration tests are entirely missing from the codebase. Only the `Unit` tests folder is present.

## 5. Hardcoded Environment URLs
**Location:** `PaymentService.Presentation\Controllers\PaymentsController.cs`

**Issue:** The controllers rely on hardcoded fallback URLs if configuration is missing:
```csharp
var baseUrl = _configuration["App:BaseUrl"] ?? "http://localhost:3000";
```
While functional for local development, this is an incomplete setup for deployment environments (like production or Docker Compose). It should be replaced with strict validation of strongly-typed settings using `IOptions<T>` to prevent runtime configuration failures.
