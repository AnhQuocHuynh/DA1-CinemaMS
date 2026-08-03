package com.uit.cinema.booking;

import com.uit.cinema.core.outbox.OutboxEventRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
    "spring.datasource.url=jdbc:h2:mem:booking-context;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa",
    "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop",
    "outbox.dispatcher.enabled=false"
})
class BookingServiceApplicationTest {

    @Autowired
    private OutboxEventRepository outboxEventRepository;

    @Test
    void contextLoadsWithOutboxRepository() {
        assertThat(outboxEventRepository).isNotNull();
    }
}
