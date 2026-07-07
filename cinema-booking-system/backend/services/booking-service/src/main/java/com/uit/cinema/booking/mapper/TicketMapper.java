package com.uit.cinema.booking.mapper;

import com.uit.cinema.booking.dto.response.TicketResponse;
import com.uit.cinema.booking.entity.Ticket;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

@Mapper
public interface TicketMapper {

    @Mapping(target = "orderId", source = "order.id")
    @Mapping(target = "userId", source = "order.userId")
    TicketResponse toResponse(Ticket ticket);
}
