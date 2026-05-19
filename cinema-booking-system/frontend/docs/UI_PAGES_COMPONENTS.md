# UI Pages - Component Inventory

Ghi chu: Tai lieu nay mo ta thanh phan UI theo tung file trong thu muc frontend/src/pages. Mo ta viet theo code hien tai, gom cac thanh phan chinh (button, grid, input, table, card, nav, modal, v.v.).

## Login (frontend/src/pages/Login.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| Header | Navbar | Thanh dieu huong tren cung |
| Hero/Featured panel | Card | Vung anh nen va tieu de phim noi bat |
| Status card | Card | The thong tin he thong |
| Quick stats card | Card | The thong ke nhanh |
| Auth modal | Modal | Hop thoai dang nhap noi dung chinh |
| Back link | Link | Quay ve trang chu |
| Title + subtitle | Text | Ten thuong hieu + tieu de + mo ta |
| Error alert | Alert | Thong bao loi chung |
| Email input | Textbox | InputField voi icon Mail |
| Password input | Textbox | Input password voi icon Lock |
| Forgot link | Link | Quen mat khau |
| Submit button | Button | Dang nhap |
| Secondary link | Link | Dang ky tai khoan |
| Footer tonal zone | Footer | Thong diep bao mat |
| Mobile bottom nav | Bottom nav | 4 muc icon + label |

## SignUp (frontend/src/pages/SignUp.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| Background grid | Decorative | Nen dang luoi |
| Decorative blobs | Decorative | Hinh tron mo, tao chieu sau |
| Info column | Section | Thong tin loi ich + anh minh hoa |
| Stats cards | Card | 3 the thong tin ngan |
| Promise card | Card | Cam ket giu ghe |
| Form card | Card | The dang ky |
| Back link | Link | Quay ve trang chu |
| Step indicator | Text | Buoc 1/1 |
| Error alert | Alert | Thong bao loi chung |
| Full name input | Textbox | InputField voi icon User |
| Email input | Textbox | InputField voi icon Mail |
| Password input | Textbox | Input password voi icon Lock |
| Confirm input | Textbox | Input confirm password |
| Access tier row | Card | Hien thi hang truy cap |
| Submit button | Button | Tao tai khoan |
| Terms text | Text | Dieu khoan/Privacy |
| Login link | Link | Da co tai khoan |
| Footer tonal zone | Footer | Thong diep bao mat |

## ForgotPassword (frontend/src/pages/ForgotPassword.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| Header | Navbar | Thanh dieu huong tren cung |
| Backdrop | Overlay | Nen mo + blur |
| Reset card | Card | Hop thoai reset mat khau |
| Title + subtitle | Text | Tieu de va mo ta |
| Success panel | Alert | Thong bao gui email thanh cong |
| Error alert | Alert | Thong bao loi |
| Email input | Textbox | InputField voi icon Mail |
| Submit button | Button | Gui link reset |
| Link to login | Link | Quay lai dang nhap |
| Footer tonal zone | Footer | Thong diep bao mat |

## Home (frontend/src/pages/Home.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| Fixed header | Navbar | Logo, nav, CTA |
| User chip | Badge | Hien thi email/role khi dang nhap |
| Search bar | Form | O tim kiem + autocomplete |
| Autocomplete list | List | Goi y phim |
| Hero section | Section | Anh nen, tieu de, CTA |
| CTA buttons | Button | Explore, Browse |
| Movies grid | Grid | Danh sach phim |
| Movie card | Card | Poster + thong tin + gia |
| Theaters section | Section | Mo ta rap + anh |
| Image grid | Grid | 4 anh rap |
| Membership section | Section | Khuyen khich dang ky |
| Perk cards | Card | 4 loi ich |

## MovieDetails (frontend/src/pages/MovieDetails.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| Fixed header | Navbar | Logo + back button |
| Hero backdrop | Section | Anh nen phim + thong tin chinh |
| Rating badge | Badge | Sao + diem |
| Action buttons | Button | Watch Trailer, Book Tickets |
| Narrative block | Text | Mo ta phim |
| Cast grid | Grid | Danh sach dien vien |
| Cast card | Card | Anh + ten + vai |
| Sidebar info | Card | Release date, language, format |
| Showtimes panel | Card | Danh sach suat chieu + reserve |
| Showtime buttons | Button | Chon suat chieu |
| Reserve button | Button | Reserve Seat Map |
| Empty state | Section | Movie not found + CTA |

## MovieSearch (frontend/src/pages/MovieSearch.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| Sticky header | Navbar | Logo + back link |
| Title block | Text | Tieu de + thong tin ket qua |
| View chip | Badge | Hien thi che do view |
| Empty state | Section | Khong co ket qua |
| Results grid | Grid | Danh sach phim |
| Movie card | Card | Poster + thong tin + gia |
| Details link | Link | Xem chi tiet |

## AdminDashboard (frontend/src/pages/admin/AdminDashboard.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| AdminTopBar | Navbar | Search + nav links |
| AdminPageHeader | Header | Tieu de + actions |
| Date filter button | Button | Last 30 Days |
| Filter button | Button | Filters |
| Revenue card | Card | Doanh thu + mini chart |
| Occupancy card | Card | Vong trondang + chi so |
| Live feed card | Card | Feed giao dich |
| Popularity card | Card | Thanh do pho bien |
| Room highlights | Grid | Danh sach phong noi bat |
| Quick actions | Panel | 2 nut hanh dong nhanh |
| Status footer | Footer | Trang thai he thong |
| Floating action | FAB | Nut cong |

## MovieManagement (frontend/src/pages/admin/MovieManagement.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| AdminTopBar | Navbar | Search movies |
| AdminPageHeader | Header | Tieu de + button Add Movie |
| Search input | Textbox | Tim theo title/status |
| Status legend | Text | Active/Draft/Archived |
| Movies table | Table | Danh sach phim |
| Action buttons | Button | Edit, Archive |
| Loading state | Text | Loading movies |

## PermissionManagement (frontend/src/pages/admin/PermissionManagement.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| AdminTopBar | Navbar | Search users/roles |
| AdminPageHeader | Header | Tieu de + actions |
| Export button | Button | Export data |
| Invite button | Button | Invite user |
| Metrics cards | Card | 4 KPI cards |
| Users table | Table | Danh sach user + roles |
| Role toggle | Switch | Bat/tat role theo user |
| Pagination | Pagination | Trang 1-3 |
| Rules list | List | Global permissions |
| Tags | Badge | Admin Only / General |
| System integrity panel | Panel | 2FA + session policy |
| Security button | Button | Review logs |
| Loading state | Text | Loading permissions |

## PricingAndVouchers (frontend/src/pages/admin/PricingAndVouchers.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| AdminTopBar | Navbar | Search pricing |
| AdminPageHeader | Header | Tieu de + actions |
| Download button | Button | Download report |
| Create voucher button | Button | Tao voucher |
| Standard rate card | Card | Gia co ban + input |
| Rate input | Textbox | Set new rate |
| Apply button | Button | Apply global update |
| Tier cards | Card | Quy tac gia theo tier |
| Edit rules button | Button | Edit rules |
| Toggle | Switch | Dynamic surge pricing |
| Voucher search | Textbox | Search codes |
| Filter button | Button | Loc |
| Voucher table | Table | Danh sach voucher |
| Usage bar | Progress | Thanh tien do su dung |
| Actions menu | Button | Ellipsis |
| Loading state | Text | Loading pricing data |

## RoomManagement (frontend/src/pages/admin/RoomManagement.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| AdminTopBar | Navbar | Search theaters/rooms |
| AdminPageHeader | Header | Tieu de + add theater |
| Add theater button | Button | Add New Theater |
| KPI cards | Card | 3 the thong ke |
| Theater sections | Accordion | Mo rong/thu gon rap |
| Theater header | Row | Ten, region, actions |
| Room table | Table | Danh sach phong |
| Status badge | Badge | Operational/Maintenance |
| Configure button | Button | Configure seats |
| Edit button | Button | Chinh sua phong |
| Add room button | Button | Them phong |
| Loading state | Text | Loading theaters |

## SeatConfigurator (frontend/src/pages/admin/SeatConfigurator.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| AdminTopBar | Navbar | Nav links + search |
| AdminPageHeader | Header | Tieu de + actions |
| Back button | Button | Quay lai rooms |
| Reset button | Button | Reset grid |
| Save button | Button | Save configuration |
| Screen indicator | Decorative | Vung man hinh |
| Seat grid | Grid | Ban do ghe (drag/drop) |
| Seat summary | Card | Standard/VIP/Total |
| Sidebar | Panel | Tool select + row/col inputs |

## ShowtimeManagement (frontend/src/pages/admin/ShowtimeManagement.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| AdminTopBar | Navbar | Search schedules |
| AdminPageHeader | Header | Tieu de + add showtime |
| Add showtime button | Button | Add New Showtime |
| KPI cards | Card | 3 the thong ke |
| Search input | Textbox | Tim phim/rap |
| Filter button | Button | Filter |
| More button | Button | More |
| Showtimes table | Table | Danh sach suat chieu |
| Action buttons | Button | Edit, Delete |
| Edit modal | Modal | Form chinh sua |
| Form inputs | Textbox/Select | Movie, hall, date, time |
| Loading state | Text | Loading schedules |

## Booking (frontend/src/pages/portal/Booking.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| PortalTopNav | Navbar | Nav portal |
| Title block | Text | Ten phim + thong tin suat chieu |
| Screen indicator | Decorative | Vung man hinh |
| Seat map grid | Grid | So do ghe |
| Seat legend | Legend | Chu giai ghe |
| Summary sidebar | Sidebar | Thong tin ghe chon |
| Timer card | Card | Dem nguoc giu ghe |
| Selected seats list | List | Danh sach ghe chon |
| Price summary | Summary | Subtotal/fees/total |
| Checkout button | Button | Proceed to Checkout |
| Info callout | Info | Thong tin ho tro |

## Checkout (frontend/src/pages/portal/Checkout.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| Back button | Button | Quay lai |
| Step label | Text | Step 3/3 |
| Order summary card | Card | Thong tin phim + ghe + gia |
| Promo input | Textbox | Ma khuyen mai |
| Apply button | Button | Apply code |
| Payment methods | Radio list | 3 lua chon |
| Total amount | Summary | Tong thanh toan |
| Confirm button | Button | Confirm & Pay |
| Security note | Text | Bao mat giao dich |
| Loading state | Text | Loading checkout |

## CheckoutSuccess (frontend/src/pages/portal/CheckoutSuccess.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| Success icon | Icon | CheckCircle trong vong tron |
| Title + message | Text | Xac nhan thanh toan |
| Booking summary card | Card | Ma booking + thong tin |
| Ticket action link | Link | View ticket |
| Download button | Button | Download PDF |
| Share button | Button | Share |

## Dashboard (frontend/src/pages/portal/Dashboard.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| Fixed header | Navbar | Logo + nav + user + logout |
| Welcome section | Text | Loi chao + mo ta |
| Movies grid | Grid | Danh sach phim |
| Movie card | Card | Poster + rating + Book Now |
| Book now button | Button | Dat ve |
| Bookings list | List | Danh sach booking |
| Booking item | Card | Thong tin ve + status + CTA |
| Empty bookings | Empty state | Khong co booking |
| Mobile bottom nav | Bottom nav | 3 muc |

## TicketInfo (frontend/src/pages/portal/TicketInfo.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| PortalTopNav | Navbar | Nav portal |
| Back button | Button | Quay lai My Tickets |
| Poster card | Card | Poster + status badge |
| Info callout | Info | Luu y xuat trinh |
| Ticket details | Card | Thong tin chi tiet ve |
| Detail grid | Grid | Date, time, venue, seats |
| Seat badges | Badge | Danh sach ghe |
| Booking id | Text | Ma ve (mono) |
| QR block | QR | QR code + thong diep |
| Wallet button | Button | Add to Wallet |
| Print button | Button | Print Ticket |
| Footer actions | Button | Cancel, Share |

## UserDashboard (frontend/src/pages/portal/UserDashboard.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| Fixed header | Navbar | Logo + nav + user + logout |
| Welcome section | Text | Loi chao + mo ta |
| Movies grid | Grid | Danh sach phim |
| Movie card | Card | Poster + rating + Book Now |
| Book now button | Button | Dat ve |
| Bookings list | List | Danh sach booking |
| Booking item | Card | Thong tin ve + status + CTA |
| Empty bookings | Empty state | Khong co booking |
| Mobile bottom nav | Bottom nav | 3 muc |

## QRChecker (frontend/src/pages/staff/QRChecker.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| Fullscreen overlay | Overlay | Nen den mo |
| Header | Header | Tieu de + close button |
| Scan frame | Frame | Khung quet QR |
| Scan line | Decorative | Duong quet |
| Flash button | Button | Bat/tat flash |
| Manual entry button | Button | Nhap tay |
| Result toast | Toast | Ket qua quet |
| Undo button | Button | Xoa ket qua |

## StaffDashboard (frontend/src/pages/staff/StaffDashboard.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| Fixed header | Navbar | Logo + nav + user + logout |
| Title section | Text | Tieu de + mo ta |
| KPI cards | Card | 3 the thong ke |
| Bookings table | Table | Danh sach booking gan day |
| Status badges | Badge | Confirmed |
| Mobile bottom nav | Bottom nav | 2 muc |
| Loading state | Text | Loading dashboard |

## TicketLookup (frontend/src/pages/staff/TicketLookup.tsx)

| Thanh phan | Loai | Mo ta |
| --- | --- | --- |
| StaffLayout | Layout | Top bar + search |
| Header block | Text | Tieu de + mo ta |
| Filters button | Button | Mo bo loc |
| Quick scan button | Button | Mo quet nhanh |
| KPI cards | Card | 3 the thong ke |
| Validation table | Table | Danh sach booking |
| Status badge | Badge | Pending/Validated |
| Action buttons | Button | Validate, Print PDF |
| Loading state | Text | Loading validation data |
