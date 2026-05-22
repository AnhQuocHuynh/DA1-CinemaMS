# UseCase.md

## 1. Mục đích
Tài liệu này được viết để AI agent đọc và hiểu **logic backend cần xây dựng** cho hệ thống quản lý đặt vé phim/sự kiện trực tuyến. Trọng tâm là:
- hiểu đúng **actor**, **pre-condition**, **post-condition**
- tách đúng **service**, **repository**, **transaction**, **Redis lock**
- xử lý đúng các **business rules**, **exception flows**, **state transitions**
- tránh vibe code kiểu “đoán đại”, nhất là ở luồng đặt vé đồng thời

Hệ thống trong đề cương là một **modular monolith** với backend Spring Boot, PostgreSQL, Redis, JWT, và luồng nghiệp vụ trung tâm là đặt vé. Đề cương liệt kê 27 use case từ đăng ký đến đăng xuất, bao gồm cả nhóm khách hàng, nhân viên và admin. fileciteturn1file12 fileciteturn1file15

---

## 2. Bối cảnh hệ thống

### 2.1. Mục tiêu nghiệp vụ
- Quản lý phim/sự kiện
- Tra cứu, chọn suất chiếu, chọn ghế
- Giữ ghế tạm thời để tránh double booking
- Thanh toán và phát hành vé QR
- Check-in, in vé, hoàn tiền
- Quản trị danh mục, sơ đồ ghế, giá vé, voucher, báo cáo, phân quyền

### 2.2. Kiến trúc cần phản ánh trong backend
- **Controller**: nhận request, validate đầu vào, trả response
- **Service**: chứa business logic
- **Repository**: truy vấn DB
- **Database**: PostgreSQL
- **Redis**: giữ ghế tạm thời, caching, locking
- **JWT**: xác thực và phân quyền

Kiến trúc và luồng chính trong đề cương nhấn mạnh mô hình này, đặc biệt ở luồng đặt vé, Redis lock ghế, transaction và phân quyền theo role. fileciteturn1file1 fileciteturn1file16

---

## 3. Nguyên tắc đọc tài liệu này cho AI agent

Khi đọc một use case, agent phải tự trả lời 5 câu:
1. **Ai** gọi?
2. **Khi nào** được gọi?
3. **Service nào** phải chạy?
4. **Dữ liệu nào** bị đọc/ghi?
5. **Trạng thái nào** được đổi?

Nếu chưa rõ, ưu tiên dùng quy tắc:
- đọc dữ liệu từ DB trước khi ghi
- thao tác giữ ghế phải đi qua Redis trước khi tạo booking
- mọi thay đổi trạng thái quan trọng phải nằm trong transaction
- mọi API nhạy cảm phải có JWT + role guard

---

## 4. Quy ước trạng thái chung

### 4.1. User
- `PENDING` / `ACTIVE` / `LOCKED`

### 4.2. Seat
- `EMPTY`
- `HELD`
- `SOLD`

### 4.3. Ticket
- `VALID`
- `CHECKED_IN`
- `CANCELLED`
- `REFUNDED`

### 4.4. Booking / Order
- `PENDING`
- `PAID`
- `FAILED`
- `CANCELLED`
- `REFUNDED`

### 4.5. Showtime
- `SCHEDULED`
- `STARTED`
- `ENDED`
- `FULL`

---

## 5. Business rules dùng chung

- Email và số điện thoại phải duy nhất
- Mật khẩu phải hash bằng BCrypt, không lưu plaintext
- JWT phải có thời hạn và hỗ trợ cơ chế revoke/blacklist khi cần
- Giữ ghế phải có TTL, hết TTL thì tự nhả ghế
- Một giao dịch không được thanh toán 2 lần
- Chỉ người đã mua vé mới được đánh giá
- Hoàn vé chỉ được khi còn trong giới hạn thời gian cho phép
- Check-in bằng QR chỉ hợp lệ một lần
- Staff chỉ làm nghiệp vụ quầy, Admin mới quản trị hệ thống

Các quy tắc này bám sát yêu cầu trong đề cương về hashing mật khẩu, JWT, Redis TTL, atomicity, phân quyền và hoàn tiền. fileciteturn1file9 fileciteturn1file10 fileciteturn1file1

---

## 6. Ánh xạ use case -> service/backend

### 6.1. Auth service
- UC-01 Đăng ký
- UC-02 Đăng nhập
- UC-03 Khôi phục mật khẩu
- UC-27 Đăng xuất

### 6.2. Catalog/Search service
- UC-04 Tra cứu phim / sự kiện
- UC-05 Chọn suất chiếu & rạp

### 6.3. Booking service
- UC-06 Chọn ghế
- UC-07 Thanh toán hóa đơn
- UC-11 Giữ ghế tạm thời
- UC-13 Áp dụng mã giảm giá
- UC-14 Yêu cầu hoàn tiền

### 6.4. Review/Insight service
- UC-08 Đánh giá & rating
- UC-09 Xem tóm tắt bình luận

### 6.5. Ticket service
- UC-10 Quản lý vé cá nhân
- UC-15 Quét mã QR
- UC-16 In vé
- UC-17 Tra cứu thông tin vé
- UC-12 Nhận thông báo xác nhận

### 6.6. Admin service
- UC-18 Cấu hình sơ đồ ghế
- UC-19 Thiết lập giá vé
- UC-20 Báo cáo & thống kê
- UC-21 Phân quyền người dùng
- UC-22 Quản lý voucher
- UC-23 Quản lý phim
- UC-24 Quản lý sự kiện
- UC-25 Quản lý rạp & địa điểm
- UC-26 Quản lý phòng chiếu

### 6.7. Shared service
- notification
- qr-code
- pdf-ticket
- refund-policy
- seat-layout
- pricing
- audit-log

---

## 7. Danh mục use case chuẩn hóa

> Ghi chú: Những UC có mô tả chi tiết trong đề cương được giữ sát nguyên bản. Các UC còn lại được chuẩn hóa theo tên use case trong mục lục và ngữ cảnh nghiệp vụ của hệ thống. fileciteturn1file8 fileciteturn1file15

---

### UC-01. Đăng ký
**Actor:** Khách hàng

**Mục tiêu:** Tạo tài khoản mới.

**Pre-condition:**
- Chưa đăng nhập
- Đang ở màn đăng ký

**Post-condition:**
- Tạo user mới
- Role mặc định = `USER`
- Có thể gửi email xác nhận

**Main flow:**
1. Nhập họ tên, email, số điện thoại, mật khẩu, xác nhận mật khẩu
2. Hệ thống validate dữ liệu
3. Kiểm tra trùng email / số điện thoại
4. Hash mật khẩu
5. Lưu user vào DB
6. Trả kết quả thành công

**Exception:**
- email/sđt trùng
- mật khẩu yếu
- xác nhận mật khẩu không khớp

**Services gợi ý:**
- `AuthService.register()`
- `UserValidationService`
- `PasswordHasher`
- `EmailVerificationService`

**Data touched:**
- `users`
- `roles`
- `email_verification_tokens` (nếu có)

---

### UC-02. Đăng nhập
**Actor:** Khách hàng, Nhân viên, Quản trị viên

**Mục tiêu:** Xác thực tài khoản và cấp token.

**Pre-condition:**
- user đã có tài khoản hợp lệ

**Post-condition:**
- cấp access token
- có thể cấp refresh token
- điều hướng theo role

**Main flow:**
1. Nhập email + mật khẩu
2. Validate input
3. Tìm user theo email
4. So sánh mật khẩu hash
5. Kiểm tra trạng thái tài khoản
6. Tạo JWT
7. Trả token và role

**Exception:**
- sai thông tin đăng nhập
- tài khoản bị khóa
- vượt quá số lần đăng nhập sai

**Services gợi ý:**
- `AuthService.login()`
- `JwtService`
- `LoginAttemptService`

---

### UC-03. Khôi phục mật khẩu
**Actor:** Khách hàng, Nhân viên, Quản trị viên

**Mục tiêu:** Đặt lại mật khẩu qua email hoặc OTP.

**Pre-condition:**
- email tồn tại
- có quyền nhận mã khôi phục

**Post-condition:**
- mật khẩu mới được lưu
- token khôi phục bị vô hiệu hóa

**Main flow:**
1. Nhập email
2. Tạo reset token có TTL
3. Gửi link khôi phục
4. Người dùng nhập mật khẩu mới
5. Validate token + mật khẩu
6. Lưu mật khẩu mới đã hash

**Services gợi ý:**
- `PasswordResetService`
- `TokenService`
- `MailService`

---

### UC-04. Tra cứu phim / sự kiện
**Actor:** Khách hàng

**Mục tiêu:** Tìm kiếm, lọc, xem danh sách phim/sự kiện.

**Pre-condition:** Có dữ liệu phim/sự kiện

**Post-condition:** Trả danh sách phù hợp, không đổi trạng thái hệ thống

**Main flow:**
1. Nhập từ khóa
2. Chọn bộ lọc
3. Query DB hoặc cache
4. Trả danh sách kết quả

**Rules:**
- hỗ trợ tiếng Việt có dấu và không dấu
- ưu tiên nội dung đang hot / gần lịch chiếu
- mục đã kết thúc quá 24h thì ẩn khỏi danh sách mặc định

**Services gợi ý:**
- `CatalogSearchService`
- `MovieQueryService`
- `EventQueryService`

---

### UC-05. Chọn suất chiếu & rạp
**Actor:** Khách hàng, Nhân viên

**Mục tiêu:** Chọn ngày, rạp, khung giờ.

**Pre-condition:**
- đã chọn nội dung ở UC-04
- admin đã có lịch chiếu

**Post-condition:**
- lưu `showtimeId`, `cinemaId`
- chuyển sang UC-06

**Main flow:**
1. Chọn phim/sự kiện
2. Xem ngày chiếu
3. Chọn rạp
4. Xem khung giờ
5. Chọn suất chiếu
6. Chuyển sang chọn ghế

**Rules:**
- chỉ hiển thị suất chiếu trong tương lai
- suất chiếu hết vé hoặc sắp bắt đầu thì disable

**Services gợi ý:**
- `ShowtimeService`
- `CinemaAvailabilityService`

---

### UC-06. Chọn ghế
**Actor:** Khách hàng, Nhân viên

**Mục tiêu:** Chọn ghế và giữ tạm thời trên Redis.

**Pre-condition:** đã chọn suất chiếu

**Post-condition:** ghế chuyển sang `HELD`, tạo timeout

**Main flow:**
1. Tải seat map
2. Người dùng chọn ghế
3. Backend kiểm tra ghế còn trống
4. Tạo lock Redis với TTL
5. Tính tổng tiền
6. Chuyển sang thanh toán

**Exception:**
- ghế đã bị người khác giữ
- hết thời gian giữ

**Services gợi ý:**
- `SeatLockService`
- `SeatAvailabilityService`
- `BookingQuoteService`

**Rules:**
- thao tác giữ phải nguyên tử
- một giao dịch không vượt quá số ghế cho phép
- TTL phải đồng bộ với countdown UI

---

### UC-07. Thanh toán hóa đơn
**Actor:** Khách hàng online, khách tại quầy

**Mục tiêu:** Xác nhận thanh toán và tạo vé.

**Pre-condition:**
- ghế đang `HELD`
- thông tin đơn hàng hợp lệ

**Post-condition:**
- booking thành `PAID`
- ghế thành `SOLD`
- ticket QR được tạo

**Main flow:**
1. Hiển thị tổng kết đơn hàng
2. Chọn phương thức thanh toán
3. Xác nhận thanh toán
4. Xử lý payment
5. Cập nhật DB
6. Xóa lock Redis
7. Tạo ticket
8. Gửi email/notification

**Rules:**
- idempotent
- không thanh toán 2 lần
- nếu thanh toán tại quầy, staff có thể nhập số điện thoại khách

**Services gợi ý:**
- `PaymentService`
- `BookingService`
- `TicketIssuanceService`
- `NotificationService`

---

### UC-08. Đánh giá & rating
**Actor:** Khách hàng đã mua vé

**Mục tiêu:** Gửi rating và comment.

**Pre-condition:**
- đã mua vé cho nội dung đó
- chưa vi phạm điều kiện đánh giá

**Post-condition:** lưu đánh giá, cập nhật rating trung bình

**Main flow:**
1. Mở trang chi tiết hoặc lịch sử vé
2. Chọn viết đánh giá
3. Nhập sao và bình luận
4. Validate
5. Lưu review
6. Cập nhật thống kê

**Rules:**
- chỉ người đã mua mới được đánh giá
- chống đánh giá trùng
- lọc nội dung thô tục

**Services gợi ý:**
- `ReviewService`
- `RatingAggregateService`

---

### UC-09. Xem tóm tắt bình luận
**Actor:** Khách hàng

**Mục tiêu:** Xem sentiment summary.

**Pre-condition:** có đủ lượng bình luận

**Post-condition:** hiển thị insight cộng đồng

**Main flow:**
1. Mở tab đánh giá
2. Xem sentiment summary
3. Xem từ khóa nổi bật
4. Lọc theo tag

**Services gợi ý:**
- `CommentSummaryService`
- `SentimentAnalysisJob`

---

### UC-10. Quản lý vé cá nhân
**Actor:** Khách hàng

**Mục tiêu:** Xem danh sách vé, QR, lịch sử, trạng thái hoàn tiền.

**Pre-condition:** đã đăng nhập, có vé

**Post-condition:** trả dữ liệu vé theo user

**Main flow:**
1. Mở “Vé của tôi”
2. Danh sách vé theo thời gian
3. Xem chi tiết vé
4. Hiển thị QR
5. Cho phép hoàn vé nếu đủ điều kiện

**Services gợi ý:**
- `MyTicketService`
- `TicketQrService`
- `RefundEligibilityService`

---

### UC-11. Giữ ghế tạm thời
**Actor:** Hệ thống

**Mục tiêu:** Tự động giữ ghế trong thời gian đặt chỗ.

**Pre-condition:** có ghế được chọn

**Post-condition:** lock Redis tồn tại hoặc tự hết hạn

**Main flow:**
1. Tạo key ghế
2. Gán TTL
3. Cập nhật trạng thái giữ
4. Hết TTL thì auto-release

**Services gợi ý:**
- `SeatHoldScheduler`
- `RedisLockService`

---

### UC-12. Nhận thông báo xác nhận
**Actor:** Khách hàng

**Mục tiêu:** Nhận email/push khi đặt vé thành công.

**Pre-condition:** giao dịch đã thành công

**Post-condition:** thông báo được gửi

**Services gợi ý:**
- `NotificationService`
- `EmailNotificationService`

---

### UC-13. Áp dụng mã giảm giá
**Actor:** Khách hàng, Nhân viên

**Mục tiêu:** Giảm giá cho đơn hàng.

**Pre-condition:** voucher còn hiệu lực

**Post-condition:** tổng tiền được tính lại

**Rules:**
- kiểm tra hạn dùng
- kiểm tra điều kiện áp dụng
- voucher có thể giới hạn số lượt

**Services gợi ý:**
- `VoucherService`
- `PricingService`

---

### UC-14. Yêu cầu hoàn tiền
**Actor:** Khách hàng, Nhân viên

**Mục tiêu:** Hủy vé và hoàn tiền theo policy.

**Pre-condition:** vé chưa dùng và còn trong hạn hoàn

**Post-condition:** vé `REFUNDED`, ghế được giải phóng

**Rules:**
- trước 24h: hoàn 100%
- 24h đến 4h: hoàn 50%
- dưới 4h: không cho hoàn

**Services gợi ý:**
- `RefundService`
- `RefundPolicyService`

---

### UC-15. Quét mã QR
**Actor:** Nhân viên

**Mục tiêu:** Check-in vé tại quầy.

**Pre-condition:** vé hợp lệ, chưa dùng

**Post-condition:** vé `CHECKED_IN`

**Services gợi ý:**
- `CheckinService`
- `QrVerificationService`

---

### UC-16. In vé
**Actor:** Nhân viên

**Mục tiêu:** Xuất file PDF vé.

**Pre-condition:** khách đã thanh toán

**Post-condition:** file PDF được tạo

**Services gợi ý:**
- `TicketPdfService`
- `PrintTemplateService`

---

### UC-17. Tra cứu thông tin vé
**Actor:** Nhân viên

**Mục tiêu:** Tìm vé theo SĐT hoặc mã đơn hàng.

**Services gợi ý:**
- `TicketLookupService`

---

### UC-18. Cấu hình sơ đồ ghế
**Actor:** Quản trị viên

**Mục tiêu:** Tạo hoặc chỉnh seat layout cho phòng chiếu.

**Rules:**
- mỗi phòng gắn với một sơ đồ ghế
- đổi layout phải kiểm tra ràng buộc suất chiếu hiện tại

**Services gợi ý:**
- `SeatLayoutAdminService`

---

### UC-19. Thiết lập giá vé
**Actor:** Quản trị viên

**Mục tiêu:** Định nghĩa giá theo loại ghế, loại phòng, thời điểm.

**Services gợi ý:**
- `PricingRuleService`

---

### UC-20. Báo cáo & thống kê
**Actor:** Quản trị viên

**Mục tiêu:** Xem doanh thu, lấp đầy ghế, xu hướng đặt vé.

**Services gợi ý:**
- `ReportService`
- `RevenueAnalyticsService`

---

### UC-21. Phân quyền người dùng
**Actor:** Quản trị viên

**Mục tiêu:** Gán role, khóa/mở tài khoản.

**Services gợi ý:**
- `RoleManagementService`
- `AccountStatusService`

---

### UC-22. Quản lý voucher
**Actor:** Quản trị viên

**Mục tiêu:** CRUD voucher, giới hạn lượt dùng, thời gian dùng.

**Services gợi ý:**
- `VoucherAdminService`

---

### UC-23. Quản lý phim
**Actor:** Quản trị viên

**Mục tiêu:** CRUD phim.

**Services gợi ý:**
- `MovieAdminService`

---

### UC-24. Quản lý sự kiện
**Actor:** Quản trị viên

**Mục tiêu:** CRUD sự kiện.

**Services gợi ý:**
- `EventAdminService`

---

### UC-25. Quản lý rạp & địa điểm
**Actor:** Quản trị viên

**Mục tiêu:** CRUD cụm rạp, địa điểm.

**Services gợi ý:**
- `CinemaAdminService`
- `LocationAdminService`

---

### UC-26. Quản lý phòng chiếu
**Actor:** Quản trị viên

**Mục tiêu:** CRUD phòng chiếu, trạng thái bảo trì.

**Rules:**
- phòng bảo trì không được tạo suất chiếu mới
- không được xóa phòng đang có suất chiếu hoặc vé đã bán

**Services gợi ý:**
- `AuditoriumAdminService`

---

### UC-27. Đăng xuất
**Actor:** Khách hàng, Nhân viên, Quản trị viên

**Mục tiêu:** Kết thúc phiên và vô hiệu token.

**Pre-condition:** đang đăng nhập

**Post-condition:** access/refresh token bị revoke hoặc blacklist

**Main flow:**
1. Nhấn đăng xuất
2. Xác nhận
3. Server revoke refresh token
4. Client xóa token local
5. Điều hướng về trang chủ / đăng nhập

**Services gợi ý:**
- `LogoutService`
- `TokenBlacklistService`

---

## 8. Mẫu chuẩn để AI agent sinh service

Khi một use case mới xuất hiện, agent phải sinh theo khung này:

```md
### UC-XX. <Tên use case>
**Actor:**
**Mục tiêu:**
**Pre-condition:**
**Post-condition:**
**Input:**
**Output:**
**Main flow:**
**Alternate flows:**
**Exception flows:**
**Business rules:**
**State transitions:**
**Services cần có:**
**Repository cần có:**
**Transactions cần bao bọc:**
**Redis key / TTL / lock nếu có:**
**API endpoints gợi ý:**
```

---

## 9. Gợi ý map sang code backend

### 9.1. Package structure
- `controller`
- `service`
- `service.impl`
- `repository`
- `entity`
- `dto`
- `mapper`
- `security`
- `redis`
- `exception`
- `scheduler`
- `config`

### 9.2. Những chỗ phải cực kỳ cẩn thận
- giữ ghế
- thanh toán
- hoàn tiền
- check-in QR
- đổi trạng thái vé
- phân quyền
- revoke token

### 9.3. Những chỗ có thể tách job nền
- tóm tắt bình luận
- nhả ghế hết TTL
- thống kê báo cáo
- gửi notification

---

## 10. Prompt ngắn để dùng với AI agent

> Hãy đọc tài liệu UseCase.md này và sinh backend Spring Boot theo hướng modular monolith, tách Controller/Service/Repository rõ ràng, áp dụng JWT, Redis TTL lock cho ghế, transaction cho booking và payment, đồng thời giữ đúng business rules, state transitions và exception flows của từng use case. Ưu tiên code có thể chạy được, không hardcode logic nghiệp vụ, và luôn bám sát luồng chính của từng UC.

---

## 11. Kết luận
Tài liệu này đóng vai trò như “bản đồ chiến trường” cho AI agent. Chỉ cần bám đúng các use case, service boundary, trạng thái và rule bên trên, backend sẽ đi đúng quỹ đạo: rõ logic, ít đoán mò, và ít lỗi race condition hơn khi vào luồng đặt vé đồng thời. 
