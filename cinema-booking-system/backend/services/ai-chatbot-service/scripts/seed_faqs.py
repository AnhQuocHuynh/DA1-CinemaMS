"""Seed cinema FAQ/policy entries with embeddings into faq_embeddings.

Run: python -m scripts.seed_faqs
"""
import asyncio
import json
import logging
from typing import Any

import asyncpg

from app.core.config import settings
from app.db.session import init_db
from app.services import llm_client
from app.services.cache_service import vector_literal

logger = logging.getLogger("cinebot.seed")

FAQS: list[dict[str, Any]] = [
    {
        "category": "REFUND",
        "question": "What is the ticket cancellation and refund policy?",
        "answer": (
            "Standard tickets can be cancelled and refunded up to 60 minutes before "
            "the scheduled showtime with a 10% processing fee. Cancellations made "
            "less than 60 minutes before showtime are not eligible for a refund."
        ),
        "metadata": {"cutoff_minutes": 60, "fee_percent": 10},
    },
    {
        "category": "REFUND",
        "question": "Are VIP tickets and Couple seats refundable?",
        "answer": (
            "No. VIP seats and Couple seats are strictly non-refundable and cannot "
            "be cancelled once payment is confirmed."
        ),
        "metadata": {"seat_classes": ["VIP", "COUPLE"], "refundable": False},
    },
    {
        "category": "SEAT_CLASSES",
        "question": "What seat classes and screening room types are available?",
        "answer": (
            "Our cinemas offer Standard seats for regular viewing, VIP leather recliner "
            "seats in prime center rows, Couple seats designed for two guests, and "
            "specialty IMAX / 3D halls with enhanced screen and audio systems."
        ),
        "metadata": {"seat_classes": ["Standard", "VIP", "Couple", "IMAX"]},
    },
    {
        "category": "PAYMENT",
        "question": "What payment methods are accepted and how long are seats held?",
        "answer": (
            "Online bookings accept Stripe (credit/debit cards), PayPal, and VNPay. "
            "You can also purchase tickets with Cash at the cinema counter. Selected "
            "seats are held for 10 minutes while you complete checkout."
        ),
        "metadata": {"methods": ["Stripe", "PayPal", "VNPay", "Cash"], "hold_minutes": 10},
    },
    {
        "category": "CONCESSIONS",
        "question": "What is the food, beverage, and outside snacks policy?",
        "answer": (
            "Popcorn, soft drinks, and snack combos can be purchased at the cinema "
            "concession counter before your movie. Outside food and beverages are not "
            "permitted inside screening rooms, except for bottled water and infant food."
        ),
        "metadata": {"outside_food_allowed": False},
    },
    {
        "category": "AGE_RATINGS",
        "question": "What do the movie age ratings P, K, T13, T16, T18, and C mean?",
        "answer": (
            "P: Suitable for all audiences. K: Under 13 allowed with a parent or guardian. "
            "T13: Viewers 13 years and older. T16: Viewers 16 years and older. "
            "T18: Viewers 18 years and older (valid photo ID required at entry). "
            "C: Prohibited from public screening."
        ),
        "metadata": {"ratings": ["P", "K", "T13", "T16", "T18", "C"]},
    },
    {
        "category": "BOOKING",
        "question": "How do I book movie tickets online?",
        "answer": (
            "Choose a movie and showtime, pick your preferred seats on the seat map "
            "(held for 10 minutes), review your order summary, and complete payment via "
            "Stripe, PayPal, or VNPay. Your digital ticket QR code appears immediately "
            "in My Bookings once payment succeeds."
        ),
        "metadata": {"flow": "showtime -> seats -> checkout -> QR"},
    },
    {
        "category": "ROOM_RENTAL",
        "question": "How does private cinema room rental work?",
        "answer": (
            "Customers can request private screening room rentals for events or group "
            "viewings on the Room Rental page. Slots include a 15-minute turnover buffer "
            "around scheduled showtimes. Online rentals transition to Confirmed once "
            "payment is completed, while counter cash requires staff confirmation."
        ),
        "metadata": {"buffer_minutes": 15},
    },
    {
        "category": "REFUND",
        "question": "Chính sách hủy và hoàn vé như thế nào?",
        "answer": (
            "Vé thường có thể hủy và hoàn tiền trước giờ chiếu tối thiểu 60 phút với "
            "phí xử lý 10%. Nếu hủy muộn hơn 60 phút trước giờ chiếu, vé sẽ không được hoàn tiền."
        ),
        "metadata": {"cutoff_minutes": 60, "fee_percent": 10, "lang": "vi"},
    },
    {
        "category": "REFUND",
        "question": "Ghế VIP và ghế đôi có được hoàn tiền không?",
        "answer": (
            "Không. Ghế VIP và ghế đôi (Couple) không áp dụng chính sách hoàn tiền "
            "và không thể hủy sau khi thanh toán đã được xác nhận."
        ),
        "metadata": {"seat_classes": ["VIP", "COUPLE"], "refundable": False, "lang": "vi"},
    },
    {
        "category": "SEAT_CLASSES",
        "question": "Rạp có những loại ghế và phòng chiếu nào?",
        "answer": (
            "Hệ thống rạp có ghế Thường (Standard), ghế VIP bọc da ngả lưng ở hàng trung tâm, "
            "ghế đôi (Couple) cho 2 người và phòng chiếu đặc biệt IMAX / 3D với màn hình "
            "và âm thanh sống động."
        ),
        "metadata": {"seat_classes": ["Standard", "VIP", "Couple", "IMAX"], "lang": "vi"},
    },
    {
        "category": "PAYMENT",
        "question": "Rạp chấp nhận những phương thức thanh toán nào?",
        "answer": (
            "Đặt vé trực tuyến hỗ trợ Stripe (thẻ tín dụng/ghi nợ), PayPal và VNPay. "
            "Bạn cũng có thể thanh toán bằng tiền mặt tại quầy. Ghế đã chọn được giữ "
            "trong 10 phút khi thanh toán."
        ),
        "metadata": {"methods": ["Stripe", "PayPal", "VNPay", "Cash"], "hold_minutes": 10, "lang": "vi"},
    },
    {
        "category": "CONCESSIONS",
        "question": "Chính sách bắp nước và mang đồ ăn bên ngoài vào rạp ra sao?",
        "answer": (
            "Bạn có thể mua bắp rang bơ, nước ngọt và combo tại quầy trước khi vào phòng chiếu. "
            "Không được mang đồ ăn, thức uống bên ngoài vào phòng chiếu, trừ nước suối đóng chai "
            "và thức ăn cho trẻ nhỏ."
        ),
        "metadata": {"outside_food_allowed": False, "lang": "vi"},
    },
    {
        "category": "AGE_RATINGS",
        "question": "Ý nghĩa phân loại độ tuổi P, K, T13, T16, T18 và C là gì?",
        "answer": (
            "P: Phù hợp mọi độ tuổi. K: Dưới 13 tuổi cần có phụ huynh đi kèm. "
            "T13: Khán giả từ 13 tuổi trở lên. T16: Từ 16 tuổi trở lên. "
            "T18: Từ 18 tuổi trở lên (cần xuất trình giấy tờ tùy thân có ảnh). "
            "C: Cấm phổ biến."
        ),
        "metadata": {"ratings": ["P", "K", "T13", "T16", "T18", "C"], "lang": "vi"},
    },
    {
        "category": "BOOKING",
        "question": "Làm sao để đặt vé xem phim trực tuyến?",
        "answer": (
            "Chọn phim và suất chiếu, chọn ghế trên sơ đồ (giữ chỗ 10 phút), kiểm tra "
            "thông tin đơn hàng rồi thanh toán qua Stripe, PayPal hoặc VNPay. Mã QR vé "
            "điện tử sẽ hiển thị ngay trong mục Vé của tôi."
        ),
        "metadata": {"flow": "showtime -> seats -> checkout -> QR", "lang": "vi"},
    },
    {
        "category": "ROOM_RENTAL",
        "question": "Quy định thuê phòng chiếu phim riêng như thế nào?",
        "answer": (
            "Khách hàng có thể đặt thuê phòng chiếu riêng cho sự kiện hoặc nhóm trên trang "
            "Thuê phòng. Mỗi khung giờ có khoảng đệm 15 phút dọn phòng quanh các suất chiếu; "
            "thanh toán online xác nhận tự động, thanh toán tiền mặt cần nhân viên xác nhận."
        ),
        "metadata": {"buffer_minutes": 15, "lang": "vi"},
    },
]


async def seed_faqs(conn: Any = None) -> int:
    """Embed and upsert FAQS into faq_embeddings; returns count of seeded rows."""
    owns_conn = conn is None
    if owns_conn:
        await init_db()
        dsn = settings.POSTGRES_URL.replace("postgresql+asyncpg://", "postgresql://", 1)
        conn = await asyncpg.connect(dsn)

    count = 0
    try:
        for faq in FAQS:
            embedding = await llm_client.embed(f"{faq['question']}\n{faq['answer']}")
            vec = vector_literal(embedding)
            metadata_json = json.dumps(faq.get("metadata") or {})
            existing_id = await conn.fetchval(
                "SELECT id FROM faq_embeddings WHERE question = $1 LIMIT 1",
                faq["question"],
            )
            if existing_id is not None:
                await conn.execute(
                    """
                    UPDATE faq_embeddings
                    SET category = $1,
                        answer = $2,
                        embedding = $3::vector,
                        metadata = $4::jsonb,
                        updated_at = NOW()
                    WHERE id = $5
                    """,
                    faq["category"],
                    faq["answer"],
                    vec,
                    metadata_json,
                    existing_id,
                )
            else:
                await conn.execute(
                    """
                    INSERT INTO faq_embeddings (category, question, answer, embedding, metadata)
                    VALUES ($1, $2, $3, $4::vector, $5::jsonb)
                    """,
                    faq["category"],
                    faq["question"],
                    faq["answer"],
                    vec,
                    metadata_json,
                )
            count += 1
    finally:
        if owns_conn:
            await conn.close()
    return count


async def main() -> None:
    count = await seed_faqs()
    logger.info("Seeded %d FAQ entries into faq_embeddings", count)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(main())
