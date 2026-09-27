package com.uit.cinema.catalog.mapper;

import com.uit.cinema.catalog.dto.request.MovieRequest;
import com.uit.cinema.catalog.dto.response.MovieResponse;
import com.uit.cinema.catalog.entity.Genre;
import com.uit.cinema.catalog.entity.Movie;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;
import org.mapstruct.MappingTarget;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Mapper
public interface MovieMapper {

    @Mapping(target = "genres", expression = "java(mapGenres(movie.getGenres()))")
    MovieResponse toResponse(Movie movie);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "genres", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    Movie toEntity(MovieRequest request);

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "genres", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    void updateEntity(@MappingTarget Movie movie, MovieRequest request);

    default List<String> mapGenres(Set<Genre> genres) {
        if (genres == null) return null;
        return genres.stream().map(Genre::getName).collect(Collectors.toList());
    }
}
