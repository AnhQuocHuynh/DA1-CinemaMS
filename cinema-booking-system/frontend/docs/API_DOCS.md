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
8. [Integration Checklist](#integration-checklist)

---

## Authentication

### Token Management

**Storage**: LocalStorage or SessionStorage with key: `token` or `accessToken`

```typescript
// After login
localStorage.setItem('accessToken', response.accessToken);

// In subsequent requests
const token = localStorage.getItem('accessToken');
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};

// On logout
localStorage.removeItem('accessToken');
```

### Token Lifecycle

- **Valid**: 24 hours (86400000 ms)
- **Expired**: User receives 401 UNAUTHORIZED
- **Action**: Redirect to login, clear stored token
- **Refresh**: Currently no refresh token endpoint (user must re-login)

### Required Headers

```
Authorization: Bearer <token>
Content-Type: application/json
```

---

## Common Request/Response Format

### Success Response

All successful responses follow this structure:

```json
{
  "id": 1,
  "field1": "value1",
  "field2": "value2",
  "timestamp": "2024-01-15T15:30:00"
}
```

**HTTP Status**: `200 OK`, `201 CREATED`, `204 NO CONTENT`

### Error Response

```json
{
  "timestamp": "2024-01-15T15:30:00",
  "status": 400,
  "errorCode": "INVALID_VOUCHER",
  "message": "Mã giảm giá không hợp lệ"
}
```

**HTTP Status**: `4xx` or `5xx`

### List Response

```json
[
  {
    "id": 1,
    "name": "Item 1"
  },
  {
    "id": 2,
    "name": "Item 2"
  }
]
```

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

**Response** (201 Created):
```json
{
  "message": "Đăng ký thành công"
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
    return { success: true };
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
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyQGV4YW1wbGUuY29tIiwiaWF0IjoxNjM4MzYwNDAwfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c",
  "tokenType": "Bearer"
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
    const { accessToken } = await response.json();
    localStorage.setItem('accessToken', accessToken);
    return { success: true, token: accessToken };
  }
  return { success: false, error: 'Invalid credentials' };
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
[
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
    "genres": [
      { "id": 1, "name": "Sci-Fi" },
      { "id": 2, "name": "Thriller" }
    ],
    "createdAt": "2024-01-01T00:00:00",
    "updatedAt": "2024-01-01T00:00:00"
  }
]
```

**Frontend Integration**:
```typescript
async function fetchMovies() {
  const response = await fetch('http://localhost:8080/api/movies');
  return response.json(); // Array of movies
}
```

---

### GET /movies/{id}

Get detailed information about a specific movie.

**Path Parameters**: `id` (Long) - Movie ID

**Response** (200 OK): Same as single movie object

**Error Cases**:
- `404 NOT_FOUND`: Movie doesn't exist

---

### GET /events

Get all upcoming events.

**Response** (200 OK):
```json
[
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
]
```

**Frontend Note**: Only returns future events (startTime > now)

---

### GET /events/{id}

Get event details.

**Path Parameters**: `id` (Long) - Event ID

**Response** (200 OK): Single event object

---

### GET /cinemas

Get all active cinemas.

**Response** (200 OK):
```json
[
  {
    "id": 1,
    "name": "Galaxy Cinema Hanoi",
    "address": "123 Tran Hung Dao St, Hanoi",
    "city": "Hanoi",
    "phone": "0243456789",
    "active": true,
    "rooms": []  // Use GET /cinemas/{id} for full room data
  }
]
```

---

### GET /cinemas/{id}

Get cinema details with all rooms.

**Response** (200 OK):
```json
{
  "id": 1,
  "name": "Galaxy Cinema Hanoi",
  "address": "123 Tran Hung Dao St, Hanoi",
  "city": "Hanoi",
  "phone": "0243456789",
  "active": true,
  "rooms": [
    {
      "id": 1,
      "name": "Hall A",
      "type": "2D",
      "totalSeats": 150,
      "rows": 10,
      "columns": 15,
      "active": true
    }
  ]
}
```

---

### GET /showtimes/movie/{movieId}

Get all showtimes for a specific movie.

**Path Parameters**: `movieId` (Long) - Movie ID

**Response** (200 OK):
```json
[
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
]
```

**Showtime Status**: `SCHEDULED`, `ONGOING`, `FINISHED`, `CANCELLED`

---

### GET /showtimes/{id}

Get showtime details.

**Response** (200 OK): Single showtime object

---

### GET /showtimes/{id}/seats

Get seat map (availability & pricing) for a showtime.

**Response** (200 OK):
```json
[
  {
    "id": 1,
    "showtimeId": 5,
    "seatTemplateId": 10,
    "price": "150000.00",
    "status": "AVAILABLE"
  },
  {
    "id": 2,
    "showtimeId": 5,
    "seatTemplateId": 11,
    "price": "180000.00",
    "status": "HELD"
  },
  {
    "id": 3,
    "showtimeId": 5,
    "seatTemplateId": 12,
    "price": "150000.00",
    "status": "BOOKED"
  }
]
```

**Seat Status**:
- `AVAILABLE`: Can be selected
- `HELD`: Reserved by another user (temporary)
- `BOOKED`: Already sold

**Frontend Integration**:
```typescript
async function getSeatMap(showtimeId) {
  const response = await fetch(`http://localhost:8080/api/showtimes/${showtimeId}/seats`);
  const seats = await response.json();
  
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

**Response** (200 OK):
```json
{
  "id": 1,
  "code": "SUMMER2024",
  "discountType": "PERCENTAGE",
  "discountValue": "10.00",
  "maxDiscountAmount": "100000.00",
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

**Response** (200 OK):
```json
{
  "id": 1,
  "userId": 1,
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

**Response** (200 OK):
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

**Response** (200 OK):
```json
{
  "id": 1,
  "status": "REFUNDED",
  "reason": "Customer requested cancellation"
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

**Response** (200 OK):
```json
{
  "id": 1,
  "ticketCode": "CINEMA-2024-0001",
  "status": "USED",
  "checkedInAt": "2024-02-15T19:05:00"
}
```

**Error Cases**:
- `404 NOT_FOUND`: Ticket code not found
- `400 BAD_REQUEST`: Ticket already checked in
- `403 FORBIDDEN`: User is not staff/admin

---

### GET /orders/{id}

Get order details (authenticated user).

**Response** (200 OK): Full order object with all tickets

---

### GET /users/{id}

Get user profile (self or admin only).

**Response** (200 OK):
```json
{
  "id": 1,
  "email": "user@example.com",
  "fullName": "John Doe",
  "phone": "0901234567",
  "gender": "M",
  "dateOfBirth": "1995-05-20",
  "active": true,
  "createdAt": "2024-01-15T10:30:00",
  "updatedAt": "2024-01-15T10:30:00"
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
  "genres": [1, 3]
}
```

**Response** (200 OK): Created movie object

---

### PUT /movies/{id}

Update movie details (Admin only).

**Request Body**: Same as POST

---

### DELETE /movies/{id}

Soft-delete movie (Admin only).

**Response** (204 No Content)

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
  "basePrice": "150000.00",
  "status": "SCHEDULED"
}
```

**Response** (200 OK): Created showtime object

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

---

### POST /cinemas/{cinemaId}/rooms

Create room (Admin only).

**Request Body**:
```json
{
  "name": "Hall B",
  "type": "3D",
  "totalSeats": 180,
  "rows": 12,
  "columns": 15,
  "active": true
}
```

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

**Discount Types**:
- `PERCENTAGE`: Discount as percentage (e.g., 10 = 10%)
- `FIXED_AMOUNT`: Fixed amount discount in currency units

---

## Error Handling

### Error Response Format

```json
{
  "timestamp": "2024-01-15T15:30:00",
  "status": 400,
  "errorCode": "INVALID_VOUCHER",
  "message": "Mã giảm giá không hợp lệ"
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
    return response.json();
  }
  
  async post<T>(endpoint: string, body: unknown): Promise<T> {
    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(body)
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response.json();
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
