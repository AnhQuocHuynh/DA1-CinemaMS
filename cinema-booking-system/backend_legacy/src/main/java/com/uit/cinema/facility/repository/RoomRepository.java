package com.uit.cinema.facility.repository;

import com.uit.cinema.facility.entity.Room;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {

    List<Room> findByCinemaIdAndActiveTrue(Long cinemaId);
}
