package com.uit.cinema.catalog;

import com.uit.cinema.core.outbox.OutboxEventRepository;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest(properties = "app.internal-token=test-internal-token")
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CatalogServiceApplicationTest {

    @Autowired
    private OutboxEventRepository outboxEventRepository;

    @Autowired
    private MockMvc mockMvc;

    @Test
    void contextLoadsWithOutboxRepository() {
        assertThat(outboxEventRepository).isNotNull();
    }

    @Test
    void internalPathVariableIsBoundInPackagedRuntime() throws Exception {
        mockMvc.perform(get("/internal/catalog/movies/{movieId}", Long.MAX_VALUE)
                .header("X-Internal-Token", "test-internal-token"))
            .andExpect(status().isNotFound());
    }
}
