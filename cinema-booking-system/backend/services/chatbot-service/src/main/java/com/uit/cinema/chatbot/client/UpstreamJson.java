package com.uit.cinema.chatbot.client;

import com.fasterxml.jackson.databind.JsonNode;
import com.uit.cinema.chatbot.service.CatalogDocument;

import java.util.ArrayList;
import java.util.List;
import java.util.StringJoiner;

public final class UpstreamJson {

    private UpstreamJson() {
    }

    public static List<CatalogDocument> movies(JsonNode body) {
        List<CatalogDocument> documents = new ArrayList<>();
        for (JsonNode movie : dataArray(body)) {
            long id = movie.path("id").asLong(0);
            if (id <= 0) {
                continue;
            }
            if (!movie.path("active").asBoolean(true)) {
                continue;
            }
            String title = movie.path("title").asText("").trim();
            if (title.isBlank()) {
                continue;
            }
            int duration = movie.path("durationMinutes").asInt(0);
            String bodyText = joinLines(
                line("Tiêu đề", title),
                line("Mô tả", movie.path("description").asText("")),
                line("Thể loại", joinArray(movie.path("genres"))),
                duration > 0 ? line("Thời lượng", duration + " phút") : "",
                line("Ngôn ngữ", movie.path("language").asText("")),
                line("Độ tuổi", movie.path("ageRating").asText("")),
                line("Đạo diễn", movie.path("director").asText("")),
                line("Diễn viên", movie.path("actors").asText(""))
            );
            String metadata = "{\"kind\":\"movie\",\"movieId\":" + id
                + ",\"title\":" + quote(title)
                + ",\"locator\":\"movie/" + id + "\"}";
            documents.add(new CatalogDocument("movie:" + id, title.isBlank() ? "Phim " + id : title, bodyText, metadata));
        }
        return documents;
    }

    public static List<CatalogDocument> events(JsonNode body) {
        List<CatalogDocument> documents = new ArrayList<>();
        for (JsonNode event : dataArray(body)) {
            long id = event.path("id").asLong(0);
            if (id <= 0) {
                continue;
            }
            String title = event.path("name").asText("").trim();
            if (title.isBlank()) {
                continue;
            }
            String bodyText = joinLines(
                line("Sự kiện", title),
                line("Mô tả", event.path("description").asText("")),
                line("Địa điểm", event.path("venue").asText(""))
            );
            String metadata = "{\"kind\":\"event\",\"eventId\":" + id
                + ",\"title\":" + quote(title)
                + ",\"locator\":\"event/" + id + "\"}";
            documents.add(new CatalogDocument("event:" + id, title.isBlank() ? "Sự kiện " + id : title, bodyText, metadata));
        }
        return documents;
    }

    public static List<String> showtimes(JsonNode body) {
        List<String> lines = new ArrayList<>();
        for (JsonNode showtime : dataArray(body)) {
            String status = showtime.path("status").asText("");
            if (status.toUpperCase().contains("CANCEL")) {
                continue;
            }
            lines.add("Suất %s lúc %s, rạp %s, phòng %s, trạng thái %s.".formatted(
                text(showtime, "displayTitle"),
                text(showtime, "startTime"),
                text(showtime, "cinemaName"),
                text(showtime, "roomName"),
                status.isBlank() ? "không rõ" : status
            ));
        }
        return lines;
    }

    public static List<String> orders(JsonNode body) {
        List<String> lines = new ArrayList<>();
        for (JsonNode order : dataArray(body)) {
            lines.add("Đơn %s cho %s lúc %s, trạng thái %s, số ghế %s.".formatted(
                order.path("id").asText(""),
                firstText(order, "displayTitle", "movieTitle", "eventTitle"),
                text(order, "startTime"),
                text(order, "status"),
                joinArray(order.path("seatLabels"))
            ));
        }
        return lines;
    }

    public static List<String> popular(JsonNode body) {
        List<String> lines = new ArrayList<>();
        JsonNode recommendations = body == null ? null : body.path("data").path("recommendations");
        if (recommendations == null || !recommendations.isArray()) {
            return lines;
        }
        for (JsonNode movie : recommendations) {
            String title = movie.path("title").asText("");
            if (!title.isBlank()) {
                lines.add("Phim được xem nhiều: " + title + ".");
            }
        }
        return lines;
    }

    private static List<JsonNode> dataArray(JsonNode body) {
        List<JsonNode> nodes = new ArrayList<>();
        JsonNode data = body == null ? null : body.path("data");
        if (data != null && data.isArray()) {
            data.forEach(nodes::add);
        }
        return nodes;
    }

    private static String joinLines(String... lines) {
        StringJoiner joiner = new StringJoiner("\n");
        for (String line : lines) {
            if (line != null && !line.isBlank()) {
                joiner.add(line);
            }
        }
        return joiner.toString();
    }

    private static String line(String label, String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return label + ": " + value.trim();
    }

    private static String joinArray(JsonNode node) {
        if (node == null || !node.isArray() || node.isEmpty()) {
            return "";
        }
        StringJoiner joiner = new StringJoiner(", ");
        node.forEach(item -> joiner.add(item.asText("")));
        return joiner.toString();
    }

    private static String text(JsonNode node, String field) {
        return node.path(field).asText("");
    }

    private static String firstText(JsonNode node, String... fields) {
        for (String field : fields) {
            String value = node.path(field).asText("");
            if (!value.isBlank()) {
                return value;
            }
        }
        return "";
    }

    static String quote(String value) {
        String safe = value == null ? "" : value.replace("\\", "\\\\").replace("\"", "\\\"");
        return "\"" + safe + "\"";
    }
}
