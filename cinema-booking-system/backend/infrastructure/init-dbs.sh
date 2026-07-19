#!/bin/bash
set -e

# This script runs automatically when the postgres container is created for the first time.
# It creates all the separate databases needed for the microservices.

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    
    -- Identity & Access Management
    CREATE DATABASE keycloak_db;
    CREATE DATABASE user_profile_db;

    -- Services not set up yet (commented out)
    -- CREATE DATABASE catalog_db;
    -- CREATE DATABASE facility_db;
    -- CREATE DATABASE showtime_db;
    -- CREATE DATABASE booking_db;
    -- CREATE DATABASE payment_db;
EOSQL
