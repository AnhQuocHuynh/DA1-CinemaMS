package com.uit.cinema.catalog.entity;

import jakarta.persistence.*;
import lombok.*;

/**
 * Bảng trung gian movie_genres — dùng khi cần lưu thêm metadata của quan hệ.
 * Nếu không cần metadata, quan hệ @ManyToMany trực tiếp trong Movie là đủ.
 */
@Entity
@Table(name = "movie_genres")
@Getter @Setter
@NoArgsConstructor @AllArgsConstructor
@Builder
@IdClass(MovieGenreId.class)
public class MovieGenre {

    @Id
    @Column(name = "movie_id")
    private Long movieId;

    @Id
    @Column(name = "genre_id")
    private Long genreId;
}
