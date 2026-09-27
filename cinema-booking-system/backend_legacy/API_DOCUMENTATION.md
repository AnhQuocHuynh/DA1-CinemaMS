# Cinema Booking System - Backend API Documentation

**Project**: Movie and Event Ticket Booking System  
**Framework**: Spring Boot 3.3.4  
**Java Version**: 21  
**Database**: PostgreSQL  
**Cache**: Redis  
**Authentication**: JWT (jjwt 0.12.6)  
**Port**: 8080

---

## Table of Contents
1. [Project Overview](#project-overview)
2. [Architecture & Modules](#architecture--modules)
3. [Authentication & Security](#authentication--security)
4. [API Endpoints](#api-endpoints)
5. [Data Models](#data-models)
6. [Service Layer](#service-layer)
7. [Error Handling](#error-handling)
8. [Database Configuration](#database-configuration)

---

## Project Overview

### Technology Stack
- **Spring Boot**: 3.3.4
- **Spring Security**: JWT-based stateless authentication
- **Spring Data JPA**: ORM with Hibernate
- **PostgreSQL**: Primary database
- **Redis**: Caching layer
- **Lombok**: Boilerplate reduction
- **Maven**: Build tool

### Key Features
- User registration and JWT authentication
- Movie and event catalog management
- Showtime and seat management
- Order and ticket generation
- Voucher-based discount system
- Role-based access control (CUSTOMER, STAFF, ADMIN)

---

## Architecture & Modules

The backend is organized into modular domains:

```
src/main/java/com/uit/cinema/
├── auth/                          (Currently unused, legacy)
├── booking/                       (Orders, tickets, vouchers, payments)
│   ├── controller/
│   ├── entity/
│   ├── repository/
│   └── service/
├── catalog/                       (Movies, events, genres)
│   ├── controller/
│   ├── entity/
│   ├── repository/
│   └── service/
├── facility/                      (Cinemas, rooms, seat templates)
│   ├── controller/
│   ├── entity/
│   ├── repository/
│   └── service/
├── showtime/                      (Showtimes, seat availability, seat locking)
│   ├── controller/
│   ├── entity/
│   ├── repository/
│   └── service/
├── iam/                           (Identity & Access Management - Users, roles, auth)
│   ├── controller/
│   ├── entity/
│   ├── repository/
│   └── service/
└── core/                          (Cross-cutting concerns)
    ├── config/                    (Security, Redis, WebMvc)
    ├── exception/                 (Custom exception handling)
    └── security/                  (JWT token provider and filter)
```

---

## Authentication & Security

### JWT Configuration

**Location**: [backend/src/main/resources/application.yml](backend/src/main/resources/application.yml)

```yaml
app:
  jwt:
    secret: "REPLACE_WITH_A_256_BIT_BASE64_ENCODED_SECRET_KEY_HERE"
    expiration-ms: 86400000       # 1 day
    refresh-expiration-ms: 604800000  # 7 days
```

### JWT Implementation

**Token Provider**: [com/uit/cinema/core/security/JwtTokenProvider.java](backend/src/main/java/com/uit/cinema/core/security/JwtTokenProvider.java)
- Generates access tokens using HMAC-SHA
- Validates token signature and expiration
- Extracts username from token claims

**JWT Filter**: [com/uit/cinema/core/security/JwtAuthenticationFilter.java](backend/src/main/java/com/uit/cinema/core/security/JwtAuthenticationFilter.java)
- Intercepts requests and extracts JWT from `Authorization: Bearer <token>` header
- Validates token and loads user details
- Sets authentication context for Spring Security

### Security Configuration

**Location**: [com/uit/cinema/core/config/SecurityConfig.java](backend/src/main/java/com/uit/cinema/core/config/SecurityConfig.java)

**Public Endpoints** (No authentication required):
```
/api/auth/**          # Registration & login
/api/movies/**        # View movies
/api/events/**        # View events
/api/showtimes/**     # View showtimes
```

**Protected Endpoints**:
- ADMIN only: Movie/Event CRUD, Cinema/Room management, Voucher management
- STAFF only: Showtime creation, ticket check-in
- CUSTOMER: Order creation, user profile access
- All authenticated: User-specific operations

### User Roles

```java
ROLE_CUSTOMER   # Default role for registered users
ROLE_STAFF      # Cinema staff (check-in, showtime management)
ROLE_ADMIN      # Administrator (full access)
```

---

## API Endpoints

### 1. Authentication Endpoints (`/api/auth`)

#### POST /api/auth/register
Register a new user

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123",
  "fullName": "John Doe",
  "phone": "0901234567"
}
```

**Response** (201):
```json
{
  "message": "Đăng ký thành công"
}
```

**Error**: 409 CONFLICT - Email already in use

---

#### POST /api/auth/login
Authenticate user and receive JWT token

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "securePassword123"
}
```

**Response** (200):
```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "tokenType": "Bearer"
}
```

**Error**: 401 UNAUTHORIZED - Invalid credentials

---

### 2. User Endpoints (`/api/users`)

#### GET /api/users
Get all users (ADMIN only)

**Response** (200):
```json
[
  {
    "id": 1,
    "email": "admin@cinema.com",
    "fullName": "Admin User",
    "phone": "0901111111",
    "gender": "M",
    "dateOfBirth": "1990-01-01",
    "active": true,
    "createdAt": "2024-01-15T10:30:00",
    "updatedAt": "2024-01-15T10:30:00"
  }
]
```

---

#### GET /api/users/{id}
Get user by ID (ADMIN or self)

**Response** (200):
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

### 3. Movie Endpoints (`/api/movies`)

#### GET /api/movies
Get all active movies (public)

**Response** (200):
```json
[
  {
    "id": 1,
    "title": "Inception",
    "description": "A mind-bending thriller...",
    "durationMinutes": 148,
    "releaseDate": "2024-01-10",
    "ageRating": "PG-13",
    "posterUrl": "https://example.com/inception.jpg",
    "trailerUrl": "https://example.com/inception-trailer.mp4",
    "language": "English",
    "active": true,
    "genres": [
      {
        "id": 1,
        "name": "Sci-Fi"
      },
      {
        "id": 2,
        "name": "Thriller"
      }
    ],
    "createdAt": "2024-01-01T00:00:00",
    "updatedAt": "2024-01-01T00:00:00"
  }
]
```

---

#### GET /api/movies/{id}
Get movie details by ID (public)

**Response** (200): Same as individual movie object above

---

#### POST /api/movies
Create new movie (ADMIN only)

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

**Response** (200): Created movie object

---

#### PUT /api/movies/{id}
Update movie details (ADMIN only)

**Request Body**: Same as POST

**Response** (200): Updated movie object

---

#### DELETE /api/movies/{id}
Soft-delete movie (ADMIN only)

**Response** (204): No content

---

### 4. Event Endpoints (`/api/events`)

#### GET /api/events
Get upcoming events (public)

**Response** (200):
```json
[
  {
    "id": 1,
    "name": "Concert Night",
    "description": "Live music performance",
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

---

#### GET /api/events/{id}
Get event details (public)

**Response** (200): Event object

---

#### POST /api/events
Create event (ADMIN only)

**Request Body**:
```json
{
  "name": "Sport Event",
  "description": "Championship match",
  "startTime": "2024-03-01T20:00:00",
  "endTime": "2024-03-01T22:30:00",
  "venue": "National Stadium",
  "imageUrl": "https://example.com/sport.jpg",
  "active": true
}
```

**Response** (200): Created event object

---

#### DELETE /api/events/{id}
Delete event (ADMIN only)

**Response** (204): No content

---

### 5. Cinema Endpoints (`/api/cinemas`)

#### GET /api/cinemas
Get all active cinemas (public)

**Response** (200):
```json
[
  {
    "id": 1,
    "name": "Galaxy Cinema Hanoi",
    "address": "123 Tran Hung Dao St, Hanoi",
    "city": "Hanoi",
    "phone": "0243456789",
    "active": true,
    "rooms": []
  }
]
```

---

#### GET /api/cinemas/{id}
Get cinema details (public)

**Response** (200): Cinema object with rooms

---

#### POST /api/cinemas
Create cinema (ADMIN only)

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

**Response** (200): Created cinema

---

#### DELETE /api/cinemas/{id}
Delete cinema (ADMIN only)

**Response** (204): No content

---

### 6. Room Endpoints (`/api/cinemas/{cinemaId}/rooms`)

#### GET /api/cinemas/{cinemaId}/rooms
Get rooms in cinema (public)

**Response** (200):
```json
[
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
```

---

#### GET /api/cinemas/{cinemaId}/rooms/{roomId}
Get room details (public)

**Response** (200): Room object

---

#### POST /api/cinemas/{cinemaId}/rooms
Create room (ADMIN only)

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

**Response** (200): Created room

---

#### DELETE /api/cinemas/{cinemaId}/rooms/{roomId}
Delete room (ADMIN only)

**Response** (204): No content

---

### 7. Showtime Endpoints (`/api/showtimes`)

#### GET /api/showtimes/movie/{movieId}
Get showtimes for a movie (public)

**Response** (200):
```json
[
  {
    "id": 1,
    "roomId": 1,
    "movieId": 5,
    "eventId": null,
    "startTime": "2024-02-15T19:00:00",
    "endTime": "2024-02-15T21:30:00",
    "basePrice": "150000.00",
    "status": "SCHEDULED",
    "createdAt": "2024-01-10T10:00:00"
  }
]
```

**Status**: SCHEDULED, ONGOING, FINISHED, CANCELLED

---

#### GET /api/showtimes/{id}
Get showtime details (public)

**Response** (200): Showtime object

---

#### GET /api/showtimes/{id}/seats
Get seat map for showtime (public)

**Response** (200):
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
  }
]
```

**Seat Status**: AVAILABLE, HELD (reserved), BOOKED (sold)

---

#### POST /api/showtimes
Create showtime (ADMIN or STAFF)

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

**Response** (200): Created showtime

---

### 8. Order Endpoints (`/api/orders`)

#### POST /api/orders
Create order (authenticated users)

**Request Body**:
```json
{
  "userId": 1,
  "showtimeId": 5,
  "seatIds": [10, 11, 12],
  "voucherCode": "SUMMER2024"
}
```

**Response** (200):
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
      "qrCodeData": "...",
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

**Order Status**: PENDING, PAID, CANCELLED, REFUNDED

---

#### POST /api/orders/{id}/pay
Process payment for order (authenticated)

**Request Body**:
```json
{
  "paymentMethod": "CREDIT_CARD",
  "transactionId": "TXN-123456789"
}
```

**Response** (200): Updated order with PAID status

**Supported Payment Methods**:
- CREDIT_CARD
- DEBIT_CARD
- BANK_TRANSFER
- WALLET
- (Payment gateway integration can be expanded)

---

#### POST /api/orders/{id}/refund
Refund completed order (authenticated)

**Request Body**:
```json
{
  "reason": "Customer requested cancellation"
}
```

**Response** (200): Updated order with REFUNDED status

---

### 9. Ticket Endpoints (`/api/tickets`)

#### POST /api/tickets/check-in
Check in ticket at venue (STAFF or ADMIN)

**Request Body**:
```json
{
  "ticketCode": "CINEMA-2024-0001"
}
```

**Response** (200):
```json
{
  "id": 1,
  "showtimeSeatId": 10,
  "ticketCode": "CINEMA-2024-0001",
  "qrCodeData": "...",
  "price": "150000.00",
  "status": "USED",
  "checkedInAt": "2024-02-15T19:05:00",
  "createdAt": "2024-01-15T15:30:00"
}
```

**Ticket Status**: VALID, USED (checked in), CANCELLED

---

### 10. Voucher Endpoints (`/api/vouchers`)

#### GET /api/vouchers
Get all vouchers (ADMIN only)

**Response** (200):
```json
[
  {
    "id": 1,
    "code": "SUMMER2024",
    "discountType": "PERCENTAGE",
    "discountValue": "10.00",
    "maxDiscountAmount": "100000.00",
    "usageLimit": 100,
    "usedCount": 23,
    "validFrom": "2024-06-01T00:00:00",
    "validUntil": "2024-08-31T23:59:59",
    "active": true
  }
]
```

---

#### POST /api/vouchers
Create voucher (ADMIN only)

**Request Body**:
```json
{
  "code": "NEWYEAR2025",
  "discountType": "FIXED_AMOUNT",
  "discountValue": "50000.00",
  "maxDiscountAmount": null,
  "usageLimit": 500,
  "usedCount": 0,
  "validFrom": "2025-01-01T00:00:00",
  "validUntil": "2025-01-31T23:59:59",
  "active": true
}
```

**Response** (200): Created voucher

**Discount Types**:
- PERCENTAGE: Apply percentage discount (value is percentage, e.g., 10 = 10%)
- FIXED_AMOUNT: Apply fixed amount discount (value is amount in currency units)

---

#### GET /api/vouchers/validate/{code}
Validate voucher code (public)

**Response** (200): Voucher object if valid

**Response** (404): Not found if invalid or inactive

---

## Data Models

### User Entity
```java
@Entity
@Table(name = "users")
public class User {
    Long id;
    String email;              // Unique
    String passwordHash;
    String fullName;
    String phone;
    LocalDate dateOfBirth;
    String gender;
    boolean active;
    Set<Role> roles;           // ManyToMany
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
```

**Database**: `users` table  
**Repository**: [UserRepository.java](backend/src/main/java/com/uit/cinema/iam/repository/UserRepository.java)

---

### Role Entity
```java
@Entity
@Table(name = "roles")
public class Role {
    Long id;
    RoleName name;             // ROLE_CUSTOMER, ROLE_STAFF, ROLE_ADMIN
}
```

**Database**: `roles` table  
**Repository**: [RoleRepository.java](backend/src/main/java/com/uit/cinema/iam/repository/RoleRepository.java)

---

### Movie Entity
```java
@Entity
@Table(name = "movies")
public class Movie {
    Long id;
    String title;
    String description;
    Integer durationMinutes;
    LocalDate releaseDate;
    String ageRating;          // e.g., "PG-13", "R", "G"
    String posterUrl;
    String trailerUrl;
    String language;
    boolean active;
    Set<Genre> genres;         // ManyToMany
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
```

**Database**: `movies` table  
**Repository**: [MovieRepository.java](backend/src/main/java/com/uit/cinema/catalog/repository/MovieRepository.java)

---

### Event Entity
```java
@Entity
@Table(name = "events")
public class Event {
    Long id;
    String name;
    String description;
    LocalDateTime startTime;
    LocalDateTime endTime;
    String venue;
    String imageUrl;
    boolean active;
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
```

**Database**: `events` table  
**Repository**: [EventRepository.java](backend/src/main/java/com/uit/cinema/catalog/repository/EventRepository.java)

---

### Cinema Entity
```java
@Entity
@Table(name = "cinemas")
public class Cinema {
    Long id;
    String name;
    String address;
    String city;
    String phone;
    boolean active;
    List<Room> rooms;          // OneToMany
}
```

**Database**: `cinemas` table  
**Repository**: [CinemaRepository.java](backend/src/main/java/com/uit/cinema/facility/repository/CinemaRepository.java)

---

### Room Entity
```java
@Entity
@Table(name = "rooms")
public class Room {
    Long id;
    Cinema cinema;             // ManyToOne
    String name;               // e.g., "Hall A"
    String type;               // e.g., "2D", "3D", "IMAX"
    Integer totalSeats;
    Integer rows;
    Integer columns;
    boolean active;
}
```

**Database**: `rooms` table  
**Repository**: [RoomRepository.java](backend/src/main/java/com/uit/cinema/facility/repository/RoomRepository.java)

---

### Showtime Entity
```java
@Entity
@Table(name = "showtimes")
public class Showtime {
    Long id;
    Long roomId;
    Long movieId;
    Long eventId;              // Can be null for movies
    LocalDateTime startTime;
    LocalDateTime endTime;
    BigDecimal basePrice;
    Status status;             // SCHEDULED, ONGOING, FINISHED, CANCELLED
    LocalDateTime createdAt;
}
```

**Database**: `showtimes` table  
**Repository**: [ShowtimeRepository.java](backend/src/main/java/com/uit/cinema/showtime/repository/ShowtimeRepository.java)

---

### ShowtimeSeat Entity
```java
@Entity
@Table(name = "showtime_seats",
       uniqueConstraints = @UniqueConstraint(columnNames = {"showtime_id", "seat_template_id"}))
public class ShowtimeSeat {
    Long id;
    Long showtimeId;
    Long seatTemplateId;
    BigDecimal price;
    SeatStatus status;         // AVAILABLE, HELD, BOOKED
}
```

**Database**: `showtime_seats` table (one per showtime per seat)  
**Repository**: [ShowtimeSeatRepository.java](backend/src/main/java/com/uit/cinema/showtime/repository/ShowtimeSeatRepository.java)

---

### Order Entity
```java
@Entity
@Table(name = "orders")
public class Order {
    Long id;
    Long userId;
    Long voucherId;            // Nullable
    BigDecimal totalAmount;
    BigDecimal discountAmount;
    BigDecimal finalAmount;
    OrderStatus status;        // PENDING, PAID, CANCELLED, REFUNDED
    String paymentMethod;
    String paymentTransactionId;
    List<Ticket> tickets;      // OneToMany
    LocalDateTime createdAt;
    LocalDateTime updatedAt;
}
```

**Database**: `orders` table  
**Repository**: [OrderRepository.java](backend/src/main/java/com/uit/cinema/booking/repository/OrderRepository.java)

---

### Ticket Entity
```java
@Entity
@Table(name = "tickets")
public class Ticket {
    Long id;
    Order order;               // ManyToOne
    Long showtimeSeatId;
    String ticketCode;         // Unique, human-readable
    String qrCodeData;         // QR code for check-in
    BigDecimal price;
    TicketStatus status;       // VALID, USED, CANCELLED
    LocalDateTime checkedInAt;
    LocalDateTime createdAt;
}
```

**Database**: `tickets` table  
**Repository**: [TicketRepository.java](backend/src/main/java/com/uit/cinema/booking/repository/TicketRepository.java)

---

### Voucher Entity
```java
@Entity
@Table(name = "vouchers")
public class Voucher {
    Long id;
    String code;               // Unique, e.g., "SUMMER2024"
    DiscountType discountType; // PERCENTAGE, FIXED_AMOUNT
    BigDecimal discountValue;
    BigDecimal maxDiscountAmount;
    Integer usageLimit;
    Integer usedCount;
    LocalDateTime validFrom;
    LocalDateTime validUntil;
    boolean active;
}
```

**Database**: `vouchers` table  
**Repository**: [VoucherRepository.java](backend/src/main/java/com/uit/cinema/booking/repository/VoucherRepository.java)

---

## Service Layer

### Core Services

#### AuthService
**Interface**: [AuthService.java](backend/src/main/java/com/uit/cinema/iam/service/AuthService.java)  
**Implementation**: [AuthServiceImpl.java](backend/src/main/java/com/uit/cinema/iam/service/AuthServiceImpl.java)

Methods:
- `User register(String email, String password, String fullName, String phone)` - Register new user
- `String login(String email, String password)` - Authenticate and return JWT token

---

#### MovieService
**Interface**: [MovieService.java](backend/src/main/java/com/uit/cinema/catalog/service/MovieService.java)  
**Implementation**: [MovieServiceImpl.java](backend/src/main/java/com/uit/cinema/catalog/service/MovieServiceImpl.java)

Methods:
- `List<Movie> getAllActiveMovies()` - Get all active movies
- `Movie getMovieById(Long id)` - Get single movie
- `Movie createMovie(Movie movie)` - Create movie (ADMIN)
- `Movie updateMovie(Long id, Movie updated)` - Update movie (ADMIN)
- `void deleteMovie(Long id)` - Soft-delete movie (ADMIN)

---

#### EventService
**Interface**: [EventService.java](backend/src/main/java/com/uit/cinema/catalog/service/EventService.java)  
**Implementation**: [EventServiceImpl.java](backend/src/main/java/com/uit/cinema/catalog/service/EventServiceImpl.java)

Methods:
- `List<Event> getUpcomingEvents()` - Get future events only
- `Event getEventById(Long id)` - Get event details
- `Event createEvent(Event event)` - Create event (ADMIN)
- `void deleteEvent(Long id)` - Delete event (ADMIN)

---

#### CinemaService
**Interface**: [CinemaService.java](backend/src/main/java/com/uit/cinema/facility/service/CinemaService.java)  
**Implementation**: [CinemaServiceImpl.java](backend/src/main/java/com/uit/cinema/facility/service/CinemaServiceImpl.java)

Methods:
- `List<Cinema> getAllActiveCinemas()` - Get all active cinemas
- `Cinema getCinemaById(Long id)` - Get cinema with rooms
- `Cinema createCinema(Cinema cinema)` - Create cinema (ADMIN)
- `void deleteCinema(Long id)` - Soft-delete cinema (ADMIN)

---

#### RoomService
**Interface**: [RoomService.java](backend/src/main/java/com/uit/cinema/facility/service/RoomService.java)  
**Implementation**: [RoomServiceImpl.java](backend/src/main/java/com/uit/cinema/facility/service/RoomServiceImpl.java)

Methods:
- `List<Room> getRoomsByCinema(Long cinemaId)` - Get rooms in cinema
- `Room getRoomById(Long id)` - Get room details
- `Room createRoom(Room room)` - Create room (ADMIN)
- `void deleteRoom(Long id)` - Delete room (ADMIN)

---

#### ShowtimeService
**Interface**: [ShowtimeService.java](backend/src/main/java/com/uit/cinema/showtime/service/ShowtimeService.java)  
**Implementation**: [ShowtimeServiceImpl.java](backend/src/main/java/com/uit/cinema/showtime/service/ShowtimeServiceImpl.java)

Methods:
- `List<Showtime> getShowtimesByMovie(Long movieId)` - Get all showtimes for a movie
- `Showtime getShowtimeById(Long id)` - Get showtime details
- `List<ShowtimeSeat> getSeatMap(Long showtimeId)` - Get seat availability
- `Showtime createShowtime(Showtime showtime)` - Create showtime (ADMIN/STAFF)

---

#### OrderService
**Interface**: [OrderService.java](backend/src/main/java/com/uit/cinema/booking/service/OrderService.java)  
**Implementation**: [OrderServiceImpl.java](backend/src/main/java/com/uit/cinema/booking/service/OrderServiceImpl.java)

Methods:
- `Order createOrder(Long userId, Long showtimeId, List<Long> seatIds, String voucherCode)` - Create order with tickets
  - Validates seat availability
  - Applies voucher discount
  - Generates tickets with QR codes
  - **Important**: Uses @Transactional for data integrity

**Key Business Logic**:
- Voucher validation (active, expiration, usage limits)
- Discount calculation (percentage vs. fixed amount)
- Automatic ticket generation
- Seat confirmation

---

#### PaymentService
**Interface**: [PaymentService.java](backend/src/main/java/com/uit/cinema/booking/service/PaymentService.java)  
**Implementation**: [PaymentServiceImpl.java](backend/src/main/java/com/uit/cinema/booking/service/PaymentServiceImpl.java)

Methods:
- `Order processPayment(Long orderId, String paymentMethod, String transactionId)` - Process payment and mark order as PAID
- `Order refund(Long orderId, String reason)` - Refund completed order

**Supported Payment Methods**:
- CREDIT_CARD
- DEBIT_CARD
- BANK_TRANSFER
- WALLET

---

#### TicketGenerationService
**Interface**: [TicketGenerationService.java](backend/src/main/java/com/uit/cinema/booking/service/TicketGenerationService.java)  
**Implementation**: [TicketGenerationServiceImpl.java](backend/src/main/java/com/uit/cinema/booking/service/TicketGenerationServiceImpl.java)

Methods:
- `void generateTicket(Ticket ticket)` - Generate unique ticket code and QR data
- `Ticket checkIn(String ticketCode)` - Validate and check in ticket at venue

**Ticket Code Format**: `CINEMA-{YYYY}-{SEQUENCE}` (e.g., `CINEMA-2024-0001`)

---

#### SeatReservationService
**Interface**: [SeatReservationService.java](backend/src/main/java/com/uit/cinema/showtime/service/SeatReservationService.java)  
**Implementation**: [SeatReservationServiceImpl.java](backend/src/main/java/com/uit/cinema/showtime/service/SeatReservationServiceImpl.java)

Methods:
- `SeatBookingResult validateHeldSeats(SeatBookingRequest request)` - Validate seat availability and hold
- `void confirmHeldSeats(SeatBookingRequest request)` - Confirm held seats to BOOKED

**Seat Locking Strategy**:
- Uses Redis for time-limited seat locks
- Prevents double-booking
- Automatic release on expiration

---

#### SeatLockingService
**Interface**: [SeatLockingService.java](backend/src/main/java/com/uit/cinema/showtime/service/SeatLockingService.java)  
**Implementation**: [SeatLockingServiceImpl.java](backend/src/main/java/com/uit/cinema/showtime/service/SeatLockingServiceImpl.java)

Methods:
- `boolean lockSeats(Long userId, List<Long> seatIds, Duration lockDuration)` - Acquire seat lock
- `void releaseSeats(Long userId, List<Long> seatIds)` - Release lock
- `Set<Long> getLockedSeats(Long showtimeId)` - Get currently locked seats

**Purpose**: Prevent race conditions during concurrent bookings using Redis TTL

---

## Error Handling

### Custom Exception

**Location**: [CustomException.java](backend/src/main/java/com/uit/cinema/core/exception/CustomException.java)

```java
public class CustomException extends RuntimeException {
    private final HttpStatus status;
    private final String errorCode;
    
    // Constructor: new CustomException(message, status, errorCode)
}
```

---

### Global Exception Handler

**Location**: [GlobalExceptionHandler.java](backend/src/main/java/com/uit/cinema/core/exception/GlobalExceptionHandler.java)

Handles:
1. `CustomException` → Returns status and error code
2. `MethodArgumentNotValidException` → Validation errors with field details
3. `BadCredentialsException` → 401 Invalid credentials
4. `AccessDeniedException` → 403 Access denied
5. `Exception` → Generic 500 Internal Server Error

### Response Format

**Error Response** (all 4xx/5xx):
```json
{
  "timestamp": "2024-01-15T15:30:00",
  "status": 400,
  "errorCode": "INVALID_VOUCHER",
  "message": "Mã giảm giá không hợp lệ"
}
```

### Common Error Codes

| Error Code | Status | Meaning |
|-----------|--------|---------|
| EMAIL_TAKEN | 409 | Email already registered |
| INVALID_CREDENTIALS | 401 | Wrong email/password |
| INVALID_VOUCHER | 400 | Voucher code invalid/inactive |
| VOUCHER_EXPIRED | 400 | Voucher past valid date |
| VOUCHER_EXHAUSTED | 400 | Voucher usage limit reached |
| ORDER_NOT_FOUND | 404 | Order doesn't exist |
| INVALID_ORDER_STATUS | 400 | Order cannot transition to requested status |
| ACCESS_DENIED | 403 | Insufficient permissions |
| VALIDATION_FAILED | 400 | Input validation failed |
| INTERNAL_ERROR | 500 | Unexpected server error |

---

## Database Configuration

### PostgreSQL Connection

**Location**: [application.yml](backend/src/main/resources/application.yml)

```yaml
datasource:
  url: jdbc:postgresql://localhost:5432/cinema_db
  username: postgres
  password: 123
  driver-class-name: org.postgresql.Driver

jpa:
  hibernate:
    ddl-auto: update                    # Auto-create/update schema
  show-sql: true                        # Log SQL queries
  properties:
    hibernate:
      dialect: org.hibernate.dialect.PostgreSQLDialect
      format_sql: true
```

### Database Initialization

Tables are automatically created by Hibernate with `ddl-auto: update`

**Core Tables**:
- `users` - User accounts
- `roles` - User roles (CUSTOMER, STAFF, ADMIN)
- `user_roles` - User-role association
- `movies` - Movie catalog
- `genres` - Movie genres
- `movie_genres` - Movie-genre association
- `events` - Event catalog
- `cinemas` - Cinema locations
- `rooms` - Screening rooms
- `showtimes` - Movie/event showtimes
- `showtime_seats` - Seat availability per showtime
- `seat_templates` - Seat layout template
- `orders` - Booking orders
- `tickets` - Generated tickets
- `vouchers` - Discount vouchers

### Redis Configuration

**Location**: [application.yml](backend/src/main/resources/application.yml)

```yaml
data:
  redis:
    host: localhost
    port: 6379
    timeout: 60000ms
```

**Usage**:
- Seat lock management (temporary locks during booking)
- Session caching (if needed)
- Rate limiting (can be added)

---

## Frontend Integration Guide

### Headers
All requests except `/api/auth/**`, `/api/movies/**`, `/api/events/**`, `/api/showtimes/**` require:
```
Authorization: Bearer <accessToken>
Content-Type: application/json
```

### Request/Response Flow

#### 1. User Registration & Login
```
POST /api/auth/register → User registered
POST /api/auth/login → Get accessToken
(Store token in localStorage)
```

#### 2. Browse Catalog (No login needed)
```
GET /api/movies → Movie list
GET /api/movies/{id} → Movie details
GET /api/events → Event list
GET /api/cinemas → Cinema list
GET /api/showtimes/movie/{movieId} → Showtimes
GET /api/showtimes/{id}/seats → Seat availability
```

#### 3. Booking Flow (Authenticated)
```
POST /api/orders → Create order
(Specify seatIds, voucherCode)
↓
GET /api/orders/{id} → Order details & tickets
↓
POST /api/orders/{id}/pay → Process payment
↓
Receive tickets with ticketCode & QR data
```

#### 4. Ticket Management (Authenticated)
```
POST /api/tickets/check-in → Check in at venue (STAFF/ADMIN)
(Provide ticketCode)
```

#### 5. Admin Functions
```
POST /api/movies → Create movie
PUT /api/movies/{id} → Update movie
DELETE /api/movies/{id} → Delete movie

POST /api/showtimes → Create showtime
POST /api/cinemas → Create cinema
POST /api/vouchers → Create voucher
```

### Token Expiration Handling
- Access Token: 1 day
- If 401 Unauthorized: User must re-login
- Frontend should clear token and redirect to login

### Pagination (Future Enhancement)
Currently no pagination implemented. Consider adding:
```
GET /api/movies?page=0&size=10
```

---

## API Testing

### Using cURL

#### Register
```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!",
    "fullName": "Test User",
    "phone": "0901234567"
  }'
```

#### Login
```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "Test123!"
  }'
```

#### Authenticated Request
```bash
curl -X GET http://localhost:8080/api/users/1 \
  -H "Authorization: Bearer <accessToken>"
```

### Using Postman

1. Import all endpoints as POST/GET/PUT/DELETE requests
2. In Authorization tab, select "Bearer Token" and paste token
3. Set Body to raw JSON format
4. Test endpoints in order: Auth → Browse → Book → Check-in

---

## Performance Considerations

1. **Seat Locking**: Uses Redis TTL to prevent expired locks
2. **Pagination**: Should be added for large datasets (movies, orders)
3. **Caching**: Implement for frequently accessed data (movies, showtimes)
4. **Database Indexes**: Add on foreign keys and frequently queried fields
5. **N+1 Query Problem**: Use eager loading with `@ManyToMany(fetch = FetchType.LAZY)` carefully
6. **Transaction Boundaries**: Critical for order/payment operations

---

## Security Best Practices

1. **JWT Secret**: Change `app.jwt.secret` to a secure 256-bit Base64 key
2. **Password Storage**: Passwords hashed with BCrypt, never stored plain
3. **CORS**: Enable as needed for frontend domain
4. **HTTPS**: Use in production (add SSL configuration)
5. **Input Validation**: All endpoints validate input with Spring Validation
6. **SQL Injection**: JPA parameterized queries prevent SQL injection
7. **CSRF**: Disabled for stateless JWT auth (correct for SPA)

---

## Summary for Frontend Developers

### Key Endpoints to Integrate
1. **Auth**: `/api/auth/register`, `/api/auth/login`
2. **Browse**: `/api/movies`, `/api/events`, `/api/showtimes/movie/{id}`, `/api/showtimes/{id}/seats`
3. **Book**: `POST /api/orders`
4. **Pay**: `POST /api/orders/{id}/pay`
5. **Tickets**: `GET /api/orders/{id}` (contains ticket details with QR codes)
6. **Admin**: Manage movies, cinemas, vouchers, validate showtimes

### Data to Display
- Movie: title, poster, duration, age rating, genres, showtimes
- Showtime: start time, room, available seats with prices
- Order: order ID, total, discount, final amount, ticket list
- Ticket: ticket code, QR code (for display or scanning)

### Authentication Flow
1. User registers/logs in → Store JWT token
2. Include token in Authorization header for all protected requests
3. On 401 error → Clear token and redirect to login
4. Token valid for 24 hours

