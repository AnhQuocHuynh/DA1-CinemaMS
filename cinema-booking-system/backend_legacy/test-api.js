/**
 * Cinema Booking System - Automated E2E System Integration Test Script
 * 
 * YÃªu cáº§u: Node.js version 18+ (Ä‘á»ƒ sá»­ dá»¥ng API fetch tÃ­ch há»£p sáºµn).
 * CÃ¡ch cháº¡y: node test-api.js
 */

const BASE_URL = 'http://localhost:8080';

// Cáº¥u hÃ¬nh tÃ i khoáº£n thá»­ nghiá»‡m
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
    console.log(`${COLORS.green}âœ” [SUCCESS] ${msg}${COLORS.reset}`);
}

function logInfo(msg) {
    console.log(`${COLORS.cyan}â„¹ [INFO] ${msg}${COLORS.reset}`);
}

function logWarning(msg) {
    console.log(`${COLORS.yellow}âš  [WARNING] ${msg}${COLORS.reset}`);
}

function logError(msg, err = '') {
    console.log(`${COLORS.red}âœ˜ [FAILED] ${msg} ${err}${COLORS.reset}`);
}

function unwrapData(payload) {
    return payload && Object.prototype.hasOwnProperty.call(payload, 'data') ? payload.data : payload;
}

function isApiSuccess(res, payload) {
    return res.ok && (payload.success === undefined || payload.success === true);
}

function formatLocalDateTime(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
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
    
    // SiÃªu dá»¯ liá»‡u ráº¡p/phÃ²ng/phim táº¡o ra trong lÃºc test
    let cinemaId = null;
    let roomId = null;
    let movieId = null;
    let showtimeId = null;
    let seatId = null;
    let orderId = null;
    let ticketCode = '';
    const futureStart = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    futureStart.setHours(19, 0, 0, 0);
    const futureEnd = new Date(futureStart.getTime() + 2 * 60 * 60 * 1000);
    const futureStartText = formatLocalDateTime(futureStart);
    const futureEndText = formatLocalDateTime(futureEnd);

    // ==========================================
    // FLOW 1: AUTHENTICATION & PROFILE (CUSTOMER)
    // ==========================================
    logHeader('FLOW 1: ÄÄ‚NG KÃ & XÃC THá»°C KHÃCH HÃ€NG');

    // 1. ÄÄƒng kÃ½ khÃ¡ch hÃ ng má»›i
    try {
        logInfo(`ÄÄƒng kÃ½ khÃ¡ch hÃ ng má»›i: ${customerEmail}`);
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
            logSuccess('ÄÄƒng kÃ½ tÃ i khoáº£n khÃ¡ch hÃ ng thÃ nh cÃ´ng!');
        } else {
            throw new Error(data.message || 'ÄÄƒng kÃ½ lá»—i');
        }
    } catch (e) {
        logError('ÄÄƒng kÃ½ khÃ¡ch hÃ ng tháº¥t báº¡i!', e.message);
        return;
    }

    // 2. ÄÄƒng nháº­p khÃ¡ch hÃ ng
    try {
        logInfo(`ÄÄƒng nháº­p khÃ¡ch hÃ ng: ${customerEmail}`);
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
            logSuccess(`ÄÄƒng nháº­p thÃ nh cÃ´ng! User ID: ${customerUserId}`);
            logInfo(`Access Token: Bearer ${customerToken.substring(0, 15)}...`);
            logInfo(`Refresh Token: ${customerRefreshToken.substring(0, 15)}...`);
        } else {
            throw new Error(data.message || 'ÄÄƒng nháº­p lá»—i');
        }
    } catch (e) {
        logError('ÄÄƒng nháº­p khÃ¡ch hÃ ng tháº¥t báº¡i!', e.message);
        return;
    }

    // 3. Láº¥y profile cÃ¡ nhÃ¢n (Bá»c ApiResponse + DTO)
    try {
        logInfo(`Láº¥y thÃ´ng tin tÃ i khoáº£n cá»§a chÃ­nh mÃ¬nh (User ID: ${customerUserId})`);
        const res = await fetch(`${BASE_URL}/api/users/${customerUserId}`, {
            headers: { 'Authorization': `Bearer ${customerToken}` }
        });
        const data = await res.json();
        if (res.ok && data.success) {
            logSuccess(`Láº¥y há»“ sÆ¡ cÃ¡ nhÃ¢n thÃ nh cÃ´ng! TÃªn: ${data.data.fullName}`);
        } else {
            throw new Error(data.message || 'Láº¥y há»“ sÆ¡ lá»—i');
        }
    } catch (e) {
        logError('Láº¥y há»“ sÆ¡ cÃ¡ nhÃ¢n tháº¥t báº¡i!', e.message);
    }

    // 4. Thá»­ láº¥y danh sÃ¡ch toÃ n bá»™ User (YÃªu cáº§u ADMIN -> Pháº£i bá»‹ cháº·n 403 Forbidden)
    try {
        logInfo('Kiá»ƒm tra Role Guard: KhÃ¡ch hÃ ng thÆ°á»ng thá»­ láº¥y danh sÃ¡ch toÃ n bá»™ User...');
        const res = await fetch(`${BASE_URL}/api/users`, {
            headers: { 'Authorization': `Bearer ${customerToken}` }
        });
        const data = await res.json();
        if (res.status === 403 || !data.success) {
            logSuccess('Role Guard hoáº¡t Ä‘á»™ng tá»‘t! Há»‡ thá»‘ng tá»« chá»‘i quyá»n truy cáº­p (403 Forbidden).');
        } else {
            logWarning('Cáº¢NH BÃO: KhÃ¡ch hÃ ng thÆ°á»ng cÃ³ thá»ƒ láº¥y danh sÃ¡ch User! Cáº§n xem láº¡i phÃ¢n quyá»n.');
        }
    } catch (e) {
        logError('Kiá»ƒm thá»­ Role Guard tháº¥t báº¡i!', e.message);
    }

    // 5. Thá»­ lÃ m má»›i Token (Refresh Token Lifecycle)
    try {
        logInfo('Kiá»ƒm tra lÃ m má»›i Access Token báº±ng Refresh Token...');
        const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: customerRefreshToken })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            customerToken = data.data.accessToken;
            logSuccess('LÃ m má»›i Token thÃ nh cÃ´ng! ÄÃ£ cáº­p nháº­t Access Token má»›i.');
        } else {
            throw new Error(data.message || 'Refresh lá»—i');
        }
    } catch (e) {
        logError('LÃ m má»›i Token tháº¥t báº¡i!', e.message);
    }


    // ==========================================
    // FLOW 2: ADMIN SETUP (CINEMA, ROOM, MOVIE, SHOWTIME)
    // ==========================================
    logHeader('FLOW 2: THIáº¾T Láº¬P Dá»® LIá»†U RAP/PHÃ’NG/PHIM (ADMIN)');

    // 1. ÄÄƒng nháº­p Admin
    try {
        logInfo(`ÄÄƒng nháº­p tÃ i khoáº£n Admin: ${ADMIN_EMAIL}`);
        const res = await fetch(`${BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            adminToken = data.data.accessToken;
            logSuccess('ÄÄƒng nháº­p Admin thÃ nh cÃ´ng!');
        } else {
            logWarning(`ÄÄƒng nháº­p Admin tháº¥t báº¡i (Lá»—i: ${data.message}). Vui lÃ²ng cháº¯c cháº¯n Ä‘Ã£ seed tÃ i khoáº£n Admin.`);
            logWarning('Bá» qua cÃ¡c bÆ°á»›c Admin nháº¡y cáº£m. Tiáº¿p tá»¥c test cÃ¡c API Public.');
            return;
        }
    } catch (e) {
        logError('KhÃ´ng thá»ƒ káº¿t ná»‘i API ÄÄƒng nháº­p Admin!', e.message);
        return;
    }

    // 2. Táº¡o ráº¡p má»›i (Cinema)
    try {
        logInfo('Táº¡o ráº¡p chiáº¿u má»›i...');
        const res = await fetch(`${BASE_URL}/api/cinemas`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                name: `CGV HÃ¹ng VÆ°Æ¡ng Plaza #${randomSuffix}`,
                address: '126 HÃ¹ng VÆ°Æ¡ng, Quáº­n 5, TP. HCM',
                city: 'Há»“ ChÃ­ Minh',
                phone: '02838350000'
            })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            cinemaId = data.data.id;
            logSuccess(`Táº¡o ráº¡p thÃ nh cÃ´ng! Cinema ID: ${cinemaId}`);
        } else {
            throw new Error(data.message || 'Táº¡o ráº¡p lá»—i');
        }
    } catch (e) {
        logError('Táº¡o ráº¡p chiáº¿u tháº¥t báº¡i!', e.message);
        return;
    }

    // 3. Táº¡o phÃ²ng chiáº¿u má»›i (Room)
    try {
        logInfo(`Táº¡o phÃ²ng chiáº¿u cho Ráº¡p ID: ${cinemaId}`);
        const res = await fetch(`${BASE_URL}/api/cinemas/${cinemaId}/rooms`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                name: 'PhÃ²ng IMAX VIP',
                type: 'IMAX',
                totalSeats: 2,
                rows: 1,
                columns: 2
            })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            roomId = data.data.id;
            logSuccess(`Táº¡o phÃ²ng thÃ nh cÃ´ng! Room ID: ${roomId}`);
        } else {
            throw new Error(data.message || 'Táº¡o phÃ²ng lá»—i');
        }
    } catch (e) {
        logError('Táº¡o phÃ²ng chiáº¿u tháº¥t báº¡i!', e.message);
        return;
    }

    // 4. Táº¡o phim má»›i (Movie)
    try {
        logInfo('Táº¡o phim má»›i trong danh má»¥c...');
        const res = await fetch(`${BASE_URL}/api/movies`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                title: `HÃ nh trÃ¬nh vÃ´ táº­n #${randomSuffix}`,
                description: 'Má»™t tÃ¡c pháº©m Ä‘iá»‡n áº£nh bom táº¥n xuáº¥t sáº¯c.',
                durationMinutes: 120,
                releaseDate: futureStartText.substring(0, 10),
                ageRating: 'T16',
                posterUrl: 'http://example.com/poster.jpg',
                trailerUrl: 'http://example.com/trailer.mp4',
                language: 'Tiáº¿ng Viá»‡t',
                genreIds: []
            })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            movieId = data.data.id;
            logSuccess(`Táº¡o phim thÃ nh cÃ´ng! Movie ID: ${movieId}`);
        } else {
            throw new Error(data.message || 'Táº¡o phim lá»—i');
        }
    } catch (e) {
        logError('Táº¡o phim tháº¥t báº¡i!', e.message);
        return;
    }

    // 5. Kiá»ƒm tra phÃ²ng báº£o trÃ¬ (Maintenance Status Constraints)
    try {
        logInfo('Kiá»ƒm tra tÃ­nh nÄƒng báº£o trÃ¬ phÃ²ng chiáº¿u...');
        // Äáº·t phÃ²ng sang tráº¡ng thÃ¡i báº£o trÃ¬
        await fetch(`${BASE_URL}/api/cinemas/${cinemaId}/rooms/${roomId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                name: 'PhÃ²ng IMAX VIP',
                type: 'IMAX',
                totalSeats: 2,
                rows: 1,
                columns: 2,
                underMaintenance: true
            })
        });
        logInfo('ÄÃ£ chuyá»ƒn phÃ²ng sang tráº¡ng thÃ¡i underMaintenance = true.');

        // Thá»­ táº¡o lá»‹ch chiáº¿u trong phÃ²ng Ä‘ang báº£o trÃ¬ -> Pháº£i bá»‹ cháº·n!
        logInfo('Thá»­ táº¡o suáº¥t chiáº¿u má»›i trong phÃ²ng Ä‘ang báº£o trÃ¬...');
        const res = await fetch(`${BASE_URL}/api/showtimes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                roomId: roomId,
                movieId: movieId,
                startTime: futureStartText,
                endTime: futureEndText,
                basePrice: 80000
            })
        });
        const data = await res.json();
        if (!res.ok || !data.success) {
            logSuccess('RÃ ng buá»™c báº£o trÃ¬ hoáº¡t Ä‘á»™ng tá»‘t! Há»‡ thá»‘ng tá»« chá»‘i lÃªn lá»‹ch cho phÃ²ng báº£o trÃ¬.');
        } else {
            logWarning('Cáº¢NH BÃO: Váº«n táº¡o Ä‘Æ°á»£c suáº¥t chiáº¿u trong phÃ²ng Ä‘ang báº£o trÃ¬! Cáº§n kiá»ƒm tra logic validator.');
        }

        // KhÃ´i phá»¥c phÃ²ng hoáº¡t Ä‘á»™ng bÃ¬nh thÆ°á»ng
        await fetch(`${BASE_URL}/api/cinemas/${cinemaId}/rooms/${roomId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                name: 'PhÃ²ng IMAX VIP',
                type: 'IMAX',
                totalSeats: 2,
                rows: 1,
                columns: 2,
                underMaintenance: false
            })
        });
        logInfo('ÄÃ£ khÃ´i phá»¥c phÃ²ng sang tráº¡ng thÃ¡i hoáº¡t Ä‘á»™ng bÃ¬nh thÆ°á»ng (underMaintenance = false).');
    } catch (e) {
        logError('Kiá»ƒm tra rÃ ng buá»™c phÃ²ng báº£o trÃ¬ tháº¥t báº¡i!', e.message);
    }

    // 6. Táº¡o suáº¥t chiáº¿u má»›i há»£p lá»‡ (Showtime)
    try {
        logInfo('Táº¡o suáº¥t chiáº¿u há»£p lá»‡ cho phim...');
        const res = await fetch(`${BASE_URL}/api/showtimes`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${adminToken}`
            },
            body: JSON.stringify({
                roomId: roomId,
                movieId: movieId,
                startTime: futureStartText,
                endTime: futureEndText,
                basePrice: 80000
            })
        });
        const data = await res.json();
        if (res.ok && data.success) {
            showtimeId = data.data.id;
            logSuccess(`Táº¡o suáº¥t chiáº¿u thÃ nh cÃ´ng! Showtime ID: ${showtimeId}`);
        } else {
            throw new Error(data.message || 'Táº¡o suáº¥t chiáº¿u lá»—i');
        }
    } catch (e) {
        logError('Táº¡o suáº¥t chiáº¿u tháº¥t báº¡i!', e.message);
        return;
    }


    // ==========================================
    // FLOW 3: REAL-TIME SEAT HOLDING & SEARCH
    // ==========================================
    logHeader('FLOW 3: TÃŒM KIáº¾M DANH Má»¤C & GIá»® GHáº¾ THá»œI GIAN THá»°C');

    // 1. Kiá»ƒm tra tÃ¬m kiáº¿m phim vÃ  sá»± kiá»‡n (Catalog Search)
    try {
        logInfo(`TÃ¬m kiáº¿m danh má»¥c phim vá»›i tá»« khÃ³a: "${randomSuffix}"`);
        const res = await fetch(`${BASE_URL}/api/catalog/search?keyword=${randomSuffix}`);
        const data = await res.json();
        if (res.ok && data.success) {
            logSuccess(`TÃ¬m kiáº¿m thÃ nh cÃ´ng! Sá»‘ lÆ°á»£ng phim khá»›p: ${data.data.movies.length}`);
        } else {
            throw new Error(data.message || 'TÃ¬m kiáº¿m lá»—i');
        }
    } catch (e) {
        logError('TÃ¬m kiáº¿m danh má»¥c tháº¥t báº¡i!', e.message);
    }

    // 2. Láº¥y sÆ¡ Ä‘á»“ gháº¿ cá»§a suáº¥t chiáº¿u (Showtime Seat Map)
    try {
        logInfo(`Láº¥y sÆ¡ Ä‘á»“ gháº¿ cá»§a suáº¥t chiáº¿u ID: ${showtimeId}`);
        const res = await fetch(`${BASE_URL}/api/showtimes/${showtimeId}/seats`);
        const data = await res.json();
        const seats = unwrapData(data);
        const availableSeat = Array.isArray(seats)
            ? seats.find(seat => !seat.isPathway && (seat.status === 'available' || seat.status === 'AVAILABLE'))
            : null;
        if (isApiSuccess(res, data) && availableSeat) {
            seatId = Number(availableSeat.seatId || availableSeat.id);
            logSuccess(`Lay so do ghe thanh cong! Ghe trong dau tien: ${availableSeat.label || seatId}, loai: ${availableSeat.seatTypeCode || availableSeat.seatType}`);
        } else {
            throw new Error(data.message || 'Lay ghe loi');
        }
    } catch (e) {
        logError('Láº¥y sÆ¡ Ä‘á»“ gháº¿ tháº¥t báº¡i!', e.message);
        return;
    }

    // 3. Giá»¯ gháº¿ thá»i gian thá»±c báº±ng Redis (Hold Seat)
    try {
        logInfo(`KhÃ¡ch hÃ ng giá»¯ gháº¿ ID: ${seatId} trong 10 phÃºt...`);
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
            logSuccess('Giá»¯ gháº¿ báº±ng Redis thÃ nh cÃ´ng! Gháº¿ Ä‘Ã£ chuyá»ƒn sang tráº¡ng thÃ¡i HELD.');
        } else {
            throw new Error(data.message || 'Giá»¯ gháº¿ lá»—i');
        }
    } catch (e) {
        logError('Giá»¯ gháº¿ thá»i gian thá»±c tháº¥t báº¡i!', e.message);
        return;
    }


    // ==========================================
    // FLOW 4: ORDER & PAYMENT & TICKET CHECK-IN
    // ==========================================
    logHeader('FLOW 4: Äáº¶T VÃ‰, THANH TOÃN & KIá»‚M TRA VÃ‰');

    // 1. Táº¡o Ä‘Æ¡n hÃ ng (Create Order)
    try {
        logInfo('Táº¡o Ä‘Æ¡n hÃ ng mua vÃ©...');
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
        
        if (res.ok) {
            const data = await res.json();
            const order = unwrapData(data);
            orderId = order.id;
            logSuccess(`Táº¡o Ä‘Æ¡n hÃ ng thÃ nh cÃ´ng! Order ID: ${orderId}, Tá»•ng tiá»n: ${order.finalAmount} VND, gháº¿: ${(order.seatLabels || []).join(', ')}`);
        } else {
            const errData = await res.json();
            throw new Error(errData.message || 'Táº¡o Ä‘Æ¡n hÃ ng lá»—i');
        }
    } catch (e) {
        logError('Táº¡o Ä‘Æ¡n hÃ ng tháº¥t báº¡i!', e.message);
        return;
    }

    // 2. Thanh toÃ¡n hÃ³a Ä‘Æ¡n (Pay Order)
    try {
        logInfo(`Thanh toÃ¡n Ä‘Æ¡n hÃ ng ID: ${orderId} báº±ng vÃ­ Ä‘iá»‡n tá»­ ZALOPAY...`);
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
            const paidOrder = unwrapData(data);
            if (paidOrder.tickets && paidOrder.tickets.length > 0) {
                ticketCode = paidOrder.tickets[0].ticketCode;
            }
            logSuccess(`Thanh toÃ¡n thÃ nh cÃ´ng! Tráº¡ng thÃ¡i Ä‘Æ¡n hÃ ng: ${paidOrder.status}, sá»‘ vÃ©: ${(paidOrder.tickets || []).length}`);
        } else {
            const errData = await res.json();
            throw new Error(errData.message || 'Thanh toÃ¡n lá»—i');
        }
    } catch (e) {
        logError('Thanh toÃ¡n Ä‘Æ¡n hÃ ng tháº¥t báº¡i!', e.message);
        return;
    }

    // 3. Láº¥y vÃ© Ä‘Ã£ phÃ¡t hÃ nh cá»§a Ä‘Æ¡n hÃ ng
    try {
        logInfo(`Láº¥y danh sÃ¡ch vÃ© Ä‘Ã£ phÃ¡t hÃ nh cá»§a Ä‘Æ¡n hÃ ng ID: ${orderId}`);
        const res = await fetch(`${BASE_URL}/api/tickets/orders/${orderId}`, {
            headers: { 
                'Authorization': `Bearer ${customerToken}`
            }
        });
        if (res.ok) {
            const data = await res.json();
            const tickets = unwrapData(data);
            if (tickets.length > 0) {
                ticketCode = ticketCode || tickets[0].ticketCode;
                logSuccess(`PhÃ¡t hÃ nh vÃ© thÃ nh cÃ´ng! MÃ£ vÃ© QR cá»§a báº¡n lÃ : ${ticketCode}`);
            } else {
                throw new Error('ÄÆ¡n hÃ ng khÃ´ng cÃ³ vÃ© nÃ o');
            }
        } else {
            throw new Error('KhÃ´ng thá»ƒ láº¥y danh sÃ¡ch vÃ©');
        }
    } catch (e) {
        logError('Láº¥y thÃ´ng tin vÃ© phÃ¡t hÃ nh tháº¥t báº¡i!', e.message);
        return;
    }

    // 4. Kiá»ƒm tra vÃ© vÃ  Check-in (Check-in QR Code)
    try {
        logInfo(`NhÃ¢n viÃªn ráº¡p quÃ©t QR code check-in cho mÃ£ vÃ©: ${ticketCode}`);
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
            logSuccess(`Check-in thÃ nh cÃ´ng! Tráº¡ng thÃ¡i vÃ©: ${ticket.status}, Giá» quÃ©t: ${ticket.checkedInAt}`);
        } else {
            const errData = await res.json();
            throw new Error(errData.message || 'QuÃ©t vÃ© lá»—i');
        }
    } catch (e) {
        logError('QuÃ©t vÃ© check-in tháº¥t báº¡i!', e.message);
    }


    // ==========================================
    // FLOW 5: SAFETY CONSTRAINTS & CLEANUP
    // ==========================================
    logHeader('FLOW 5: RÃ€NG BUá»˜C TOÃ€N Váº¸N Dá»® LIá»†U PHÃ’NG/Ráº P CHIáº¾U');

    // 1. Thá»­ ngá»«ng hoáº¡t Ä‘á»™ng Ráº¡p cÃ³ suáº¥t chiáº¿u hoáº¡t Ä‘á»™ng trong tÆ°Æ¡ng lai -> Pháº£i bá»‹ cháº·n!
    try {
        logInfo(`YÃªu cáº§u ngá»«ng hoáº¡t Ä‘á»™ng (xÃ³a) Ráº¡p ID: ${cinemaId} Ä‘ang cÃ³ suáº¥t chiáº¿u tÆ°Æ¡ng lai...`);
        const res = await fetch(`${BASE_URL}/api/cinemas/${cinemaId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        if (res.status === 409 || !data.success) {
            logSuccess(`RÃ ng buá»™c toÃ n váº¹n hoáº¡t Ä‘á»™ng tá»‘t! Há»‡ thá»‘ng tá»« chá»‘i xÃ³a Ráº¡p vÃ¬ lÃ½ do: "${data.message}"`);
        } else {
            logWarning('Cáº¢NH BÃO: Ráº¡p chiáº¿u cÃ³ suáº¥t chiáº¿u tÆ°Æ¡ng lai Ä‘Ã£ bá»‹ xÃ³a! Cáº§n kiá»ƒm tra logic EntityManager check showtimes.');
        }
    } catch (e) {
        logError('Kiá»ƒm thá»­ rÃ ng buá»™c xÃ³a ráº¡p tháº¥t báº¡i!', e.message);
    }

    // 2. Thá»­ ngá»«ng hoáº¡t Ä‘á»™ng PhÃ²ng chiáº¿u cÃ³ suáº¥t chiáº¿u hoáº¡t Ä‘á»™ng trong tÆ°Æ¡ng lai -> Pháº£i bá»‹ cháº·n!
    try {
        logInfo(`YÃªu cáº§u ngá»«ng hoáº¡t Ä‘á»™ng (xÃ³a) PhÃ²ng ID: ${roomId} Ä‘ang cÃ³ suáº¥t chiáº¿u tÆ°Æ¡ng lai...`);
        const res = await fetch(`${BASE_URL}/api/cinemas/${cinemaId}/rooms/${roomId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        const data = await res.json();
        if (res.status === 409 || !data.success) {
            logSuccess(`RÃ ng buá»™c toÃ n váº¹n hoáº¡t Ä‘á»™ng tá»‘t! Há»‡ thá»‘ng tá»« chá»‘i xÃ³a PhÃ²ng chiáº¿u vÃ¬ lÃ½ do: "${data.message}"`);
        } else {
            logWarning('Cáº¢NH BÃO: PhÃ²ng chiáº¿u cÃ³ suáº¥t chiáº¿u tÆ°Æ¡ng lai Ä‘Ã£ bá»‹ xÃ³a! Cáº§n kiá»ƒm tra logic EntityManager check showtimes.');
        }
    } catch (e) {
        logError('Kiá»ƒm thá»­ rÃ ng buá»™c xÃ³a phÃ²ng chiáº¿u tháº¥t báº¡i!', e.message);
    }

    console.log(`\n${COLORS.bright}${COLORS.magenta}=============================================================`);
    console.log('      HOÃ€N Táº¤T Ká»ŠCH Báº¢N THá»¬ NGHIá»†M Há»† THá»NG Äáº¶T VÃ‰           ');
    console.log(`=============================================================${COLORS.reset}`);
}

runTests();

