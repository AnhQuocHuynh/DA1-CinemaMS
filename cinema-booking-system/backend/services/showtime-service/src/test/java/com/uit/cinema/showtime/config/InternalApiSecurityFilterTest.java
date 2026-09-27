package com.uit.cinema.showtime.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;

class InternalApiSecurityFilterTest {

    @Test
    void rejectsMissingTokenForInternalRequest() throws Exception {
        InternalApiSecurityFilter filter = filterWithToken("secret");
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/showtimes/1/schedule");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(401, response.getStatus());
    }

    @Test
    void allowsValidTokenForInternalRequest() throws Exception {
        InternalApiSecurityFilter filter = filterWithToken("secret");
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/internal/showtimes/1/schedule");
        request.addHeader("X-Internal-Token", "secret");
        MockHttpServletResponse response = new MockHttpServletResponse();

        filter.doFilter(request, response, new MockFilterChain());

        assertEquals(200, response.getStatus());
    }

    private InternalApiSecurityFilter filterWithToken(String token) {
        InternalApiSecurityFilter filter = new InternalApiSecurityFilter();
        ReflectionTestUtils.setField(filter, "internalToken", token);
        return filter;
    }
}
