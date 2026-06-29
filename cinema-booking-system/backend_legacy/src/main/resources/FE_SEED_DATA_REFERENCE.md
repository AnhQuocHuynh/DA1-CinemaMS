# FE Seed Data Reference

## Muc tieu
Tai lieu nay tong hop seed data de Frontend dev test nhanh cac flow chinh ma khong can tao tay du lieu.

## Tai khoan mac dinh (seed)

## Admin
- Email: `admin@cinema.com`
- Password: `admin123`
- Role: `ROLE_ADMIN`
- Quyen: Quan tri he thong, tao/sua/xoa movie/cinema/room/showtime, check-in ticket.

## Staff
- Email: `staff@cinema.com`
- Password: `staff123`
- Role: `ROLE_STAFF`
- Quyen: Nghiep vu tai quay (check-in, lookup ticket, thao tac staff endpoints).

## Customer
- Email: `customer@cinema.com`
- Password: `customer123`
- Role: `ROLE_CUSTOMER`
- Quyen: Dat ve, xem ve cua toi, booking/payment flow.

## Locked User (de test UX tai khoan bi khoa)
- Email: `locked@cinema.com`
- Password: `locked123`
- Role: `ROLE_CUSTOMER`
- Trang thai: `active=false`

## Du lieu rap / phong
- Cinemas:
1. `CGV HUNG VUONG PLAZA` (HCM)
2. `BETA THU DUC` (HCM)

- Rooms:
1. `Phong A1` (2D, 6x8)
2. `Phong A2` (IMAX, 5x7)
3. `Phong B1` (3D, 6x6)

- Seat types:
1. `STANDARD`: ghe don thuong, `columnSpan=1`, `priceMultiplier=1.00`.
2. `VIP`: ghe don vi tri tot hon, `columnSpan=1`, `priceMultiplier=1.30`.
3. `COUPLE`: ghe doi, la mot ghe logic duy nhat, `columnSpan=2`, `priceMultiplier=2.00`.

- Seat templates:
1. Cac hang dau la `STANDARD`.
2. Hai hang gan cuoi la `VIP`.
3. Hang cuoi la `COUPLE`; moi ghe doi chi co mot `seatId`, FE render rong 2 cot dua vao `columnSpan=2`.
4. `isPathway` hien duoc tra ve de FE danh dau loai cell khong phai ghe neu co.

## Seat map contract cho FE
Endpoint: `GET /api/showtimes/{showtimeId}/seats`

Moi item seat map co cac field quan trong:
1. `id` / `seatId`: id ghe theo suat chieu, dung de hold/order/pay.
2. `seatTemplateId`: id layout ghe trong phong.
3. `label`: nhan hien thi, vi du `A1`, `B4`.
4. `rowLabel`, `columnNumber`: dung de build grid.
5. `seatType`: lowercase (`standard`, `vip`, `couple`) de FE style nhanh.
6. `seatTypeCode`: uppercase (`STANDARD`, `VIP`, `COUPLE`) de FE so sanh on dinh.
7. `seatTypeName`: ten hien thi.
8. `seatKind`: hien bang `seatTypeCode`, giu de FE co field doc ro nghia.
9. `columnSpan`: `1` voi ghe don, `2` voi ghe doi.
10. `isPathway`: `true/false`.
11. `price`: gia ghe da nhan multiplier theo loai ghe.
12. `status`: `available`, `holding`, `sold`.
13. `holdTtlSeconds`: TTL con lai neu ghe dang duoc hold.

Ghe doi duoc xu ly nhu mot ghe logic duy nhat:
1. FE chon mot `seatId`.
2. BE hold/order/payment/ticket theo mot `seatId`.
3. FE render ghe rong 2 cot bang `columnSpan=2`, khong can ghe con ben trai/phai.

## Du lieu movie/event
- Movies:
1. `Lat Mat 9`
2. `Avengers: Secret Wars`
3. `Doraemon Movie 2026`

- Event:
1. `Anime Cosplay Night`

## Du lieu showtime
Seed cac showtime trong tuong lai, status `SCHEDULED`, da co day du `showtime_seats` trang thai `AVAILABLE`.

## Voucher
1. `WELCOME10` (10%, max 50k)
2. `FLAT30K` (giam thang 30k)

## Goi y flow test FE
1. Login bang `customer@cinema.com`.
2. Lay danh sach movie + showtime.
3. Lay seat map, goi hold seat.
4. Tao order voi `seatIds`.
5. Pay order.
6. Vao My Tickets de xem QR/ticket status.
7. Login staff/admin de check-in ticket.

## Order/payment response cho FE
`POST /api/orders` va `POST /api/orders/{id}/pay` tra ve `OrderResponse`, khong tra entity thuan.

Field chinh:
1. `id`, `userId`, `showtimeId`, `status`.
2. `movieTitle`, `roomName`, `cinemaName`, `startTime`, `endTime`.
3. `seatIds`, `seatLabels`, `seats`.
4. `totalAmount`, `discountAmount`, `finalAmount`.
5. `paymentMethod`, `paymentTransactionId`.
6. `tickets`: co du lieu sau khi payment thanh cong, gom `ticketCode`, `qrCodeData`, `seatLabel`, `status`.

## Mapping role -> man hinh FE
- `ROLE_ADMIN`: Admin dashboard, quan tri danh muc.
- `ROLE_STAFF`: Staff operations.
- `ROLE_CUSTOMER`: Portal dat ve + profile + my tickets.

## Luu y ky thuat
- Seed idempotent: restart app khong tao trung record.
- JWT secret nen set qua env `APP_JWT_SECRET`.
- Redis env dung key:
1. `SPRING_DATA_REDIS_HOST`
2. `SPRING_DATA_REDIS_PORT`
