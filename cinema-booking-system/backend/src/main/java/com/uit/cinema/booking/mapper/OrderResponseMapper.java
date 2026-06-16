package com.uit.cinema.booking.mapper;

import com.uit.cinema.booking.dto.response.OrderResponse;
import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.entity.Ticket;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.facility.entity.Cinema;
import com.uit.cinema.facility.entity.Room;
import com.uit.cinema.facility.entity.SeatTemplate;
import com.uit.cinema.facility.entity.SeatType;
import com.uit.cinema.facility.repository.RoomRepository;
import com.uit.cinema.facility.repository.SeatTemplateRepository;
import com.uit.cinema.showtime.entity.Showtime;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.repository.ShowtimeRepository;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;

@Component
@RequiredArgsConstructor
public class OrderResponseMapper {

    private final ShowtimeRepository showtimeRepository;
    private final ShowtimeSeatRepository showtimeSeatRepository;
    private final SeatTemplateRepository seatTemplateRepository;
    private final MovieRepository movieRepository;
    private final RoomRepository roomRepository;
    private final TicketRepository ticketRepository;

    public OrderResponse toResponse(Order order) {
        Optional<Showtime> showtime = showtimeRepository.findById(order.getShowtimeId());
        Optional<Movie> movie = showtime.flatMap(value -> movieRepository.findById(value.getMovieId()));
        Optional<Room> room = showtime.flatMap(value -> roomRepository.findById(value.getRoomId()));
        Cinema cinema = room.map(Room::getCinema).orElse(null);

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
            .movieId(showtime.map(Showtime::getMovieId).orElse(null))
            .movieTitle(movie.map(Movie::getTitle).orElse(null))
            .roomId(showtime.map(Showtime::getRoomId).orElse(null))
            .roomName(room.map(Room::getName).orElse(null))
            .cinemaId(cinema != null ? cinema.getId() : null)
            .cinemaName(cinema != null ? cinema.getName() : null)
            .startTime(showtime.map(Showtime::getStartTime).orElse(null))
            .endTime(showtime.map(Showtime::getEndTime).orElse(null))
            .seatIds(seatIds)
            .seatLabels(seatMap.values().stream().map(OrderResponse.OrderSeatResponse::getLabel).toList())
            .seats(List.copyOf(seatMap.values()))
            .voucherId(order.getVoucherId())
            .totalAmount(order.getTotalAmount())
            .discountAmount(order.getDiscountAmount())
            .finalAmount(order.getFinalAmount())
            .status(order.getStatus())
            .paymentMethod(order.getPaymentMethod())
            .paymentTransactionId(order.getPaymentTransactionId())
            .tickets(tickets)
            .createdAt(order.getCreatedAt())
            .updatedAt(order.getUpdatedAt())
            .build();
    }

    private OrderResponse.OrderSeatResponse toSeatResponse(Long seatId) {
        return showtimeSeatRepository.findById(seatId)
            .map(seat -> {
                SeatTemplate template = seatTemplateRepository.findById(seat.getSeatTemplateId()).orElse(null);
                SeatType seatType = template != null ? template.getSeatType() : null;
                SeatType.SeatTypeCode code = seatType != null && seatType.getCode() != null
                    ? seatType.getCode()
                    : SeatType.SeatTypeCode.STANDARD;
                String label = template != null ? template.getRowLabel() + template.getColumnNumber() : String.valueOf(seatId);
                Integer columnSpan = template != null && template.getColumnSpan() != null
                    ? template.getColumnSpan()
                    : seatType != null && seatType.getDefaultColumnSpan() != null ? seatType.getDefaultColumnSpan() : 1;

                return OrderResponse.OrderSeatResponse.builder()
                    .seatId(seat.getId())
                    .seatTemplateId(seat.getSeatTemplateId())
                    .label(label)
                    .rowLabel(template != null ? template.getRowLabel() : null)
                    .columnNumber(template != null ? template.getColumnNumber() : null)
                    .seatType(code.name().toLowerCase())
                    .seatTypeCode(code.name())
                    .seatTypeName(seatType != null && seatType.getDisplayName() != null ? seatType.getDisplayName() : toDisplayName(code))
                    .columnSpan(columnSpan)
                    .price(seat.getPrice())
                    .build();
            })
            .orElse(null);
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

    private String toDisplayName(SeatType.SeatTypeCode code) {
        return switch (code) {
            case VIP -> "VIP";
            case COUPLE -> "Couple";
            case STANDARD -> "Standard";
        };
    }
}
