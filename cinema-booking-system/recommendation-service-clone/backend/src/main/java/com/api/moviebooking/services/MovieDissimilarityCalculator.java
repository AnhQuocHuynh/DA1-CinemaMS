package com.api.moviebooking.services;

import java.util.Arrays;
import java.util.Collections;
import java.util.Set;
import java.util.stream.Collectors;

import org.springframework.stereotype.Component;

import com.api.moviebooking.models.entities.Movie;

@Component
public class MovieDissimilarityCalculator {

    public double calculateTotalDissimilarity(Movie left, Movie right) {
        return calculateNumericalDissimilarity(left, right) + calculateCategoricalDissimilarity(left, right);
    }

    public double calculateNumericalDissimilarity(Movie left, Movie right) {
        double durationDistance = square(valueOrZero(left.getDuration()) - valueOrZero(right.getDuration()));
        double releaseYearDistance = square(valueOrZero(left.getReleaseYear()) - valueOrZero(right.getReleaseYear()));
        double imdbRatingDistance = square(valueOrZero(left.getImdbRating()) - valueOrZero(right.getImdbRating()));

        return Math.sqrt(durationDistance + releaseYearDistance + imdbRatingDistance);
    }

    public double calculateCategoricalDissimilarity(Movie left, Movie right) {
        return calculateCategoricalFieldDissimilarity(left.getGenre(), right.getGenre())
                + calculateCategoricalFieldDissimilarity(left.getLanguage(), right.getLanguage())
                + calculateCategoricalFieldDissimilarity(left.getRegion(), right.getRegion());
    }

    public double calculateCategoricalFieldDissimilarity(String leftRawValue, String rightRawValue) {
        Set<String> left = splitToNormalizedSet(leftRawValue);
        Set<String> right = splitToNormalizedSet(rightRawValue);

        int maxCardinality = Math.max(left.size(), right.size());
        long intersectionSize = left.stream().filter(right::contains).count();

        return maxCardinality - intersectionSize;
    }

    // Converts a comma-separated string into a normalized set of lowercase trimmed values.
    private Set<String> splitToNormalizedSet(String csvValue) {
        if (csvValue == null || csvValue.isBlank()) {
            return Collections.emptySet();
        }

        return Arrays.stream(csvValue.split(",")) // 1. Tách chuỗi bằng dấu phẩy
            .map(String::trim)                // 2. Xóa khoảng trắng thừa ở 2 đầu
            .map(String::toLowerCase)         // 3. Chuyển hết sang chữ thường
            .filter(value -> !value.isBlank()) // 4. Loại bỏ các phần tử rỗng
            .collect(Collectors.toSet());     // 5. Gom lại thành một tập hợp (Set
    }

    private double valueOrZero(Number value) {
        return value == null ? 0.0 : value.doubleValue();
    }

    private double square(double value) {
        return value * value;
    }
}
