package com.uit.cinema.booking.security;

import com.uit.cinema.booking.entity.Order;
import com.uit.cinema.booking.repository.OrderRepository;
import com.uit.cinema.booking.repository.TicketRepository;
import com.uit.cinema.core.exception.CustomException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingAuthorizationServiceTest {

    @Mock
    private AuthenticatedUserIdResolver userIdResolver;

    @Mock
    private OrderRepository orderRepository;

    @Mock
    private TicketRepository ticketRepository;

    @Test
    void customerCanAccessOnlyOwnedOrder() {
        BookingAuthorizationService authorization = service();
        when(userIdResolver.isJwtEnabled()).thenReturn(true);
        when(userIdResolver.hasAnyRole("ADMIN", "STAFF")).thenReturn(false);
        when(userIdResolver.currentUserId()).thenReturn(42L);
        when(orderRepository.findById(1L)).thenReturn(Optional.of(Order.builder().userId(42L).build()));
        when(orderRepository.findById(2L)).thenReturn(Optional.of(Order.builder().userId(99L).build()));

        assertThatCode(() -> authorization.requireOrderAccess(1L)).doesNotThrowAnyException();
        assertThatThrownBy(() -> authorization.requireOrderAccess(2L))
            .isInstanceOfSatisfying(CustomException.class, exception -> {
                assertThat(exception.getStatus().value()).isEqualTo(403);
                assertThat(exception.getErrorCode()).isEqualTo("BOOKING_ACCESS_DENIED");
            });
    }

    @Test
    void privilegedAndCompatibilityRequestsDoNotPerformOwnershipLookup() {
        BookingAuthorizationService authorization = service();
        when(userIdResolver.isJwtEnabled()).thenReturn(true);
        when(userIdResolver.hasAnyRole("ADMIN", "STAFF")).thenReturn(true);

        authorization.requireOrderAccess(1L);

        verify(orderRepository, never()).findById(1L);
    }

    private BookingAuthorizationService service() {
        return new BookingAuthorizationService(userIdResolver, orderRepository, ticketRepository);
    }
}
