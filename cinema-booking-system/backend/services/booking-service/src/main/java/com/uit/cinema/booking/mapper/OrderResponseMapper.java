package com.uit.cinema.booking.mapper;

import com.uit.cinema.booking.dto.response.OrderResponse;
import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.catalog.service.CatalogReadService;
import com.uit.cinema.catalog.service.contract.CatalogContentView;
import com.uit.cinema.facility.service.FacilityReadService;
import com.uit.cinema.facility.service.contract.FacilityRoomView;
import com.uit.cinema.facility.service.contract.FacilitySeatTemplateView;
import com.uit.cinema.showtime.service.SeatReservationService;
import com.uit.cinema.showtime.service.contract.ShowtimeScheduleView;
import com.uit.cinema.showtime.service.contract.ShowtimeSeatView;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class OrderResponseMapper {

    private final SeatReservationService seatReservationService;
    private final CatalogReadService catalogReadService;
    private final FacilityReadService facilityReadService;
    private final TicketRepository ticketRepository;

    public OrderResponse toResponse(Order order) {
        Optional<ShowtimeScheduleView> showtime = seatReservationService.findSchedule(order.getShowtimeId());
        Optional<CatalogContentView> movie = showtime.map(ShowtimeScheduleView::movieId)
            .flatMap(catalogReadService::findMovie);
        Optional<CatalogContentView> event = showtime.map(ShowtimeScheduleView::eventId)
            .flatMap(catalogReadService::findEvent);
        Optional<FacilityRoomView> room = showtime.map(ShowtimeScheduleView::roomId)
            .flatMap(facilityReadService::findRoom);

        String displayTitle = movie.map(CatalogContentView::title)
            .orElseGet(() -> event.map(CatalogContentView::title).orElse("Showtime #" + order.getShowtimeId()));
        String displayType = movie.isPresent() ? "MOVIE" : event.isPresent() ? "EVENT" : "SHOWTIME";

        List<Long> seatIds = parseSeatIds(order.getSeatIdsSnapshot());
        Map<Long, OrderResponse.OrderSeatResponse> seatMap = seatIds.stream()
            .map(this::toSeatResponse)
            .filter(Objects::nonNull)
            .collect(java.util.stream.Collectors.toMap(
                OrderResponse.OrderSeatResponse::getSeatId,
                seat -> seat,
                (left, right) -> left,
                java.util.LinkedHashMap::new
            ));
        List<OrderResponse.OrderTicketResponse> tickets = ticketRepository.findByOrderIdOrderByCreatedAtDesc(order.getId())
            .stream()
            .map(ticket -> toTicketResponse(ticket, seatMap.get(ticket.getShowtimeSeatId())))
            .toList();

        return OrderResponse.builder()
            .id(order.getId())
            .userId(order.getUserId())
            .showtimeId(order.getShowtimeId())
            .movieId(showtime.map(ShowtimeScheduleView::movieId).orElse(null))
            .movieTitle(movie.map(CatalogContentView::title).orElse(null))
            .eventId(showtime.map(ShowtimeScheduleView::eventId).orElse(null))
            .eventTitle(event.map(CatalogContentView::title).orElse(null))
            .displayTitle(displayTitle)
            .displayType(displayType)
            .roomId(showtime.map(ShowtimeScheduleView::roomId).orElse(null))
            .roomName(room.map(FacilityRoomView::roomName).orElse(null))
            .cinemaId(room.map(FacilityRoomView::cinemaId).orElse(null))
            .cinemaName(room.map(FacilityRoomView::cinemaName).orElse(null))
            .startTime(showtime.map(ShowtimeScheduleView::startTime).orElse(null))
            .endTime(showtime.map(ShowtimeScheduleView::endTime).orElse(null))
            .seatIds(seatIds)
            .seatLabels(seatMap.values().stream().map(OrderResponse.OrderSeatResponse::getLabel).toList())
            .seats(List.copyOf(seatMap.values()))
            .voucherId(order.getVoucherId())
            .totalAmount(order.getTotalAmount())
            .discountAmount(order.getDiscountAmount())
            .finalAmount(order.getFinalAmount())
            .status(order.getStatus())
            .salesChannel(order.getSalesChannel())
            .customerName(order.getCustomerName())
            .customerPhone(order.getCustomerPhone())
            .createdByStaffId(order.getCreatedByStaffId())
            .paymentMethod(order.getPaymentMethod())
            .paymentTransactionId(order.getPaymentTransactionId())
            .tickets(tickets)
            .createdAt(order.getCreatedAt())
            .updatedAt(order.getUpdatedAt())
            .build();
    }

    private OrderResponse.OrderSeatResponse toSeatResponse(Long seatId) {
        Optional<ShowtimeSeatView> seat = seatReservationService.findSeat(seatId);
        if (seat.isEmpty()) {
            return null;
        }

        Optional<FacilitySeatTemplateView> template = facilityReadService.findSeatTemplate(seat.get().seatTemplateId());
        String label = template.map(FacilitySeatTemplateView::label).orElse(String.valueOf(seatId));
        String seatType = template.map(FacilitySeatTemplateView::seatType).orElse("standard");
        String seatTypeCode = template.map(FacilitySeatTemplateView::seatTypeCode).orElse("STANDARD");
        String seatTypeName = template.map(FacilitySeatTemplateView::seatTypeName).orElse("Standard");
        Integer columnSpan = template.map(FacilitySeatTemplateView::columnSpan).orElse(1);

        return OrderResponse.OrderSeatResponse.builder()
            .seatId(seat.get().seatId())
            .seatTemplateId(seat.get().seatTemplateId())
            .label(label)
            .rowLabel(template.map(FacilitySeatTemplateView::rowLabel).orElse(null))
            .columnNumber(template.map(FacilitySeatTemplateView::columnNumber).orElse(null))
            .seatType(seatType)
            .seatTypeCode(seatTypeCode)
            .seatTypeName(seatTypeName)
            .columnSpan(columnSpan)
            .price(seat.get().price() != null ? seat.get().price() : BigDecimal.ZERO)
            .build();
    }

    private OrderResponse.OrderTicketResponse toTicketResponse(Ticket ticket, OrderResponse.OrderSeatResponse seat) {
        return OrderResponse.OrderTicketResponse.builder()
            .id(ticket.getId())
            .showtimeSeatId(ticket.getShowtimeSeatId())
            .seatLabel(seat != null ? seat.getLabel() : String.valueOf(ticket.getShowtimeSeatId()))
            .ticketCode(ticket.getTicketCode())
            .qrCodeData(ticket.getQrCodeData())
            .price(ticket.getPrice())
            .status(ticket.getStatus())
            .checkedInAt(ticket.getCheckedInAt())
            .createdAt(ticket.getCreatedAt())
            .build();
    }

    private List<Long> parseSeatIds(String snapshot) {
        if (snapshot == null || snapshot.isBlank()) {
            return List.of();
        }
        return List.of(snapshot.split(",")).stream()
            .map(String::trim)
            .filter(value -> !value.isEmpty())
            .map(Long::valueOf)
            .toList();
    }
}
