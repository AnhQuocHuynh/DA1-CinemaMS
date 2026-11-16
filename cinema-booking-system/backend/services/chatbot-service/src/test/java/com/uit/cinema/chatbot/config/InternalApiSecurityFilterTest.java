package com.uit.cinema.chatbot.config;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.util.ReflectionTestUtils;

import static org.junit.jupiter.api.Assertions.assertEquals;

class InternalApiSecurityFilterTest {

    private final InternalApiSecurityFilter filter = new InternalApiSecurityFilter();

    @Test
    void rejectsMissingTokenAndAllowsTheConfiguredToken() throws Exception {
        ReflectionTestUtils.setField(filter, "internalToken", "secret");

        MockHttpServletResponse rejected = new MockHttpServletResponse();
        filter.doFilter(request("/internal/chatbot/reindex", null), rejected, new MockFilterChain());
        assertEquals(401, rejected.getStatus());

        MockHttpServletResponse allowed = new MockHttpServletResponse();
        filter.doFilter(request("/internal/chatbot/reindex", "secret"), allowed, new MockFilterChain());
        assertEquals(200, allowed.getStatus());

        MockHttpServletResponse ignored = new MockHttpServletResponse();
        filter.doFilter(request("/api/chatbot/conversations", null), ignored, new MockFilterChain());
        assertEquals(200, ignored.getStatus());
    }

    private static MockHttpServletRequest request(String path, String token) {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", path);
        request.setRequestURI(path);
        if (token != null) {
            request.addHeader("X-Internal-Token", token);
        }
        return request;
    }
}
