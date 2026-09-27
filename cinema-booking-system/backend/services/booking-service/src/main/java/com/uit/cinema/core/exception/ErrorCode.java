package com.uit.cinema.core.exception;

import lombok.Getter;
import org.springframework.http.HttpStatus;

@Getter
public enum ErrorCode {
    // General System Errors
    INTERNAL_ERROR("INTERNAL_ERROR", "Lỗi hệ thống, vui lòng thử lại sau", HttpStatus.INTERNAL_SERVER_ERROR),
    UNAUTHORIZED("UNAUTHORIZED", "Không có quyền truy cập / Chưa đăng nhập", HttpStatus.UNAUTHORIZED),
    FORBIDDEN("FORBIDDEN", "Bạn không có quyền thực hiện thao tác này", HttpStatus.FORBIDDEN),
    INVALID_INPUT("INVALID_INPUT", "Dữ liệu đầu vào không hợp lệ", HttpStatus.BAD_REQUEST),
    RESOURCE_NOT_FOUND("RESOURCE_NOT_FOUND", "Tài nguyên không tồn tại", HttpStatus.NOT_FOUND),
    CONFLICT("CONFLICT", "Xung đột trạng thái dữ liệu", HttpStatus.CONFLICT),

    // IAM Errors
    INVALID_CREDENTIALS("INVALID_CREDENTIALS", "Sai email hoặc mật khẩu", HttpStatus.UNAUTHORIZED),
    USER_LOCKED("USER_LOCKED", "Tài khoản đã bị khóa", HttpStatus.FORBIDDEN),
    TOKEN_EXPIRED("TOKEN_EXPIRED", "Phiên đăng nhập đã hết hạn", HttpStatus.UNAUTHORIZED),
    TOKEN_INVALID("TOKEN_INVALID", "Token không hợp lệ hoặc đã bị thu hồi", HttpStatus.UNAUTHORIZED),
    EMAIL_ALREADY_EXISTS("EMAIL_ALREADY_EXISTS", "Email đã tồn tại trên hệ thống", HttpStatus.BAD_REQUEST),
    PHONE_ALREADY_EXISTS("PHONE_ALREADY_EXISTS", "Số điện thoại đã tồn tại trên hệ thống", HttpStatus.BAD_REQUEST),

    // Booking & Showtime Errors
    SEAT_ALREADY_HELD("SEAT_ALREADY_HELD", "Ghế đã bị người khác giữ", HttpStatus.CONFLICT),
    SEAT_ALREADY_SOLD("SEAT_ALREADY_SOLD", "Ghế đã được bán", HttpStatus.CONFLICT),
    SHOWTIME_EXPIRED("SHOWTIME_EXPIRED", "Suất chiếu đã bắt đầu hoặc hết hạn", HttpStatus.BAD_REQUEST),
    ORDER_NOT_PENDING("ORDER_NOT_PENDING", "Đơn hàng không ở trạng thái chờ thanh toán", HttpStatus.BAD_REQUEST),
    DUPLICATE_TRANSACTION("DUPLICATE_TRANSACTION", "Giao dịch đã được xử lý", HttpStatus.CONFLICT),
    VOUCHER_INVALID("VOUCHER_INVALID", "Voucher không hợp lệ hoặc đã hết hạn", HttpStatus.BAD_REQUEST),
    REFUND_POLICY_VIOLATED("REFUND_POLICY_VIOLATED", "Không thỏa mãn điều kiện hoàn tiền", HttpStatus.BAD_REQUEST);

    private final String code;
    private final String defaultMessage;
    private final HttpStatus status;

    ErrorCode(String code, String defaultMessage, HttpStatus status) {
        this.code = code;
        this.defaultMessage = defaultMessage;
        this.status = status;
    }
}
