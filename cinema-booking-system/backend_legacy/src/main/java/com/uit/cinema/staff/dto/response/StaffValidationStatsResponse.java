package com.uit.cinema.staff.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class StaffValidationStatsResponse {
    private long totalValidated;
    private long pendingCheckIns;
    private long totalBookings;
    private long validatorsOnline;
}
