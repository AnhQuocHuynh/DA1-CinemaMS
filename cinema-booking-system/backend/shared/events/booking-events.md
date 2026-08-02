# Booking Events

Status: version 1 contract. `booking-service` records these messages in its transactional outbox. A RabbitMQ dispatcher is deliberately not enabled yet.

All messages use the common [event envelope](README.md#envelope).

## `order.paid`

Exchange: `booking.events`  
Routing key: `order.paid`

```json
{
  "orderId": 1234,
  "userId": 42,
  "showtimeId": 567,
  "movieId": 15,
  "eventId": null,
  "totalAmount": 450000.00,
  "finalAmount": 405000.00,
  "ticketCount": 3,
  "paymentMethod": "CREDIT_CARD",
  "transactionId": "TXN-123456789"
}
```

Exactly one of `movieId` and `eventId` may be present. The Booking service enriches this event from the Showtime schedule before it confirms seats so Recommendation does not need a synchronous Showtime call.

## `order.refunded`

Exchange: `booking.events`  
Routing key: `order.refunded`

```json
{
  "orderId": 1234,
  "userId": 42,
  "showtimeId": 567,
  "finalAmount": 405000.00,
  "ticketCount": 3
}
```

Analytics must use this event to reverse the paid-order projection exactly once.

## `review.created`

Exchange: `booking.events`  
Routing key: `review.created`

```json
{
  "reviewId": 98,
  "userId": 42,
  "movieId": 15,
  "eventId": null,
  "rating": 5,
  "status": "VISIBLE",
  "createdAt": "2026-07-10T12:00:00Z"
}
```

Recommendation currently consumes movie reviews only. Event reviews remain in the contract so downstream consumers do not need a breaking schema change when event recommendations are introduced.

