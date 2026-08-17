# Hướng Dẫn Sử Dụng Keycloak & Identity Service (Dành Cho Teammate)

Tài liệu này giải thích lý do hệ thống của chúng ta chuyển sang sử dụng Keycloak kết hợp với Identity Service, cách hoạt động của luồng xác thực (Authentication Flow) và hướng dẫn cấu hình chi tiết cho các service (đặc biệt là Spring Boot).

## 1. Lý do sử dụng Keycloak + Identity Service để Mapping User ID

### Tại sao lại dùng Keycloak?
Trước đây, hệ thống Monolith tự xử lý JWT, lưu mật khẩu và quản lý user (module `iam`). Tuy nhiên, khi chuyển sang Microservices, việc mỗi service tự handle auth hoặc có một service tự build auth riêng sẽ tiềm ẩn rủi ro bảo mật và khó scale.
- **Keycloak là một giải pháp IAM (Identity and Access Management) tập trung:** Nó đảm nhận toàn bộ việc quản lý user, credentials (mật khẩu), roles, session, và token (OIDC/JWT). 
- **Bảo mật hơn:** Chúng ta không cần lưu trữ mật khẩu trong database của hệ thống nữa. Keycloak tự lo việc băm mật khẩu, chống brute-force, quản lý reset password, email verification.
- **Chuẩn hóa:** Sử dụng chuẩn OIDC (OpenID Connect) và RS256 để sign JWT.

### Tại sao cần Identity Service để mapping User ID?
- **Vấn đề lệch kiểu dữ liệu (Data Type Mismatch):** Hệ thống cũ sử dụng `Long` (auto-increment) làm User ID (ví dụ: `Order.userId`, `Payment.userId`). Tuy nhiên, Keycloak sử dụng `UUID` (chuỗi) cho định danh user (`sub` claim trong JWT).
- **Tránh sửa đổi diện rộng (Backward Compatibility):** Nếu dùng trực tiếp UUID của Keycloak, chúng ta sẽ phải migrate toàn bộ database của các service (Booking, Payment, v.v.) từ `Long` sang `UUID`, tốn rất nhiều công sức và dễ gây lỗi.
- **Giải pháp - Identity Service:** Identity Service (hay User Profile Service) đóng vai trò là "cầu nối". Nó lưu một bảng mapping giữa `id` (Long, dùng nội bộ) và `keycloak_id` (UUID của Keycloak). Các service backend khác sẽ chỉ biết và sử dụng `Long` ID như cũ.

---

## 2. Luồng hoạt động (Flow) của Identity Service + Keycloak

Luồng đăng ký và xác thực diễn ra như sau:

### Flow Đăng ký (Registration Flow)
1. User đăng ký tài khoản trên giao diện UI do **Keycloak** cung cấp.
2. Sau khi user được tạo thành công trong Keycloak, một plugin của Keycloak (Keycloak Event Listener SPI) sẽ tự động bắn một sự kiện (event) `user.registered` vào **RabbitMQ**.
3. **Identity Service** đang lắng nghe (consume) RabbitMQ sẽ nhận được event này.
4. Identity Service tạo một record mới trong database nội bộ (ví dụ bảng `users`), lưu thông tin cơ bản và tạo ra một `id` (Long) mới, map với `keycloak_id` nhận được từ event.

### Flow Xác thực (Authentication Flow)
1. User login qua Keycloak, Keycloak trả về JWT Access Token.
2. Frontend gắn JWT vào Header `Authorization: Bearer <token>` và gọi API.
3. **API Gateway (YARP)** nhận request:
   - Gateway xác thực chữ ký của JWT bằng Public Key của Keycloak (JWKS endpoint).
   - Gateway lấy UUID từ JWT, sau đó gọi (hoặc lấy từ cache) API của Identity Service (`/internal/users/resolve?keycloakId={uuid}`) để lấy `Long` User ID tương ứng.
4. Gateway chặn JWT gốc, **KHÔNG** gửi JWT xuống các service bên dưới (Spring Boot), mà chuyển đổi thành các **HTTP Headers**:
   - `X-User-Id`: (Long ID - dùng để query DB)
   - `X-Keycloak-Id`: (UUID)
   - `X-User-Email`: (Email)
   - `X-User-Roles`: (Danh sách quyền, vd: ADMIN, CUSTOMER)
5. Request đi đến các service Spring Boot.

---

## 3. Cách xử lý Auth cho các Service Spring Boot

Theo thiết kế kiến trúc, API Gateway đã làm nhiệm vụ validate Token. Do đó, các service Spring Boot (Booking, Catalog, Showtime...) **không cần** kết nối trực tiếp đến Keycloak để validate JWT nữa.

Thay vào đó, các service Spring Boot chỉ cần đọc thông tin từ các HTTP Headers do Gateway truyền xuống.

### Hướng dẫn cài đặt trong Spring Boot:
Bạn cần viết một Spring Security Filter (hoặc Interceptor) để đọc các Header này và tạo `Authentication` object (ví dụ `UsernamePasswordAuthenticationToken`) lưu vào `SecurityContextHolder`.

**Ví dụ cấu hình Security Filter:**
```java
@Component
public class GatewayHeaderAuthFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        
        String userIdStr = request.getHeader("X-User-Id");
        String rolesStr = request.getHeader("X-User-Roles"); // Vd: "CUSTOMER,ADMIN"

        if (userIdStr != null && !userIdStr.isEmpty()) {
            Long userId = Long.parseLong(userIdStr);
            
            // Parse roles
            List<GrantedAuthority> authorities = new ArrayList<>();
            if (rolesStr != null && !rolesStr.isEmpty()) {
                String[] roles = rolesStr.split(",");
                for (String role : roles) {
                    authorities.add(new SimpleGrantedAuthority("ROLE_" + role.trim()));
                }
            }

            // Tạo đối tượng Authentication
            UsernamePasswordAuthenticationToken authentication = 
                new UsernamePasswordAuthenticationToken(userId, null, authorities);
            
            SecurityContextHolder.getContext().setAuthentication(authentication);
        }

        filterChain.doFilter(request, response);
    }
}
```

**Sử dụng phân quyền bằng Annotation:**
Bạn có thể tiếp tục dùng `@PreAuthorize` như cũ vì SecurityContext đã có thông tin quyền:
```java
@RestController
@RequestMapping("/api/showtimes")
public class ShowtimeController {

    // Chỉ ADMIN mới được tạo showtime
    @PreAuthorize("hasRole('ADMIN')")
    @PostMapping
    public ResponseEntity<?> createShowtime(...) { ... }

    // Ai cũng xem được
    @GetMapping
    public ResponseEntity<?> getShowtimes(...) { ... }
}
```
**Lưu ý:** Đừng quên cấu hình để chặn các truy cập trực tiếp vào service bỏ qua Gateway (sử dụng internal API key hoặc network firewall).

---

## 4. Setup Keycloak (Realm, Client, Connection)

Để hệ thống hoạt động, chúng ta cần cấu hình Keycloak như sau:

### 4.1. Khởi tạo Realm
- **Realm Name:** `cinema-booking`
- **Login Theme:** Có thể custom lại UI login để giống với app của chúng ta.
- **Registration:** Bật (Enabled) để user tự đăng ký.
- **Email verification:** Required.
- **Brute force protection:** Bật (ví dụ: khóa 30s sau 5 lần nhập sai).

### 4.2. Khởi tạo Roles (Realm Roles)
- `CUSTOMER`: Đặt làm Default Role (Tự động gán cho user mới đăng ký).
- `ADMIN`: Quyền quản trị hệ thống (Gán tay qua Admin Console).
- `STAFF`: Nhân viên rạp (Gán tay qua Admin Console).

### 4.3. Khởi tạo Clients
Cần tạo các Client sau trong realm `cinema-booking`:

1. **Client Frontend (React/Web)**
   - **Client ID:** `cinema-frontend`
   - **Client Type:** Public (Sử dụng Authorization Code Flow với PKCE).
   - **Valid Redirect URIs:** URL của Frontend App (vd: `http://localhost:3000/*`).
   - **Web Origins:** URL của Frontend App (để xử lý CORS).

2. **Client API Gateway (YARP)**
   - **Client ID:** `cinema-api-gateway`
   - **Client Type:** Confidential (Cần Client Secret).
   - **Mục đích:** Để Gateway có thể validate token, cấu hình xác thực nội bộ.

3. **Client Admin Service**
   - **Client ID:** `cinema-admin`
   - **Client Type:** Confidential (Bật Service Accounts Enabled).
   - **Mục đích:** Để các service backend (nếu cần) gọi Keycloak Admin REST API (ví dụ để lấy danh sách user, force logout...). Cần cấp quyền `realm-management` cho client này.

### 4.4. Cấu hình Keycloak Event SPI (RabbitMQ)
Cần cài đặt một plugin (file `.jar`) vào Keycloak để bắn event.
- Copy file jar (ví dụ `keycloak-rabbitmq-event-listener.jar`) vào thư mục `providers/` của Keycloak.
- Cấu hình các biến môi trường cho Keycloak container:
  ```env
  KC_SPI_EVENTS_LISTENER_RABBITMQ_AMQP_URI=amqp://guest:guest@rabbitmq:5672
  KC_SPI_EVENTS_LISTENER_RABBITMQ_EXCHANGE=user.events
  ```
- Vào Admin Console -> Events -> Config -> Thêm `rabbitmq` vào phần Event Listeners.

Với cấu hình này, Keycloak đã sẵn sàng phục vụ toàn bộ nhu cầu xác thực của Cinema Booking System!
