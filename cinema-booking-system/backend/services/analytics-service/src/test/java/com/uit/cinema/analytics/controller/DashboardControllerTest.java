package com.uit.cinema.analytics.controller;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

import static org.hamcrest.Matchers.hasSize;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class DashboardControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Test
    void overviewReturnsLegacyCompatibleEnvelope() throws Exception {
        mockMvc.perform(get("/api/admin/dashboard/overview"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data.totalRevenue").value(0))
            .andExpect(jsonPath("$.data.revenueChange").value("0% vs previous period"))
            .andExpect(jsonPath("$.data.occupancyRate").value(0))
            .andExpect(jsonPath("$.data.totalBookings").value(0));
    }

    @Test
    void revenueSeriesReturnsZeroFilledRange() throws Exception {
        mockMvc.perform(get("/api/admin/dashboard/revenue-series")
                .param("from", "2026-07-01")
                .param("to", "2026-07-03"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.success").value(true))
            .andExpect(jsonPath("$.data", hasSize(3)))
            .andExpect(jsonPath("$.data[0].label").value("Jul 01"))
            .andExpect(jsonPath("$.data[0].revenue").value(0))
            .andExpect(jsonPath("$.data[0].orders").value(0))
            .andExpect(jsonPath("$.data[0].tickets").value(0));
    }
}
