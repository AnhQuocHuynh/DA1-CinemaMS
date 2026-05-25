/**
 * Cinema Booking System - Automated E2E System Integration Test Script
 * 
 * Yêu cầu: Node.js version 18+ (để sử dụng API fetch tích hợp sẵn).
 * Cách chạy: node test-api.js
 */

const BASE_URL = 'http://localhost:8080';

// Cấu hình tài khoản thử nghiệm
const ADMIN_EMAIL = 'admin@cinema.com';
const ADMIN_PASSWORD = 'admin123';

const COLORS = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    red: '\x1b[31m'
};

function logHeader(msg) {
    console.log(`\n${COLORS.bright}${COLORS.blue}=== ${msg} ===${COLORS.reset}`);
}

function logSuccess(msg) {
    console.log(`${COLORS.green}✔ [SUCCESS] ${msg}${COLORS.reset}`);
}

function logInfo(msg) {
    console.log(`${COLORS.cyan}ℹ [INFO] ${msg}${COLORS.reset}`);
}

function logWarning(msg) {
    console.log(`${COLORS.yellow}⚠ [WARNING] ${msg}${COLORS.reset}`);
}

function logError(msg, err = '') {
    console.log(`${COLORS.red}✘ [FAILED] ${msg} ${err}${COLORS.reset}`);
}

async function runTests() {
    console.log(`${COLORS.bright}${COLORS.magenta}=============================================================`);
    console.log('      CINEMA BOOKING SYSTEM - END-TO-END SYSTEM TEST         ');
    console.log(`=============================================================${COLORS.reset}`);

    const randomSuffix = Math.floor(Math.random() * 100000);
    const customerEmail = `customer_${randomSuffix}@cinema.com`;
    const customerPassword = 'password123';
    
    let customerToken = '';
    let customerRefreshToken = '';
    let customerUserId = null;

    let adminToken = '';
    
    // Siêu dữ liệu rạp/phòng/phim tạo ra trong lúc test
    let cinemaId = null;
    let roomId = null;
    let movieId = null;
    let showtimeId = null;
    let seatId = null;
    let orderId = null;
    let ticketCode = '';

    // ==========================================
    // FLOW 1: AUTHENTICATION & PROFILE (CUSTOMER)
    // ==========================================
    logHeader('FLOW 1: ĐĂNG KÝ & XÁC THỰC KHÁCH HÀNG');

    // 1. Đăng ký khách hàng mới
    try {
        logInfo(`Đăng ký khách hàng mới: ${customerEmail}`);
        const res = await fetch(`${BASE_URL}/api/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: customerEmail,
                password: customerPassword,
                fullName: 'Nguyen Khach Hang Test',
                phone: `09${String(randomSuffix).padStart(8, '0')}`
            })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            logSuccess('Đăng ký tài khoản khách hàng thành công!');
        } else {
            throw new Error(data.message || 'Đăng ký lỗi');
        }
    } catch (e) {
        logError('Đăng ký khách hàng thất bại!', e.message);
        return;
    }

    // 2. Đăng nhập khách hàng
    try {
        logInfo(`Đăng nhập khách hàng: ${customerEmail}`);
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: customerEmail, password: customerPassword })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            customerToken = data.data.accessToken;
            customerRefreshToken = data.data.refreshToken;
            customerUserId = data.data.user.id;
            logSuccess(`Đăng nhập thành công! User ID: ${customerUserId}`);
            logInfo(`Access Token: Bearer ${customerToken.substring(0, 15)}...`);
            logInfo(`Refresh Token: ${customerRefreshToken.substring(0, 15)}...`);
        } else {
            throw new Error(data.message || 'Đăng nhập lỗi');
        }
    } catch (e) {
        logError('Đăng nhập khách hàng thất bại!', e.message);
        return;
    }

    // 3. Lấy profile cá nhân (Bọc ApiResponse + DTO)
    try {
        logInfo(`Lấy thông tin tài khoản của chính mình (User ID: ${customerUserId})`);
        const res = await fetch(`${BASE_URL}/api/users/${customerUserId}`, {
            headers: { 'Authorization': `Bearer ${customerToken}` }
        });
        const data = await res.json();
        if (res.ok && data.success) {
            logSuccess(`Lấy hồ sơ cá nhân thành công! Tên: ${data.data.fullName}`);
        } else {
            throw new Error(data.message || 'Lấy hồ sơ lỗi');
        }
    } catch (e) {
        logError('Lấy hồ sơ cá nhân thất bại!', e.message);
    }

    // 4. Thử lấy danh sách toàn bộ User (Yêu cầu ADMIN -> Phải bị chặn 403 Forbidden)
    try {
        logInfo('Kiểm tra Role Guard: Khách hàng thường thử lấy danh sách toàn bộ User...');
        const res = await fetch(`${BASE_URL}/api/users`, {
            headers: { 'Authorization': `Bearer ${customerToken}` }
        });
        const data = await res.json();
        if (res.status === 403 || !data.success) {
            logSuccess('Role Guard hoạt động tốt! Hệ thống từ chối quyền truy cập (403 Forbidden).');
        } else {
            logWarning('CẢNH BÁO: Khách hàng thường có thể lấy danh sách User! Cần xem lại phân quyền.');
        }
    } catch (e) {
        logError('Kiểm thử Role Guard thất bại!', e.message);
    }

    // 5. Thử làm mới Token (Refresh Token Lifecycle)
    try {
        logInfo('Kiểm tra làm mới Access Token bằng Refresh Token...');
        const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: customerRefreshToken })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            customerToken = data.data.accessToken;
            logSuccess('Làm mới Token thành công! Đã cập nhật Access Token mới.');
        } else {
            throw new Error(data.message || 'Refresh lỗi');
        }
    } catch (e) {
        logError('Làm mới Token thất bại!', e.message);
    }


    // ==========================================
    // FLOW 2: ADMIN SETUP (CINEMA, ROOM, MOVIE, SHOWTIME)
    // ==========================================
    logHeader('FLOW 2: THIẾT LẬP DỮ LIỆU RAP/PHÒNG/PHIM (ADMIN)');

    // 1. Đăng nhập Admin
    try {
        logInfo(`Đăng nhập tài khoản Admin: ${ADMIN_EMAIL}`);
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            adminToken = data.data.accessToken;
            logSuccess('Đăng nhập Admin thành công!');
        } else {
            logWarning(`Đăng nhập Admin thất bại (Lỗi: ${data.message}). Vui lòng chắc chắn đã seed tài khoản Admin.`);
            logWarning('Bỏ qua các bước Admin nhạy cảm. Tiếp tục test các API Public.');
            return;
        }
    } catch (e) {
        logError('Không thể kết nối API Đăng nhập Admin!', e.message);
        return;
    }

    // 2. Tạo rạp mới (Cinema)
    try {
        logInfo('Tạo rạp chiếu mới...');
        const res = await fetch(`${BASE_URL}/api/cinemas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                name: `CGV Hùng Vương Plaza #${randomSuffix}`,
                address: '126 Hùng Vương, Quận 5, TP. HCM',
                city: 'Hồ Chí Minh',
                phone: '02838350000'
            })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            cinemaId = data.data.id;
            logSuccess(`Tạo rạp thành công! Cinema ID: ${cinemaId}`);
        } else {
            throw new Error(data.message || 'Tạo rạp lỗi');
        }
    } catch (e) {
        logError('Tạo rạp chiếu thất bại!', e.message);
        return;
    }

    // 3. Tạo phòng chiếu mới (Room)
    try {
        logInfo(`Tạo phòng chiếu cho Rạp ID: ${cinemaId}`);
        const res = await fetch(`${BASE_URL}/api/cinemas/${cinemaId}/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                name: 'Phòng IMAX VIP',
                type: 'IMAX',
                totalSeats: 2,
                rows: 1,
                columns: 2
            })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            roomId = data.data.id;
            logSuccess(`Tạo phòng thành công! Room ID: ${roomId}`);
        } else {
            throw new Error(data.message || 'Tạo phòng lỗi');
        }
    } catch (e) {
        logError('Tạo phòng chiếu thất bại!', e.message);
        return;
    }

    // 4. Tạo phim mới (Movie)
    try {
        logInfo('Tạo phim mới trong danh mục...');
        const res = await fetch(`${BASE_URL}/api/movies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                title: `Hành trình vô tận #${randomSuffix}`,
                description: 'Một tác phẩm điện ảnh bom tấn xuất sắc.',
                durationMinutes: 120,
                releaseDate: '2026-05-24',
                ageRating: 'T16',
                posterUrl: 'http://example.com/poster.jpg',
                trailerUrl: 'http://example.com/trailer.mp4',
                language: 'Tiếng Việt',
                genreIds: []
            })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            movieId = data.data.id;
            logSuccess(`Tạo phim thành công! Movie ID: ${movieId}`);
        } else {
            throw new Error(data.message || 'Tạo phim lỗi');
        }
    } catch (e) {
        logError('Tạo phim thất bại!', e.message);
        return;
    }

    // 5. Kiểm tra phòng bảo trì (Maintenance Status Constraints)
    try {
        logInfo('Kiểm tra tính năng bảo trì phòng chiếu...');
        // Đặt phòng sang trạng thái bảo trì
        await fetch(`${BASE_URL}/api/cinemas/${cinemaId}/rooms/${roomId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                name: 'Phòng IMAX VIP',
                type: 'IMAX',
                totalSeats: 2,
                rows: 1,
                columns: 2,
                underMaintenance: true
            })
        });
        logInfo('Đã chuyển phòng sang trạng thái underMaintenance = true.');

        // Thử tạo lịch chiếu trong phòng đang bảo trì -> Phải bị chặn!
        logInfo('Thử tạo suất chiếu mới trong phòng đang bảo trì...');
        const res = await fetch(`${BASE_URL}/api/showtimes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                roomId: roomId,
                movieId: movieId,
                startTime: '2026-05-24T19:00:00',
                endTime: '2026-05-24T21:00:00',
                basePrice: 80000
            })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            logSuccess('Ràng buộc bảo trì hoạt động tốt! Hệ thống từ chối lên lịch cho phòng bảo trì.');
        } else {
            logWarning('CẢNH BÁO: Vẫn tạo được suất chiếu trong phòng đang bảo trì! Cần kiểm tra logic validator.');
        }

        // Khôi phục phòng hoạt động bình thường
        await fetch(`${BASE_URL}/api/cinemas/${cinemaId}/rooms/${roomId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                name: 'Phòng IMAX VIP',
                type: 'IMAX',
                totalSeats: 2,
                rows: 1,
                columns: 2,
                underMaintenance: false
            })
        });
        logInfo('Đã khôi phục phòng sang trạng thái hoạt động bình thường (underMaintenance = false).');
    } catch (e) {
        logError('Kiểm tra ràng buộc phòng bảo trì thất bại!', e.message);
    }

    // 6. Tạo suất chiếu mới hợp lệ (Showtime)
    try {
        logInfo('Tạo suất chiếu hợp lệ cho phim...');
        const res = await fetch(`${BASE_URL}/api/showtimes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                roomId: roomId,
                movieId: movieId,
                startTime: '2026-05-24T19:00:00',
                endTime: '2026-05-24T21:00:00',
                basePrice: 80000
            })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showtimeId = data.data.id;
            logSuccess(`Tạo suất chiếu thành công! Showtime ID: ${showtimeId}`);
        } else {
            throw new Error(data.message || 'Tạo suất chiếu lỗi');
        }
    } catch (e) {
        logError('Tạo suất chiếu thất bại!', e.message);
        return;
    }


    // ==========================================
    // FLOW 3: REAL-TIME SEAT HOLDING & SEARCH
    // ==========================================
    logHeader('FLOW 3: TÌM KIẾM DANH MỤC & GIỮ GHẾ THỜI GIAN THỰC');

    // 1. Kiểm tra tìm kiếm phim và sự kiện (Catalog Search)
    try {
        logInfo(`Tìm kiếm danh mục phim với từ khóa: "${randomSuffix}"`);
        const res = await fetch(`${BASE_URL}/api/catalog/search?keyword=${randomSuffix}`);
        const data = await res.json();
        if (res.ok && data.success) {
            logSuccess(`Tìm kiếm thành công! Số lượng phim khớp: ${data.data.movies.length}`);
        } else {
            throw new Error(data.message || 'Tìm kiếm lỗi');
        }
    } catch (e) {
        logError('Tìm kiếm danh mục thất bại!', e.message);
    }

    // 2. Lấy sơ đồ ghế của suất chiếu (Showtime Seat Map)
    try {
        logInfo(`Lấy sơ đồ ghế của suất chiếu ID: ${showtimeId}`);
        const res = await fetch(`${BASE_URL}/api/showtimes/${showtimeId}/seats`);
        const data = await res.json();
        if (res.ok && data.success && data.data.length > 0) {
            seatId = data.data[0].id;
            logSuccess(`Lấy sơ đồ ghế thành công! Ghế trống ID đầu tiên tìm thấy: ${seatId}`);
        } else {
            throw new Error(data.message || 'Lấy ghế lỗi');
        }
    } catch (e) {
        logError('Lấy sơ đồ ghế thất bại!', e.message);
        return;
    }

    // 3. Giữ ghế thời gian thực bằng Redis (Hold Seat)
    try {
        logInfo(`Khách hàng giữ ghế ID: ${seatId} trong 10 phút...`);
        const res = await fetch(`${BASE_URL}/api/showtimes/${showtimeId}/hold`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${customerToken}`
            },
            body: JSON.stringify({
                seatIds: [seatId]
            })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            logSuccess('Giữ ghế bằng Redis thành công! Ghế đã chuyển sang trạng thái HELD.');
        } else {
            throw new Error(data.message || 'Giữ ghế lỗi');
        }
    } catch (e) {
        logError('Giữ ghế thời gian thực thất bại!', e.message);
        return;
    }


    // ==========================================
    // FLOW 4: ORDER & PAYMENT & TICKET CHECK-IN
    // ==========================================
    logHeader('FLOW 4: ĐẶT VÉ, THANH TOÁN & KIỂM TRA VÉ');

    // 1. Tạo đơn hàng (Create Order)
    try {
        logInfo('Tạo đơn hàng mua vé...');
        const res = await fetch(`${BASE_URL}/api/orders`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${customerToken}`
            },
            body: JSON.stringify({
                userId: customerUserId,
                showtimeId: showtimeId,
                seatIds: [seatId],
                voucherCode: ''
            })
        });
        
        // Nhận trực tiếp thực thể Order
        if (res.ok) {
            const data = await res.json();
            orderId = data.id;
            logSuccess(`Tạo đơn hàng thành công! Order ID: ${orderId}, Tổng tiền: ${data.finalAmount} VND`);
        } else {
            const errData = await res.json();
            throw new Error(errData.message || 'Tạo đơn hàng lỗi');
        }
    } catch (e) {
        logError('Tạo đơn hàng thất bại!', e.message);
        return;
    }

    // 2. Thanh toán hóa đơn (Pay Order)
    try {
        logInfo(`Thanh toán đơn hàng ID: ${orderId} bằng ví điện tử ZALOPAY...`);
        const res = await fetch(`${BASE_URL}/api/orders/${orderId}/pay`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${customerToken}`
            },
            body: JSON.stringify({
                paymentMethod: 'ZALOPAY',
                transactionId: `txn_auto_${randomSuffix}`
            })
        });
        if (res.ok) {
            const data = await res.json();
            logSuccess(`Thanh toán thành công! Trạng thái đơn hàng: ${data.status}`);
        } else {
            const errData = await res.json();
            throw new Error(errData.message || 'Thanh toán lỗi');
        }
    } catch (e) {
        logError('Thanh toán đơn hàng thất bại!', e.message);
        return;
    }

    // 3. Lấy vé đã phát hành của đơn hàng
    try {
        logInfo(`Lấy danh sách vé đã phát hành của đơn hàng ID: ${orderId}`);
        const res = await fetch(`${BASE_URL}/api/tickets/orders/${orderId}`, {
            headers: { 
                'Authorization': `Bearer ${customerToken}`
            }
        });
        if (res.ok) {
            const tickets = await res.json();
            if (tickets.length > 0) {
                ticketCode = tickets[0].ticketCode;
                logSuccess(`Phát hành vé thành công! Mã vé QR của bạn là: ${ticketCode}`);
            } else {
                throw new Error('Đơn hàng không có vé nào');
            }
        } else {
            throw new Error('Không thể lấy danh sách vé');
        }
    } catch (e) {
        logError('Lấy thông tin vé phát hành thất bại!', e.message);
        return;
    }

    // 4. Kiểm tra vé và Check-in (Check-in QR Code)
    try {
        logInfo(`Nhân viên rạp quét QR code check-in cho mã vé: ${ticketCode}`);
        const res = await fetch(`${BASE_URL}/api/tickets/check-in`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({ ticketCode: ticketCode })
        });
        if (res.ok) {
            const ticket = await res.json();
            logSuccess(`Check-in thành công! Trạng thái vé: ${ticket.status}, Giờ quét: ${ticket.checkedInAt}`);
        } else {
            const errData = await res.json();
            throw new Error(errData.message || 'Quét vé lỗi');
        }
    } catch (e) {
        logError('Quét vé check-in thất bại!', e.message);
    }


    // ==========================================
    // FLOW 5: SAFETY CONSTRAINTS & CLEANUP
    // ==========================================
    logHeader('FLOW 5: RÀNG BUỘC TOÀN VẸN DỮ LIỆU PHÒNG/RẠP CHIẾU');

    // 1. Thử ngừng hoạt động Rạp có suất chiếu hoạt động trong tương lai -> Phải bị chặn!
    try {
        logInfo(`Yêu cầu ngừng hoạt động (xóa) Rạp ID: ${cinemaId} đang có suất chiếu tương lai...`);
        const res = await fetch(`${BASE_URL}/api/cinemas/${cinemaId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        if (res.status === 409 || !data.success) {
            logSuccess(`Ràng buộc toàn vẹn hoạt động tốt! Hệ thống từ chối xóa Rạp vì lý do: "${data.message}"`);
        } else {
            logWarning('CẢNH BÁO: Rạp chiếu có suất chiếu tương lai đã bị xóa! Cần kiểm tra logic EntityManager check showtimes.');
        }
    } catch (e) {
        logError('Kiểm thử ràng buộc xóa rạp thất bại!', e.message);
    }

    // 2. Thử ngừng hoạt động Phòng chiếu có suất chiếu hoạt động trong tương lai -> Phải bị chặn!
    try {
        logInfo(`Yêu cầu ngừng hoạt động (xóa) Phòng ID: ${roomId} đang có suất chiếu tương lai...`);
        const res = await fetch(`${BASE_URL}/api/cinemas/${cinemaId}/rooms/${roomId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        if (res.status === 409 || !data.success) {
            logSuccess(`Ràng buộc toàn vẹn hoạt động tốt! Hệ thống từ chối xóa Phòng chiếu vì lý do: "${data.message}"`);
        } else {
            logWarning('CẢNH BÁO: Phòng chiếu có suất chiếu tương lai đã bị xóa! Cần kiểm tra logic EntityManager check showtimes.');
        }
    } catch (e) {
        logError('Kiểm thử ràng buộc xóa phòng chiếu thất bại!', e.message);
    }

    console.log(`\n${COLORS.bright}${COLORS.magenta}=============================================================`);
    console.log('      HOÀN TẤT KỊCH BẢN THỬ NGHIỆM HỆ THỐNG ĐẶT VÉ           ');
    console.log(`=============================================================${COLORS.reset}`);
}

runTests();
