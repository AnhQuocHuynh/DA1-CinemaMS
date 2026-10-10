-- ==============================================================================
-- Auto-create databases for Cinema Booking System Microservices
-- Mounted to /docker-entrypoint-initdb.d/init-multiple-databases.sql
-- ==============================================================================

-- Spring Boot Microservice Databases
CREATE DATABASE cinema_catalog_db;
CREATE DATABASE cinema_showtime_db;
CREATE DATABASE cinema_booking_db;
CREATE DATABASE cinema_analytics_db;
CREATE DATABASE cinema_rental_db;
-- Existing Postgres volumes do not re-run this script. Create cinema_rental_db manually on those volumes.

-- ASP.NET & Keycloak Microservice Databases
CREATE DATABASE keycloak_db;
CREATE DATABASE user_profile_db;
CREATE DATABASE payment_db;
CREATE DATABASE facility_db;
