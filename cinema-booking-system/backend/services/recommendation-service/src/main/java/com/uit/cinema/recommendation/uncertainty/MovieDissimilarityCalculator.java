package com.uit.cinema.recommendation.uncertainty;

import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.Collections;
import java.util.Set;
import java.util.stream.Collectors;

@Component
public class MovieDissimilarityCalculator {

    public double calculateTotalDissimilarity(MovieFeature left, MovieFeature right) {
        return calculateNumericalDissimilarity(left, right) + calculateCategoricalDissimilarity(left, right);
    }

    public double calculateNumericalDissimilarity(MovieFeature left, MovieFeature right) {
        double durationDistance = square(valueOrZero(left.durationMinutes()) - valueOrZero(right.durationMinutes()));
        double releaseYearDistance = square(valueOrZero(left.releaseYear()) - valueOrZero(right.releaseYear()));
        double imdbRatingDistance = square(valueOrZero(left.imdbRating()) - valueOrZero(right.imdbRating()));
        return Math.sqrt(durationDistance + releaseYearDistance + imdbRatingDistance);
    }

    public double calculateCategoricalDissimilarity(MovieFeature left, MovieFeature right) {
        return categoricalField(left.genreCsv(), right.genreCsv())
                + categoricalField(left.language(), right.language())
                + categoricalField(left.region(), right.region());
    }

    public double categoricalField(String leftRawValue, String rightRawValue) {
        Set<String> left = splitToNormalizedSet(leftRawValue);
        Set<String> right = splitToNormalizedSet(rightRawValue);
        int maxCardinality = Math.max(left.size(), right.size());
        long intersectionSize = left.stream().filter(right::contains).count();
        return maxCardinality - intersectionSize;
    }

    private Set<String> splitToNormalizedSet(String csvValue) {
        if (csvValue == null || csvValue.isBlank()) {
            return Collections.emptySet();
        }
        return Arrays.stream(csvValue.split(","))
                .map(String::trim)
                .map(String::toLowerCase)
                .filter(value -> !value.isBlank())
                .collect(Collectors.toSet());
    }

    private double valueOrZero(Number value) {
        return value == null ? 0.0 : value.doubleValue();
    }

    private double square(double value) {
        return value * value;
    }
}
