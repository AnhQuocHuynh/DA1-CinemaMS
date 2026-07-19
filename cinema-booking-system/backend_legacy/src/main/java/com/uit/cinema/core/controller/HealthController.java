package com.uit.cinema.core.controller;

import java.nio.charset.StandardCharsets;
import java.sql.Connection;
import java.sql.SQLException;
import java.sql.Statement;
import java.util.LinkedHashMap;
import java.util.Map;
import javax.sql.DataSource;
import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.connection.RedisConnection;
import org.springframework.data.redis.connection.RedisConnectionFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/health")
@RequiredArgsConstructor
public class HealthController {

    private final DataSource dataSource;
    private final RedisConnectionFactory redisConnectionFactory;

    @GetMapping
    public ResponseEntity<Map<String, Object>> health() {
        boolean dbOk = checkDb();
        boolean cacheOk = checkCache();
        boolean ok = dbOk && cacheOk;

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("db", dbOk ? "UP" : "DOWN");
        details.put("cache", cacheOk ? "UP" : "DOWN");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", ok ? "UP" : "DOWN");
        body.put("details", details);

        return ResponseEntity.status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }

    @GetMapping("/requests")
    public ResponseEntity<Map<String, Object>> healthRequests() {
        boolean dbOk = checkDbQuery();
        boolean cacheOk = checkCacheQuery();
        boolean ok = dbOk && cacheOk;

        Map<String, Object> details = new LinkedHashMap<>();
        details.put("dbQuery", dbOk ? "UP" : "DOWN");
        details.put("cacheQuery", cacheOk ? "UP" : "DOWN");

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", ok ? "UP" : "DOWN");
        body.put("details", details);

        return ResponseEntity.status(ok ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }

    private boolean checkDb() {
        try (Connection connection = dataSource.getConnection()) {
            return connection.isValid(2);
        } catch (SQLException ex) {
            return false;
        }
    }

    private boolean checkCache() {
        try (RedisConnection connection = redisConnectionFactory.getConnection()) {
            String ping = connection.ping();
            return ping != null && !ping.isBlank();
        } catch (Exception ex) {
            return false;
        }
    }

    private boolean checkDbQuery() {
        try (Connection connection = dataSource.getConnection(); Statement statement = connection.createStatement()) {
            return statement.execute("SELECT 1");
        } catch (SQLException ex) {
            return false;
        }
    }

    private boolean checkCacheQuery() {
        byte[] key = "health:probe".getBytes(StandardCharsets.UTF_8);
        byte[] value = "1".getBytes(StandardCharsets.UTF_8);

        try (RedisConnection connection = redisConnectionFactory.getConnection()) {
            Boolean setOk = connection.set(key, value);
            byte[] stored = connection.get(key);
            connection.del(key);
            return Boolean.TRUE.equals(setOk) && stored != null && stored.length > 0;
        } catch (Exception ex) {
            return false;
        }
    }
}
