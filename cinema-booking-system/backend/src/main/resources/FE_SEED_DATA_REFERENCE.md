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

- Seat templates:
Tu dong tao theo `rows x columns` (A1.., A2.., ...), active=true.

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
