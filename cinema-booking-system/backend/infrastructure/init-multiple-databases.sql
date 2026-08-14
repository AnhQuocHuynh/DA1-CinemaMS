-- ==============================================================================
-- Auto-create databases for Cinema Booking System Microservices
-- Mounted to /docker-entrypoint-initdb.d/init-multiple-databases.sql
-- ==============================================================================

-- Spring Boot Microservice Databases
CREATE DATABASE cinema_catalog_db;
CREATE DATABASE cinema_facility_db;
CREATE DATABASE cinema_showtime_db;
CREATE DATABASE cinema_booking_db;
CREATE DATABASE cinema_analytics_db;

-- ASP.NET & Keycloak Microservice Databases
CREATE DATABASE keycloak_db;
CREATE DATABASE user_profile_db;
CREATE DATABASE payment_db;
CREATE DATABASE facility_db;
CREATE DATABASE catalog_db;
CREATE DATABASE showtime_db;
CREATE DATABASE booking_db;
