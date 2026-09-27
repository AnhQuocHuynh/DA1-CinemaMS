package com.uit.cinema;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest
@ActiveProfiles("test")
class CinemaApplicationTests {

    @MockBean
    private UserDetailsService userDetailsService;

    @Test
    void contextLoads() {
    }
}
