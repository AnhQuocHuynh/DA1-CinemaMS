package com.uit.cinema.facility.service.contract;

/**
 * Lightweight room projection for cross-module read models.
 */
public record FacilityRoomView(
    Long roomId,
    String roomName,
    Long cinemaId,
    String cinemaName,
    Boolean underMaintenance
) {
    public FacilityRoomView(Long roomId, String roomName, Long cinemaId, String cinemaName) {
        this(roomId, roomName, cinemaId, cinemaName, false);
    }

    public boolean isUnderMaintenance() {
        return Boolean.TRUE.equals(underMaintenance);
    }
}
