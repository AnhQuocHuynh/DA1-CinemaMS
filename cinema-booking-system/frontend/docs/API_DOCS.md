# Frontend API Contract - Cinema Booking System

**API Base URL**: `http://localhost:8080/api`  
**Environment**: Development  
**Backend Framework**: Spring Boot 3.3.4  
**Authentication**: JWT Bearer Token (1-day expiration)

---

## Table of Contents

1. [Authentication](#authentication)
2. [Common Request/Response Format](#common-requestresponse-format)
3. [Auth Endpoints](#auth-endpoints)
4. [Public Endpoints (No Auth Required)](#public-endpoints-no-auth-required)
5. [Protected Endpoints](#protected-endpoints)
6. [Error Handling](#error-handling)
7. [Flow Examples](#flow-examples)
8. [Frontend Integration Alignment](#frontend-integration-alignment-may-2026-snapshot)
9. [Integration Checklist](#integration-checklist)

---

## Authentication

### Token Management

**Storage**: Access token + refresh token in LocalStorage or SessionStorage

```typescript
// After login
localStorage.setItem('accessToken', response.accessToken);
localStorage.setItem('refreshToken', response.refreshToken);

// In subsequent requests
const token = localStorage.getItem('accessToken');
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};

// On logout
localStorage.removeItem('accessToken');
localStorage.removeItem('refreshToken');
```

### Token Lifecycle

- **Valid**: 24 hours (86400000 ms)
- **Expired**: User receives 401 UNAUTHORIZED
- **Action**: Redirect to login, clear stored token
- **Refresh**: Use `POST /auth/refresh` with refresh token

### Required Headers

```
Authorization: Bearer <token>
Content-Type: application/json
```

---

## Common Request/Response Format

### Success Response

Most endpoints return a standard `ApiResponse<T>` wrapper:

```json
{
  "success": true,
  "message": "Thành công",
  "data": {
    "id": 1,
    "field1": "value1"
  },
  "timestamp": 1710000000000
}
```

**HTTP Status**: `200 OK` (most endpoints), `201 CREATED` (if used), `204 NO CONTENT` (delete)

### Error Response

```json
{
  "success": false,
  "message": "Mã giảm giá không hợp lệ",
  "errorCode": "INVALID_VOUCHER",
  "details": null,
  "timestamp": 1710000000000
}
```

**HTTP Status**: `4xx` or `5xx`

### List Response (Wrapped)

```json
{
  "success": true,
  "message": "Thành công",
  "data": [
    { "id": 1, "name": "Item 1" },
    { "id": 2, "name": "Item 2" }
  ],
  "timestamp": 1710000000000
}
```

### Raw Responses (No Wrapper)

These endpoints currently return raw JSON objects/arrays (no `ApiResponse` wrapper):
- `/api/orders/**`
- `/api/tickets/**`
- `/api/vouchers/**`
- `/api/reviews/**`

---

## Auth Endpoints

### POST /auth/register

Register a new user account.

**Headers**: None (public)

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!",
  "fullName": "John Doe",
  "phone": "0901234567"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Đăng ký thành công",
  "data": "Đăng ký thành công",
  "timestamp": 1710000000000
}
```

**Error Cases**:
- `409 CONFLICT`: Email already registered
- `400 BAD_REQUEST`: Validation error (missing fields, invalid email format)

**Frontend Integration**:
```typescript
async function register(email, password, fullName, phone) {
  const response = await fetch('http://localhost:8080/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, fullName, phone })
  });
  if (response.ok) {
    const payload = await response.json();
    return { success: payload.success, message: payload.message };
  }
  return { success: false, error: await response.json() };
}
```

---

### POST /auth/login

Authenticate user and receive JWT token.

**Headers**: None (public)

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Đăng nhập thành công",
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "tokenType": "Bearer",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": 1,
      "email": "user@example.com",
      "fullName": "John Doe",
      "phone": "0901234567",
      "roles": ["ROLE_CUSTOMER"]
    }
  },
  "timestamp": 1710000000000
}
```

**Error Cases**:
- `401 UNAUTHORIZED`: Wrong email or password
- `400 BAD_REQUEST`: Missing fields

**Frontend Integration**:
```typescript
async function login(email, password) {
  const response = await fetch('http://localhost:8080/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  
  if (response.ok) {
    const payload = await response.json();
    const { accessToken, refreshToken, user } = payload.data;
    localStorage.setItem('accessToken', accessToken);
    localStorage.setItem('refreshToken', refreshToken);
    return { success: true, token: accessToken, user };
  }
  return { success: false, error: 'Invalid credentials' };
}
```

---

### POST /auth/refresh

Refresh access token with refresh token.

**Headers**: None (public)

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** (200 OK): Same shape as login `data` (new `accessToken`, `refreshToken`, and `user`).

---

### POST /auth/logout

Invalidate refresh token.

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Đăng xuất thành công",
  "data": null,
  "timestamp": 1710000000000
}
```

---

### POST /auth/forgot-password

Request a password reset.

**Request Body**:
```json
{
  "email": "user@example.com"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Yêu cầu đặt lại mật khẩu đã được xử lý. Vui lòng kiểm tra log hệ thống",
  "data": null,
  "timestamp": 1710000000000
}
```

---

### POST /auth/reset-password

Reset password using reset token.

**Request Body**:
```json
{
  "token": "reset-token-from-system",
  "newPassword": "NewPassword123!",
  "confirmPassword": "NewPassword123!"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Đặt lại mật khẩu thành công",
  "data": null,
  "timestamp": 1710000000000
}
```

---

## Public Endpoints (No Auth Required)

### GET /movies

Get all active movies.

**Headers**: None

**Query Parameters**: None (pagination can be added: `?page=0&size=10`)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Lấy danh sách phim thành công",
  "data": [
    {
      "id": 1,
      "title": "Inception",
      "description": "A mind-bending thriller about dreams within dreams.",
      "durationMinutes": 148,
      "releaseDate": "2024-01-10",
      "ageRating": "PG-13",
      "posterUrl": "https://example.com/inception.jpg",
      "trailerUrl": "https://example.com/inception-trailer.mp4",
      "language": "English",
      "active": true,
      "genres": ["Sci-Fi", "Thriller"],
      "createdAt": "2024-01-01T00:00:00",
      "updatedAt": "2024-01-01T00:00:00"
    }
  ],
  "timestamp": 1710000000000
}
```

**Frontend Integration**:
```typescript
async function fetchMovies() {
  const response = await fetch('http://localhost:8080/api/movies');
  const payload = await response.json();
  return payload.data; // Array of movies
}
```

---

### GET /movies/{id}

Get detailed information about a specific movie.

**Path Parameters**: `id` (Long) - Movie ID

**Response** (200 OK): ApiResponse with single `MovieResponse`

**Error Cases**:
- `404 NOT_FOUND`: Movie doesn't exist

---

### GET /events

Get all upcoming events.

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Lấy danh sách sự kiện sắp tới thành công",
  "data": [
    {
      "id": 1,
      "name": "Concert Night",
      "description": "Live music performance by famous artist",
      "startTime": "2024-02-20T19:00:00",
      "endTime": "2024-02-20T22:00:00",
      "venue": "Grand Theater",
      "imageUrl": "https://example.com/concert.jpg",
      "active": true,
      "createdAt": "2024-01-10T00:00:00",
      "updatedAt": "2024-01-10T00:00:00"
    }
  ],
  "timestamp": 1710000000000
}
```

**Frontend Note**: Only returns future events (startTime > now)

---

### GET /events/{id}

Get event details.

**Path Parameters**: `id` (Long) - Event ID

**Response** (200 OK): ApiResponse with single `EventResponse`

---

### GET /catalog/search

Search movies and events.

**Query Parameters** (all optional):
- `keyword` (string)
- `genreId` (long)
- `fromDate` (YYYY-MM-DD)
- `toDate` (YYYY-MM-DD)
- `page` (default 0)
- `size` (default 10)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Tìm kiếm danh mục thành công",
  "data": {
    "movies": [/* MovieResponse */],
    "events": [/* EventResponse */],
    "movieTotalPages": 2,
    "eventTotalPages": 1,
    "movieTotalElements": 12,
    "eventTotalElements": 4
  },
  "timestamp": 1710000000000
}
```

---

### GET /cinemas

Get all active cinemas.

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Lấy danh sách rạp thành công",
  "data": [
    {
      "id": 1,
      "name": "Galaxy Cinema Hanoi",
      "address": "123 Tran Hung Dao St, Hanoi",
      "city": "Hanoi",
      "phone": "0243456789",
      "active": true
    }
  ],
  "timestamp": 1710000000000
}
```

---

### GET /cinemas/{id}

Get cinema details.

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Lấy thông tin rạp thành công",
  "data": {
    "id": 1,
    "name": "Galaxy Cinema Hanoi",
    "address": "123 Tran Hung Dao St, Hanoi",
    "city": "Hanoi",
    "phone": "0243456789",
    "active": true
  },
  "timestamp": 1710000000000
}
```

---

### GET /cinemas/{cinemaId}/rooms

Get rooms for a cinema.

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Lấy danh sách phòng chiếu thành công",
  "data": [
    {
      "id": 1,
      "cinemaId": 1,
      "cinemaName": "Galaxy Cinema Hanoi",
      "name": "Hall A",
      "type": "2D",
      "totalSeats": 150,
      "rows": 10,
      "columns": 15,
      "active": true,
      "underMaintenance": false
    }
  ],
  "timestamp": 1710000000000
}
```

---

### GET /cinemas/{cinemaId}/rooms/{roomId}

Get room details.

**Response** (200 OK): ApiResponse with single `RoomResponse`.

---

### GET /showtimes/movie/{movieId}

Get all showtimes for a specific movie.

**Path Parameters**: `movieId` (Long) - Movie ID

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Lấy danh sách suất chiếu thành công",
  "data": [
    {
      "id": 5,
      "roomId": 1,
      "movieId": 1,
      "eventId": null,
      "startTime": "2024-02-15T19:00:00",
      "endTime": "2024-02-15T21:30:00",
      "basePrice": "150000.00",
      "status": "SCHEDULED",
      "createdAt": "2024-01-10T10:00:00"
    }
  ],
  "timestamp": 1710000000000
}
```

**Showtime Status**: `SCHEDULED`, `ONGOING`, `FINISHED`, `CANCELLED`

---

### GET /showtimes/{id}

Get showtime details.

**Response** (200 OK): ApiResponse with single `ShowtimeResponse`

---

### GET /showtimes/{id}/seats

Get seat map (availability & pricing) for a showtime.

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Lấy sơ đồ ghế thành công",
  "data": [
    {
      "id": 1,
      "showtimeId": 5,
      "seatTemplateId": 10,
      "price": "150000.00",
      "status": "AVAILABLE",
      "holdTtlSeconds": null
    },
    {
      "id": 2,
      "showtimeId": 5,
      "seatTemplateId": 11,
      "price": "180000.00",
      "status": "HELD",
      "holdTtlSeconds": 120
    },
    {
      "id": 3,
      "showtimeId": 5,
      "seatTemplateId": 12,
      "price": "150000.00",
      "status": "BOOKED",
      "holdTtlSeconds": null
    }
  ],
  "timestamp": 1710000000000
}
```

**Seat Status**:
- `AVAILABLE`: Can be selected
- `HELD`: Reserved by another user (temporary)
- `BOOKED`: Already sold

**Frontend Integration**:
```typescript
async function getSeatMap(showtimeId) {
  const response = await fetch(`http://localhost:8080/api/showtimes/${showtimeId}/seats`);
  const payload = await response.json();
  const seats = payload.data;
  
  // Map seats to UI grid based on room layout
  const availableSeats = seats.filter(s => s.status === 'AVAILABLE');
  const heldSeats = seats.filter(s => s.status === 'HELD');
  const bookedSeats = seats.filter(s => s.status === 'BOOKED');
  
  return { availableSeats, heldSeats, bookedSeats };
}
```

---

### GET /vouchers/validate/{code}

Validate a voucher code (check if active and applicable).

**Path Parameters**: `code` (String) - Voucher code (e.g., "SUMMER2024")

**Response** (200 OK) (raw `Voucher`):
```json
{
  "id": 1,
  "code": "SUMMER2024",
  "discountType": "PERCENTAGE",
  "discountValue": "10.00",
  "maxDiscountAmount": "100000.00",
  "usageLimit": 500,
  "usedCount": 25,
  "validFrom": "2024-06-01T00:00:00",
  "validUntil": "2024-08-31T23:59:59",
  "active": true
}
```

**Error Cases**:
- `404 NOT_FOUND`: Code doesn't exist or voucher is inactive

**Frontend Integration**:
```typescript
async function validateVoucher(code) {
  try {
    const response = await fetch(`http://localhost:8080/api/vouchers/validate/${code}`);
    if (response.ok) {
      const voucher = await response.json();
      return { valid: true, voucher };
    }
    return { valid: false, error: 'Invalid voucher code' };
  } catch {
    return { valid: false, error: 'Error validating voucher' };
  }
}
```

---

## Protected Endpoints

**Requires**: Authorization header with Bearer token

**Format**: `Authorization: Bearer <token>`

**Note**: `/api/orders/**` and several GET endpoints currently do not enforce auth in code; frontend should still send tokens and treat them as protected.

---

### POST /orders

Create a new booking order.

**Headers**:
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "userId": 1,
  "showtimeId": 5,
  "seatIds": [10, 11, 12],
  "voucherCode": "SUMMER2024"
}
```

**Response** (200 OK) (raw `Order`):
```json
{
  "id": 1,
  "userId": 1,
  "showtimeId": 5,
  "seatIdsSnapshot": "[10,11,12]",
  "voucherId": 3,
  "totalAmount": "450000.00",
  "discountAmount": "45000.00",
  "finalAmount": "405000.00",
  "status": "PENDING",
  "paymentMethod": null,
  "paymentTransactionId": null,
  "tickets": [
    {
      "id": 1,
      "showtimeSeatId": 10,
      "ticketCode": "CINEMA-2024-0001",
      "qrCodeData": "iVBORw0KGgoAAAANSUhEUgAAAAoAAAAKCAYAAACNMs+9...",
      "price": "150000.00",
      "status": "VALID",
      "checkedInAt": null,
      "createdAt": "2024-01-15T15:30:00"
    }
  ],
  "createdAt": "2024-01-15T15:30:00",
  "updatedAt": "2024-01-15T15:30:00"
}
```

**Field Descriptions**:
- `totalAmount`: Sum of all selected seats
- `discountAmount`: Amount deducted from voucher
- `finalAmount`: Amount to be paid (totalAmount - discountAmount)
- `status`: PENDING (waiting for payment)
- `tickets`: Array of generated tickets with QR codes (base64 encoded PNG)
- `seatIdsSnapshot`: Server snapshot of seat ids as a string
- `voucherCode`: Optional (can be null)

**Error Cases**:
- `401 UNAUTHORIZED`: Token missing or expired
- `400 BAD_REQUEST`: Invalid seats or voucher
- `409 CONFLICT`: Seats already booked or held

**Frontend Integration**:
```typescript
async function createOrder(userId, showtimeId, seatIds, voucherCode) {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch('http://localhost:8080/api/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      userId,
      showtimeId,
      seatIds,
      voucherCode: voucherCode || null
    })
  });
  
  if (response.ok) {
    const order = await response.json();
    return { success: true, order };
  }
  return { success: false, error: await response.json() };
}
```

---

### POST /orders/{id}/pay

Process payment for an order.

**Path Parameters**: `id` (Long) - Order ID

**Request Body**:
```json
{
  "paymentMethod": "CREDIT_CARD",
  "transactionId": "TXN-123456789"
}
```

**Supported Payment Methods**:
- `CREDIT_CARD`
- `DEBIT_CARD`
- `BANK_TRANSFER`
- `WALLET`

**Response** (200 OK) (raw `Order`):
```json
{
  "id": 1,
  "status": "PAID",
  "finalAmount": "405000.00",
  "paymentMethod": "CREDIT_CARD",
  "paymentTransactionId": "TXN-123456789",
  "tickets": [
    {
      "id": 1,
      "ticketCode": "CINEMA-2024-0001",
      "qrCodeData": "...",
      "status": "VALID"
    }
  ]
}
```

**Error Cases**:
- `404 NOT_FOUND`: Order doesn't exist
- `400 BAD_REQUEST`: Order already paid or invalid status

**Frontend Integration**:
```typescript
async function processPayment(orderId, paymentMethod, transactionId) {
  const token = localStorage.getItem('accessToken');
  
  const response = await fetch(`http://localhost:8080/api/orders/${orderId}/pay`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      paymentMethod,
      transactionId
    })
  });
  
  return response.json();
}
```

---

### POST /orders/{id}/refund

Refund a completed order (must have PAID status).

**Request Body**:
```json
{
  "reason": "Customer requested cancellation"
}
```

**Response** (200 OK) (raw `Order`):
```json
{
  "id": 1,
  "status": "REFUNDED",
  "paymentMethod": "CREDIT_CARD",
  "paymentTransactionId": "TXN-123456789"
}
```

**Error Cases**:
- `404 NOT_FOUND`: Order doesn't exist
- `400 BAD_REQUEST`: Order not in PAID status

---

### POST /tickets/check-in

Check in a ticket at the venue (Staff/Admin only).

**Headers**:
```
Authorization: Bearer <staff/admin_token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "ticketCode": "CINEMA-2024-0001"
}
```

**Response** (200 OK) (raw `TicketResponse`):
```json
{
  "id": 1,
  "orderId": 1,
  "userId": 1,
  "showtimeSeatId": 10,
  "ticketCode": "CINEMA-2024-0001",
  "qrCodeData": "...",
  "price": "150000.00",
  "status": "CHECKED_IN",
  "checkedInAt": "2024-02-15T19:05:00",
  "createdAt": "2024-01-15T15:30:00",
  "refundable": false,
  "refundPercent": 0
}
```

**Error Cases**:
- `404 NOT_FOUND`: Ticket code not found
- `400 BAD_REQUEST`: Ticket already checked in
- `403 FORBIDDEN`: User is not staff/admin

---

### GET /tickets/code/{ticketCode}

Get ticket by code.

**Response** (200 OK): raw `TicketResponse`.

---

### GET /tickets/users/{userId}

Get all tickets for a user.

**Response** (200 OK): array of `TicketResponse`.

---

### GET /tickets/orders/{orderId}

Get all tickets for an order.

**Response** (200 OK): array of `TicketResponse`.

---

### POST /reviews

Create a review (movie or event).

**Request Body**:
```json
{
  "userId": 1,
  "movieId": 5,
  "eventId": null,
  "rating": 5,
  "comment": "Amazing experience"
}
```

**Response** (200 OK) (raw `ReviewResponse`):
```json
{
  "id": 1,
  "userId": 1,
  "movieId": 5,
  "eventId": null,
  "rating": 5,
  "comment": "Amazing experience",
  "status": "ACTIVE",
  "createdAt": "2024-01-15T15:30:00"
}
```

---

### GET /reviews/movies/{movieId}

Get reviews for a movie.

**Response** (200 OK): array of `ReviewResponse`.

---

### GET /reviews/events/{eventId}

Get reviews for an event.

**Response** (200 OK): array of `ReviewResponse`.

---

### GET /reviews/movies/{movieId}/insight

Get review insights for a movie.

**Response** (200 OK) (raw `ReviewInsightResponse`):
```json
{
  "movieId": 5,
  "eventId": null,
  "totalReviews": 120,
  "averageRating": 4.6,
  "oneStarCount": 2,
  "twoStarCount": 5,
  "threeStarCount": 18,
  "fourStarCount": 40,
  "fiveStarCount": 55
}
```

---

### GET /reviews/events/{eventId}/insight

Get review insights for an event.

**Response** (200 OK): raw `ReviewInsightResponse`.

---

### GET /users/{id}

Get user profile (self or admin only).

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Lấy thông tin người dùng thành công",
  "data": {
    "id": 1,
    "email": "user@example.com",
    "fullName": "John Doe",
    "phone": "0901234567",
    "roles": ["ROLE_CUSTOMER"]
  },
  "timestamp": 1710000000000
}
```

---

## Admin-Only Endpoints

**Requires**: Admin role + valid token

---

### POST /movies

Create a new movie (Admin only).

**Request Body**:
```json
{
  "title": "Avatar 3",
  "description": "The next installment in the Avatar saga",
  "durationMinutes": 165,
  "releaseDate": "2024-12-15",
  "ageRating": "PG-13",
  "posterUrl": "https://example.com/avatar3.jpg",
  "trailerUrl": "https://example.com/avatar3-trailer.mp4",
  "language": "English",
  "active": true,
  "genreIds": [1, 3]
}
```

**Response** (200 OK): ApiResponse with created `MovieResponse`

---

### PUT /movies/{id}

Update movie details (Admin only).

**Request Body**: Same as POST

---

### DELETE /movies/{id}

Soft-delete movie (Admin only).

**Response** (200 OK): ApiResponse with `null` data

---

### POST /showtimes

Create showtime (Admin or Staff).

**Request Body**:
```json
{
  "roomId": 1,
  "movieId": 5,
  "eventId": null,
  "startTime": "2024-02-20T19:00:00",
  "endTime": "2024-02-20T21:30:00",
  "basePrice": "150000.00"
}
```

**Response** (200 OK): ApiResponse with created `ShowtimeResponse`

---

### POST /cinemas

Create cinema (Admin only).

**Request Body**:
```json
{
  "name": "Star Cinema HCMC",
  "address": "456 Nguyen Hue Blvd, HCMC",
  "city": "HCMC",
  "phone": "0283456789",
  "active": true
}
```

**Response** (200 OK): ApiResponse with created `CinemaResponse`

---

### PUT /cinemas/{id}

Update cinema (Admin only).

**Request Body**: Same as POST

**Response** (200 OK): ApiResponse with updated `CinemaResponse`

---

### DELETE /cinemas/{id}

Soft-delete cinema (Admin only).

**Response** (200 OK): ApiResponse with `null` data

---

### POST /cinemas/{cinemaId}/rooms

Create room (Admin only).

**Request Body**:
```json
{
  "cinemaId": 1,
  "name": "Hall B",
  "type": "3D",
  "totalSeats": 180,
  "rows": 12,
  "columns": 15,
  "active": true,
  "underMaintenance": false
}
```

**Response** (200 OK): ApiResponse with created `RoomResponse`

---

### PUT /cinemas/{cinemaId}/rooms/{roomId}

Update room (Admin only).

**Request Body**: Same as POST

**Response** (200 OK): ApiResponse with updated `RoomResponse`

---

### DELETE /cinemas/{cinemaId}/rooms/{roomId}

Delete room (Admin only).

**Response** (200 OK): ApiResponse with `null` data

---

### POST /vouchers

Create voucher (Admin only).

**Request Body**:
```json
{
  "code": "NEWYEAR2025",
  "discountType": "PERCENTAGE",
  "discountValue": "10.00",
  "maxDiscountAmount": "100000.00",
  "usageLimit": 500,
  "validFrom": "2025-01-01T00:00:00",
  "validUntil": "2025-01-31T23:59:59",
  "active": true
}
```

**Response** (200 OK): raw `Voucher`

**Discount Types**:
- `PERCENTAGE`: Discount as percentage (e.g., 10 = 10%)
- `FIXED_AMOUNT`: Fixed amount discount in currency units

---

### GET /vouchers

Get all vouchers (Admin only).

**Response** (200 OK): array of `Voucher`

---

### POST /events

Create event (Admin only).

**Request Body**:
```json
{
  "name": "Concert Night",
  "description": "Live music performance",
  "startTime": "2024-02-20T19:00:00",
  "endTime": "2024-02-20T22:00:00",
  "venue": "Grand Theater",
  "imageUrl": "https://example.com/concert.jpg",
  "active": true
}
```

**Response** (200 OK): ApiResponse with created `EventResponse`

---

### DELETE /events/{id}

Delete event (Admin only).

**Response** (200 OK): ApiResponse with `null` data

---

### GET /users

Get all users (Admin only).

**Response** (200 OK): ApiResponse with array of `UserResponse`

---

## Error Handling

### Error Response Format

```json
{
  "success": false,
  "message": "Mã giảm giá không hợp lệ",
  "errorCode": "INVALID_VOUCHER",
  "details": null,
  "timestamp": 1710000000000
}
```

### Common HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource successfully created |
| 204 | No Content | Deletion successful |
| 400 | Bad Request | Invalid input, check error message |
| 401 | Unauthorized | Token missing/expired, redirect to login |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate email, seats already booked |
| 500 | Server Error | Unexpected error, retry later |

### Common Error Codes

| Code | HTTP Status | Meaning |
|------|-------------|---------|
| `EMAIL_TAKEN` | 409 | Email already registered |
| `INVALID_CREDENTIALS` | 401 | Wrong email/password |
| `INVALID_VOUCHER` | 400 | Voucher code doesn't exist |
| `VOUCHER_EXPIRED` | 400 | Voucher past expiration date |
| `VOUCHER_EXHAUSTED` | 400 | Voucher usage limit reached |
| `ORDER_NOT_FOUND` | 404 | Order doesn't exist |
| `INVALID_ORDER_STATUS` | 400 | Can't transition order to this status |
| `ACCESS_DENIED` | 403 | User role insufficient |
| `VALIDATION_FAILED` | 400 | Input validation error |
| `INTERNAL_ERROR` | 500 | Server error |

### Frontend Error Handling

```typescript
async function handleApiError(response) {
  if (response.status === 401) {
    // Clear token and redirect to login
    localStorage.removeItem('accessToken');
    window.location.href = '/login';
  } else if (response.status === 403) {
    // Show permission denied message
    alert('You do not have permission to perform this action');
  } else if (response.status >= 400 && response.status < 500) {
    // Show user-friendly error from backend
    const error = await response.json();
    alert(error.message || 'An error occurred');
  } else {
    // Server error
    alert('Server error. Please try again later.');
  }
}
```

---

## Flow Examples

### User Registration & Login Flow

```
1. User fills registration form
   POST /auth/register
   {email, password, fullName, phone}
   ↓
2. Account created (201 Created)
   
3. User logs in
   POST /auth/login
   {email, password}
   ↓
4. Receive accessToken (200 OK)
   {accessToken: "eyJ..."}
   
5. Store token in localStorage
   localStorage.setItem('accessToken', token)
   
6. Redirect to home/dashboard
```

### Browse Movies & Select Showtime

```
1. Load movie list
   GET /movies
   ↓
2. Display movie grid
   
3. User clicks movie
   GET /movies/{movieId}
   ↓
4. Display movie details & showtimes
   
5. Load showtimes for movie
   GET /showtimes/movie/{movieId}
   ↓
6. Display showtime list
   
7. User clicks showtime
   GET /showtimes/{showtimeId}/seats
   ↓
8. Display interactive seat map
```

### Complete Booking Flow

```
1. User selects seats from map
   Frontend: Store selected seatIds in state
   
2. User enters optional voucher code
   GET /vouchers/validate/{code}
   ↓
   Display discount amount
   
3. User confirms and pays
   POST /orders
   {userId, showtimeId, seatIds, voucherCode}
   ↓
   Receive order with PENDING status & generated tickets
   
4. Process payment
   POST /orders/{orderId}/pay
   {paymentMethod, transactionId}
   ↓
   Receive order with PAID status
   
5. Display tickets
   - Show ticket codes
   - Display QR codes (use qrCodeData)
   - Offer download/print option
   
6. User receives email with ticket details
```

### Refund Flow

```
1. User requests cancellation
   POST /orders/{orderId}/refund
   {reason: "..."}
   ↓
2. Order status changes to REFUNDED
   
3. Refund processed (timeline depends on payment method)
   
4. Tickets marked as CANCELLED
   
5. User notified of refund
```

---

## Frontend Integration Alignment (May 2026 snapshot)

- **Live API usage**: 0% (all services are mocked or TODO-commented).
- **Route alignment (commented TODOs)**: ~25% (correct routes: `/auth/login`, `/auth/forgot-password`, `/movies`, `/showtimes/{id}/seats`).
- **Mismatch**: `/auth/signup` should be `/auth/register`.
- **Mismatch**: `/showtimes?movieId=...` should be `/showtimes/movie/{movieId}`.
- **Mismatch**: `/bookings` should be `/orders`.
- **Mismatch**: `/tickets/{ticketId}` should be `/tickets/code/{ticketCode}` or `/tickets/orders/{orderId}`.
- **Mismatch**: `/admin/*` and `/staff/*` routes do not exist in backend.
- **Data-shape alignment**: low. Backend wraps most responses in `ApiResponse` and login returns `accessToken`, `refreshToken`, and `user`. Frontend expects `{ token, user }` and stores `authToken`.

## Integration Checklist

### Frontend Readiness Status

- [ ] **Auth Module**
  - [ ] Register endpoint connected
  - [ ] Login endpoint connected
  - [ ] Token storage working
  - [ ] Token cleanup on logout
  - [ ] Automatic redirect on 401

- [ ] **Public Browsing**
  - [ ] Movies endpoint integrated
  - [ ] Events endpoint integrated
  - [ ] Cinema list display working
  - [ ] Showtime fetching working
  - [ ] Seat map loading and displaying

- [ ] **Booking Flow**
  - [ ] Create order endpoint connected
  - [ ] Order response parsing
  - [ ] Ticket display with QR codes
  - [ ] Payment processing endpoint connected
  - [ ] Order confirmation display

- [ ] **User Functions**
  - [ ] View order history
  - [ ] View ticket details
  - [ ] Download/print tickets
  - [ ] Refund request flow

- [ ] **Admin Functions**
  - [ ] Movie CRUD endpoints connected
  - [ ] Showtime creation form
  - [ ] Voucher management
  - [ ] Role-based access control

- [ ] **Error Handling**
  - [ ] 401 redirects to login
  - [ ] 403 shows permission error
  - [ ] 400 displays validation errors
  - [ ] 500 shows generic error message
  - [ ] Network errors handled gracefully

- [ ] **UI Enhancements**
  - [ ] Loading states on all data-driven screens
  - [ ] Empty states when no data
  - [ ] Success notifications after actions
  - [ ] Error toast/modal notifications

---

## Development Notes

### Base URL Configuration

Store in environment file or config:

```typescript
// environment.ts
export const environment = {
  apiUrl: 'http://localhost:8080/api',
  production: false
};

// Or use environment variables
const apiUrl = process.env.VITE_API_URL || 'http://localhost:8080/api';
```

### API Service Pattern

```typescript
// api.service.ts
export class ApiService {
  constructor(private baseUrl: string) {}
  
  private getHeaders() {
    const token = localStorage.getItem('accessToken');
    return {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` })
    };
  }
  
  async get<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      headers: this.getHeaders()
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return payload.data ?? payload;
  }
  
  async post<T>(endpoint: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    return payload.data ?? payload;
  }
}
```

### Token Expiration Handling

```typescript
// auth.interceptor.ts
async function executeWithTokenRefresh(fn) {
  try {
    return await fn();
  } catch (error: any) {
    if (error.status === 401) {
      // Token expired
      localStorage.removeItem('accessToken');
      window.location.href = '/login';
    }
    throw error;
  }
}
```

### Seat Map UI Mapping

Backend returns flat list of seats. Map to 2D grid:

```typescript
function buildSeatGrid(seats, rows, columns) {
  const grid = Array(rows).fill(null).map(() => Array(columns).fill(null));
  
  seats.forEach(seat => {
    const seatTemplate = seat.seatTemplateId;
    // Assume seatTemplate encodes row/col info
    const row = Math.floor((seatTemplate - 1) / columns);
    const col = (seatTemplate - 1) % columns;
    grid[row][col] = seat;
  });
  
  return grid;
}
```

---

## Testing Credentials

For development/testing:

**Admin Account**:
```
Email: admin@cinema.com
Password: Admin123!
```

**Regular User Account**:
```
Email: user@cinema.com
Password: User123!
```

(Create via `/auth/register` if not pre-seeded)

---

## Support & Issues

- Backend running on `http://localhost:8080`
- Check backend logs for detailed error messages
- Database: PostgreSQL on localhost:5432
- Cache: Redis on localhost:6379
- All timestamps in UTC/ISO 8601 format
