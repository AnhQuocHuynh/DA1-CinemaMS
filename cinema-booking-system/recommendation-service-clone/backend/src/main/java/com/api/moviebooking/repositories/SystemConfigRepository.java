package com.api.moviebooking.repositories;

import org.springframework.data.jpa.repository.JpaRepository;

import com.api.moviebooking.models.entities.SystemConfig;

public interface SystemConfigRepository extends JpaRepository<SystemConfig, String> {
}
