package com.uit.cinema.facility;

import com.uit.cinema.facility.service.client.FacilityShowtimeGuard;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@ActiveProfiles("test")
class FacilityServiceApplicationTest {

    @Autowired
    private FacilityShowtimeGuard facilityShowtimeGuard;

    @Test
    void contextLoadsWithHttpShowtimeGuard() {
        assertThat(facilityShowtimeGuard).isNotNull();
    }
}
