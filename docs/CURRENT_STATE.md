# Current State

Ảnh chụp vận hành của Đồ án 1 — Cinema Booking System.

Ngày cập nhật: 2026-09-27. File này là hiện trạng đang dùng. `SESSION_BOOTSTRAP.md`,
`AGENTS.md` và `cinema-booking-system/backend/MIGRATION_STATUS.md` vẫn mô tả
nhánh `refactor-compose-single-postgres` trước khi gộp, nên khi lệch nhau thì
ưu tiên file này và mã đang có trên `main`.

## Snapshot

- Nhánh deploy: `main`, commit `d0e0060` (`Merge branch 'dev' into main`), khớp `origin/main`.
- Nhánh tích hợp: `dev`, commit `0816c46` (`Merge branch 'refactor-compose-single-postgres' into dev`), khớp `origin/dev`.
- Cây thư mục của `dev` và `main` giống nhau. `refactor-compose-single-postgres` (`4c8a3a3`) đã nằm trong cả hai.
- Bản demo chạy được vẫn là monolith `cinema-booking-system/backend_legacy/` cộng React ở `cinema-booking-system/frontend/`.
- `cinema-booking-system/backend/` là đích microservice. Traffic và dữ liệu chuẩn chưa chuyển khỏi `backend_legacy`.
- Working tree sạch sau khi đẩy hai merge commit. Chưa chạy lại test, smoke hay build sau lần gộp ngày 2026-09-27.

## Git và CI

Ngày 2026-09-27 đã gộp `refactor-compose-single-postgres` vào `dev`, rồi `dev` vào `main`, và đẩy cả hai lên `origin`.

Chỉ một file sửa ở cả hai phía: `.github/workflows/run-tests.yml`. Cách giải quyết là giữ cả hai đường kiểm tra:

- `backend-legacy-tests`: `mvn test` trong `cinema-booking-system/backend_legacy` khi thư mục monolith đổi.
- `backend-tests`: `mvn --batch-mode clean verify`, kiểm tra script PowerShell và `docker compose config` trong `cinema-booking-system/backend` khi thư mục microservice đổi.
- `backend-event-flow`: chạy `event-flow-smoke.ps1 -StartCompose -StopCompose` sau job Spring, timeout 25 phút.

`.github/workflows/run-build.yml` vẫn chỉ theo dõi `frontend/**` và `backend_legacy/**`. Build frontend trên CI dùng Node 20.

Bằng chứng test cũ vẫn đúng với ngày ghi nhận, và chưa được lặp lại sau merge:

- 2026-08-07: reactor Spring 179 test, sáu image Java 21 non-root, runtime smoke, event-flow, và rehearsal migrate trên PostgreSQL dùng một lần.
- 2026-08-07: `npm ci` và Vite build của frontend đạt. Audit production còn 6 cảnh báo. `@zxing/library@0.22.0` khai báo Node 24 trở lên, môi trường kiểm tra lúc đó là Node 22.16.0.
- 2026-08-23: consumer sự kiện thanh toán của `booking-service` có 70 test đơn vị.

## Hình dạng repository

| Khu vực | Vai trò trên `main` |
|---|---|
| `backend_legacy` | Monolith Spring Boot, nguồn sự thật của luồng đặt vé demo |
| `frontend` | React 18, Vite 5, TypeScript, Tailwind, Zustand |
| `catalog-service`, `showtime-service`, `booking-service`, `analytics-service`, `recommendation-service` | Spring, đã tách và có test trong cây mã |
| `facility-service` | ASP.NET là bản triển khai trong Compose. Không còn source Java trong service này |
| `identity-service`, `api-gateway`, `payment-service`, `notification-service` | ASP.NET, đã có mã trên `main` |
| `backend/infrastructure/docker-compose.yml` | Một PostgreSQL 18, Redis, RabbitMQ, Keycloak, Neo4j, MongoDB và các service ở trên |

Compose tạo nhiều database logic trên một container PostgreSQL 18, cổng host `5432`, qua `init-multiple-databases.sql`. Redis suất chiếu, RabbitMQ và Neo4j là container riêng. Notification dùng MongoDB.

Ranh giới đã có trong mã Spring:

- Catalog gọi lệnh suất chiếu sự kiện nội bộ của Showtime.
- Showtime đọc Catalog và Facility qua HTTP.
- Booking giữ và nhả ghế qua Showtime, lấy dữ liệu phim và phòng qua projection.
- Facility chặn xóa rạp hoặc phòng khi còn suất chiếu tương lai, và đóng lại nếu Showtime không trả lời.
- Endpoint nội bộ nằm dưới `/internal/**`, header chuyển tiếp là `X-Internal-Token`.
- Catalog và Booking ghi outbox trong transaction. Analytics và Recommendation tiêu thụ sự kiện có chống trùng và chống sự kiện cũ.

`CINEMA_SECURITY_JWT_ENABLED` của các service Spring vẫn là công tắc. Chưa có đợt test token thật của Keycloak sau khi gộp.

## Cổng và tài khoản

Compose, cổng host mặc định:

- PostgreSQL `5432`, Redis `6379`, RabbitMQ `5672` và UI `15672`.
- Keycloak `8080`.
- API Gateway `5000`.
- Identity `5001`, Facility `5002`, Payment `5003`, Notification `5004`.
- Catalog `8081`, Showtime `8082`, Booking `8083`, Analytics `8084`, Recommendation `8085`.
- Redis của Showtime `6380`. Neo4j `7474` và `7687`. MongoDB `27017`.

Monolith local dùng `localhost:5432/cinema_db` và Redis `localhost:6379`. Keycloak trong Compose cũng nhận host `8080`, trùng cổng thường dùng của monolith. Postgres `5432` và Redis `6379` cũng trùng. Chỉ chạy một trong hai cụm tại một thời điểm.

Tài khoản seed, từ `backend_legacy/src/main/resources/FE_SEED_DATA_REFERENCE.md`:

- Admin: `admin@cinema.com` / `admin123`.
- Staff: `staff@cinema.com` / `staff123`.
- Customer: `customer@cinema.com` / `customer123`.
- Customer bị khóa: `locked@cinema.com` / `locked123`.

## Hiện trạng sản phẩm

Nhận xét test tay của teammate, ghi ngày 2026-09-27, chưa được kiểm lại trong phiên này:

- Admin khoảng 80 phần trăm, chưa test hết màn hình.
- Staff chưa test.
- Đặt vé của khách ổn.
- Hoàn tiền còn lỗi, sẽ sửa sau.
- Bình luận ổn.
- Recommendation ổn.
- Sự kiện chưa test.

Đối chiếu với mã của bản demo:

| Phần | Trong mã | Ghi chú |
|---|---|---|
| Đặt vé khách | Trang chủ, chi tiết phim, suất chiếu, chọn ghế, thanh toán, vé của tôi | Khớp nhận xét teammate |
| Admin | Dashboard, phim, sự kiện, suất chiếu, rạp và phòng, sơ đồ ghế, voucher, phân quyền | Màn hình có đủ để test nốt |
| Staff | Dashboard, đặt vé quầy, tra cứu vé, quét QR | Màn hình có, chưa có bằng chứng test |
| Sự kiện | Chi tiết, quản trị, và kết quả tìm kiếm có sự kiện | Chưa được test tay |
| Bình luận | `ReviewSection` trên phim và sự kiện. Chỉ người đã mua vé mới được đánh giá | Khớp nhận xét teammate |
| Recommendation | Service cổng `8085`: phổ biến, tương tự, cá nhân hóa, hybrid, Neo4j | React không gọi service này. Nhận xét "ổn" ứng với API |
| Tìm kiếm | `LIKE` không phân biệt hoa thường trên `title` và `description`, lọc thể loại và ngày khởi chiếu | Chưa phải tìm theo nội dung |
| Hoàn tiền | Trên 24 giờ trả 100%, từ 4 đến 24 giờ trả 50%, dưới 4 giờ hoặc vé đã check-in thì từ chối | Phần trăm chỉ được ghi log. `orders` không có số tiền hoàn, `finalAmount` không đổi, monolith không gọi cổng thanh toán |
| Báo cáo | Dashboard: doanh thu, suất lấp đầy, vé bán, đặt chỗ, người dùng, phim phổ biến | Analytics service lặp lại bốn endpoint đó |
| Mobile | Trang khách có một số breakpoint `md` và `lg` | Sidebar admin là `hidden md:flex` và không có menu thay thế. Hero cao 620px. Sơ đồ ghế là lưới ngang |

Hai đường hoàn tiền đang song song. Monolith đổi trạng thái đơn thành `REFUNDED` và trả ghế. `payment-service` có saga `PaymentRefunded`, publish envelope lên exchange topic `payment.events`, routing key lấy từ `EventType`. `booking-service` có consumer khi `BOOKING_PAYMENT_EVENTS_ENABLED=true`. Chưa chạy lại một lần giao tiếp RabbitMQ thật giữa Payment và Booking sau merge.

Gateway đã có route YARP cho auth, phim, sự kiện, suất chiếu, đơn, vé, đánh giá, analytics, recommendation và payment. Route `/api/payments/callback/**` đứng trước route payment có `AuthorizationPolicy: authenticated` và không gắn policy, để callback của cổng thanh toán đi qua. `appsettings.json` trỏ destination về localhost. Compose ghi đè sang tên service Docker. Chưa có bộ test token thật và header giả sau khi các nhánh nằm chung một cây.

## Lệnh kiểm tra

Từ `D:\UNI_DOCS\HK6\DA1\DA1-CinemaMS`:

```powershell
git status --short --branch
```

Monolith:

```powershell
cd cinema-booking-system\backend_legacy
mvn test
```

Reactor Spring:

```powershell
cd cinema-booking-system\backend
mvn test
```

Compose và smoke:

```powershell
cd cinema-booking-system\backend
docker compose -f infrastructure\docker-compose.yml config
.\infrastructure\smoke-test.ps1
.\infrastructure\event-flow-smoke.ps1 -StartCompose -StopCompose
.\infrastructure\migrations\migration-rehearsal.ps1
```

Frontend:

```powershell
cd cinema-booking-system\frontend
npm ci
npm run build
```

Dev UI: `npm run dev` trong `frontend`, mặc định `http://localhost:5173`, proxy `/api` về monolith.

## Việc còn mở của đợt tách service

Các mục dưới đây vẫn mở. Mã đã vào `main`, nhưng chưa có buổi kiểm tra tích hợp lại.

- Bật JWT Spring chỉ sau khi Gateway chuyển nguyên bearer token, gỡ header giả được, chặn `/internal/**`, và bộ test token thật đạt.
- Chạy một lần Payment publish `payment.completed`, `payment.failed`, `payment.refunded` để Booking tiêu thụ trên broker thật.
- Đối chiếu contract Facility ASP.NET với projection mà Showtime và Booking đang gọi.
- Rehearsal trên bản sao database chuẩn, đúng PostgreSQL 18, hai vòng export, restore, đối soát nội dung và sequence, rồi lưu bằng chứng.
- Backfill graph Recommendation trên bản sao đó.
- Diễn tập rollback về `backend_legacy` trước khi chuyển traffic.

Rehearsal ngày 2026-08-07 trên database dùng một lần và trên dữ liệu dev local đã đạt hai vòng restore, hai lần backfill Analytics, từ chối dump sai checksum, và từ chối sequence cũ. Đó chưa phải buổi cutover.

## Hướng mở rộng

Việc sản phẩm mới làm trên `backend_legacy` và `frontend`, vì đó là bản demo. Chưa mở thêm microservice cho đến khi monolith demo xong các mục dưới. Nhánh gợi ý, tách từ `main`: `feature/discovery-rental-insights`.

### Tìm theo nội dung phim

Giảng viên yêu cầu tìm theo nội dung, không chỉ theo tên. Hiện chỉ có `title`, `description` và thể loại. Hướng làm:

- Thêm dữ liệu nội dung đủ để giải thích kết quả: tóm tắt, đạo diễn, diễn viên, từ khóa.
- Dùng full-text của PostgreSQL trên các trường đó.
- Trang `/movies/search` hiện đoạn chữ khớp với từ khóa.
- Tìm theo nghĩa bằng embedding chỉ thêm khi buổi bảo vệ cần demo riêng. Full-text là phạm vi mặc định.

### Luồng cho thuê phòng chiếu

Repo chưa có entity, API hay trang cho thuê. Luồng phù hợp với dữ liệu sẵn có là thuê cả phòng cho một khung giờ riêng:

- Khách chọn rạp, phòng và khung giờ.
- Hệ thống báo giá, thanh toán, rồi nhân viên duyệt lịch.
- Đơn thuê là loại đơn riêng, vì không đi qua chọn từng ghế của suất chiếu lẻ.
- Tái sử dụng phòng, bảng giá và thanh toán. Chặn trùng lịch với suất chiếu đã có.

### Báo cáo cho các tính năng bổ sung

Dashboard hiện dừng ở doanh thu và phim phổ biến. Báo cáo mới bám đúng phần bổ sung và phần đang yếu:

- Tỷ lệ và số tiền hoàn.
- Điểm đánh giá theo phim và theo sự kiện.
- Doanh thu sự kiện đặt cạnh doanh thu vé phim.
- Công suất phòng được thuê, sau khi có luồng cho thuê.
- Số lượt tìm nội dung dẫn tới đặt vé, sau khi có tìm theo nội dung.
- Với recommendation: số lần API trả kết quả và số lần khách mở phim được gợi ý, khi portal đã gọi service.

### Responsive cho mobile

Làm theo thứ tự này:

- Menu admin và điều hướng staff trên màn hẹp. Sidebar admin hiện biến mất dưới `md`.
- Sơ đồ ghế cuộn và bấm được trên điện thoại.
- Trang đặt vé, thanh toán và vé của tôi ở chiều rộng điện thoại.
- Hero trang chủ, hiện cao cố định 620px.
- Kiểm tra cả desktop và mobile trên các trang dùng chung layout vừa sửa.

### Việc kèm theo, trước khi nhận các feature mới là xong

- Sửa hoàn tiền trên monolith: lưu số tiền hoàn theo 100% hoặc 50%, và một đường duy nhất với saga của `payment-service`. Teammate đã đánh dấu sẽ sửa sau.
- Test nốt admin, toàn bộ staff, và luồng sự kiện bằng ba tài khoản seed.
- Đưa recommendation ra trang khách. Service đã có. Portal chưa gọi.
- Giữ nguyên các cổng tích hợp ở mục trên. Feature demo không thay cho buổi cutover.
