package com.uit.cinema.core.config;

import com.uit.cinema.booking.entity.Voucher;
import com.uit.cinema.booking.repository.VoucherRepository;
import com.uit.cinema.catalog.entity.Event;
import com.uit.cinema.catalog.entity.Movie;
import com.uit.cinema.catalog.repository.EventRepository;
import com.uit.cinema.catalog.repository.MovieRepository;
import com.uit.cinema.facility.entity.Cinema;
import com.uit.cinema.facility.entity.Room;
import com.uit.cinema.facility.entity.SeatTemplate;
import com.uit.cinema.facility.entity.SeatType;
import com.uit.cinema.facility.repository.CinemaRepository;
import com.uit.cinema.facility.repository.RoomRepository;
import com.uit.cinema.facility.repository.SeatTemplateRepository;
import com.uit.cinema.facility.repository.SeatTypeRepository;
import com.uit.cinema.iam.entity.Role;
import com.uit.cinema.iam.entity.User;
import com.uit.cinema.iam.repository.RoleRepository;
import com.uit.cinema.iam.repository.UserRepository;
import com.uit.cinema.showtime.entity.Showtime;
import com.uit.cinema.showtime.entity.ShowtimeSeat;
import com.uit.cinema.showtime.repository.ShowtimeRepository;
import com.uit.cinema.showtime.repository.ShowtimeSeatRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final CinemaRepository cinemaRepository;
    private final RoomRepository roomRepository;
    private final SeatTemplateRepository seatTemplateRepository;
    private final SeatTypeRepository seatTypeRepository;
    private final MovieRepository movieRepository;
    private final EventRepository eventRepository;
    private final ShowtimeRepository showtimeRepository;
    private final ShowtimeSeatRepository showtimeSeatRepository;
    private final VoucherRepository voucherRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    @Transactional
    public void run(String... args) {
        log.info("Starting database initialization for frontend testing...");

        Role customerRole = seedRole(Role.RoleName.ROLE_CUSTOMER);
        Role staffRole = seedRole(Role.RoleName.ROLE_STAFF);
        Role adminRole = seedRole(Role.RoleName.ROLE_ADMIN);

        seedUsers(customerRole, staffRole, adminRole);

        SeedSeatTypes seatTypes = seedSeatTypes();

        Cinema hcmCinema = seedCinema("CGV HUNG VUONG PLAZA", "126 Hung Vuong, Quan 5", "Ho Chi Minh", "02838350000");
        Cinema thuDucCinema = seedCinema("BETA THU DUC", "Vo Van Ngan, Thu Duc", "Ho Chi Minh", "02873000001");

        Room roomA = seedRoom(hcmCinema, "Phong A1", "2D", 6, 8, seatTypes);
        Room roomB = seedRoom(hcmCinema, "Phong A2", "IMAX", 5, 7, seatTypes);
        Room roomC = seedRoom(thuDucCinema, "Phong B1", "3D", 6, 6, seatTypes);

        Movie movie1 = seedMovie("Lat Mat 9", "Movie seeded for FE booking flow", 125, LocalDate.now().minusDays(10), "T16");
        Movie movie2 = seedMovie("Avengers: Secret Wars", "Action blockbuster seeded for FE", 140, LocalDate.now().plusDays(20), "T13");
        Movie movie3 = seedMovie("Doraemon Movie 2026", "Family movie seeded for FE", 100, LocalDate.now().minusDays(2), "P");

        seedEvent(
            "Anime Cosplay Night",
            "Community event for check event API flow",
            LocalDateTime.now().plusDays(3).withHour(18).withMinute(30).withSecond(0).withNano(0),
            LocalDateTime.now().plusDays(3).withHour(21).withMinute(0).withSecond(0).withNano(0),
            "Main Hall - Thu Duc"
        );

        seedShowtimeWithSeats(
            roomA,
            movie1,
            LocalDateTime.now().plusDays(1).withHour(19).withMinute(0).withSecond(0).withNano(0),
            120,
            BigDecimal.valueOf(75000)
        );
        seedShowtimeWithSeats(
            roomA,
            movie2,
            LocalDateTime.now().plusDays(2).withHour(20).withMinute(0).withSecond(0).withNano(0),
            140,
            BigDecimal.valueOf(120000)
        );
        seedShowtimeWithSeats(
            roomB,
            movie3,
            LocalDateTime.now().plusDays(1).withHour(17).withMinute(30).withSecond(0).withNano(0),
            100,
            BigDecimal.valueOf(65000)
        );
        seedShowtimeWithSeats(
            roomC,
            movie1,
            LocalDateTime.now().plusDays(4).withHour(18).withMinute(0).withSecond(0).withNano(0),
            120,
            BigDecimal.valueOf(70000)
        );

        seedVoucher("WELCOME10", Voucher.DiscountType.PERCENTAGE, BigDecimal.valueOf(10), BigDecimal.valueOf(50000), 500);
        seedVoucher("FLAT30K", Voucher.DiscountType.FIXED_AMOUNT, BigDecimal.valueOf(30000), null, 300);

        log.info("Database initialization completed for frontend testing.");
    }

    private Role seedRole(Role.RoleName roleName) {
        return roleRepository.findByName(roleName).orElseGet(() -> roleRepository.save(Role.builder().name(roleName).build()));
    }

    private void seedUsers(Role customerRole, Role staffRole, Role adminRole) {
        seedUser("admin@cinema.com", "admin123", "System Admin", "0123456789", Set.of(adminRole), true);
        seedUser("staff@cinema.com", "staff123", "Frontdesk Staff", "0987000001", Set.of(staffRole), true);
        seedUser("customer@cinema.com", "customer123", "Default Customer", "0987000002", Set.of(customerRole), true);
        seedUser("locked@cinema.com", "locked123", "Locked User", "0987000003", Set.of(customerRole), false);
    }

    private void seedUser(String email, String rawPassword, String fullName, String phone, Set<Role> roles, boolean active) {
        userRepository.findByEmail(email).orElseGet(() -> {
            User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(rawPassword))
                .fullName(fullName)
                .phone(phone)
                .active(active)
                .roles(roles)
                .build();
            return userRepository.save(user);
        });
    }

    private SeedSeatTypes seedSeatTypes() {
        SeatType standard = seedSeatType(
            SeatType.SeatTypeCode.STANDARD,
            "standard",
            "Standard",
            BigDecimal.ONE,
            1,
            "Standard single seat"
        );
        SeatType vip = seedSeatType(
            SeatType.SeatTypeCode.VIP,
            "vip",
            "VIP",
            BigDecimal.valueOf(1.30),
            1,
            "Premium single seat with better position"
        );
        SeatType couple = seedSeatType(
            SeatType.SeatTypeCode.COUPLE,
            "couple",
            "Couple",
            BigDecimal.valueOf(2.00),
            2,
            "Couple seat represented as one logical seat spanning two columns"
        );
        return new SeedSeatTypes(standard, vip, couple);
    }

    private SeatType seedSeatType(
        SeatType.SeatTypeCode code,
        String name,
        String displayName,
        BigDecimal priceMultiplier,
        int defaultColumnSpan,
        String description
    ) {
        return seatTypeRepository.findByCode(code)
            .or(() -> seatTypeRepository.findByNameIgnoreCase(name))
            .or(() -> code == SeatType.SeatTypeCode.STANDARD ? seatTypeRepository.findByNameIgnoreCase("normal") : java.util.Optional.empty())
            .map(type -> {
                type.setCode(code);
                type.setName(name);
                type.setDisplayName(displayName);
                type.setPriceMultiplier(priceMultiplier);
                type.setDefaultColumnSpan(defaultColumnSpan);
                type.setDescription(description);
                return seatTypeRepository.save(type);
            })
            .orElseGet(() -> seatTypeRepository.save(
                SeatType.builder()
                    .code(code)
                    .name(name)
                    .displayName(displayName)
                    .priceMultiplier(priceMultiplier)
                    .defaultColumnSpan(defaultColumnSpan)
                    .description(description)
                    .build()
            ));
    }

    private Cinema seedCinema(String name, String address, String city, String phone) {
        return cinemaRepository.findByActiveTrue().stream()
            .filter(c -> c.getName().equalsIgnoreCase(name))
            .findFirst()
            .orElseGet(() -> cinemaRepository.save(
                Cinema.builder().name(name).address(address).city(city).phone(phone).active(true).build()
            ));
    }

    private Room seedRoom(Cinema cinema, String roomName, String type, int rows, int columns, SeedSeatTypes seatTypes) {
        Room room = roomRepository.findByCinemaIdAndActiveTrue(cinema.getId()).stream()
            .filter(r -> r.getName().equalsIgnoreCase(roomName))
            .findFirst()
            .orElseGet(() -> roomRepository.save(
                Room.builder()
                    .cinema(cinema)
                    .name(roomName)
                    .type(type)
                    .rows(rows)
                    .columns(columns)
                    .totalSeats(rows * columns)
                    .active(true)
                    .underMaintenance(false)
                    .build()
            ));

        seedSeatTemplates(room, rows, columns, seatTypes);
        return room;
    }

    private void seedSeatTemplates(Room room, int rows, int columns, SeedSeatTypes seatTypes) {
        List<SeatTemplate> existing = seatTemplateRepository.findByRoomIdAndActiveTrue(room.getId());
        if (!existing.isEmpty()) {
            normalizeExistingSeatTemplates(existing, rows, seatTypes);
            return;
        }

        for (int r = 0; r < rows; r++) {
            String rowLabel = String.valueOf((char) ('A' + r));
            int c = 1;
            while (c <= columns) {
                SeatType seatType = resolveSeatTypeForRow(r, rows, seatTypes);
                int columnSpan = seatType.getDefaultColumnSpan() != null ? seatType.getDefaultColumnSpan() : 1;
                seatTemplateRepository.save(
                    SeatTemplate.builder()
                        .room(room)
                        .seatType(seatType)
                        .rowLabel(rowLabel)
                        .columnNumber(c)
                        .columnSpan(columnSpan)
                        .pathway(false)
                        .active(true)
                        .build()
                );
                c += columnSpan;
            }
        }
    }

    private void normalizeExistingSeatTemplates(List<SeatTemplate> existing, int rows, SeedSeatTypes seatTypes) {
        existing.forEach(template -> {
            int rowIndex = template.getRowLabel().charAt(0) - 'A';
            SeatType seatType = resolveSeatTypeForRow(rowIndex, rows, seatTypes);
            int columnSpan = seatType.getDefaultColumnSpan() != null ? seatType.getDefaultColumnSpan() : 1;
            if (template.getSeatType() == null) {
                template.setSeatType(seatType);
            }
            if (template.getColumnSpan() == null || template.getColumnSpan() < 1) {
                template.setColumnSpan(columnSpan);
            }
            template.setPathway(false);
        });
        seatTemplateRepository.saveAll(existing);
    }

    private SeatType resolveSeatTypeForRow(int rowIndex, int totalRows, SeedSeatTypes seatTypes) {
        if (rowIndex == totalRows - 1) {
            return seatTypes.couple();
        }
        if (rowIndex >= Math.max(0, totalRows - 3)) {
            return seatTypes.vip();
        }
        return seatTypes.standard();
    }

    private Movie seedMovie(String title, String description, int duration, LocalDate releaseDate, String ageRating) {
        return movieRepository.findByTitleContainingIgnoreCaseAndActiveTrue(title).stream()
            .filter(m -> m.getTitle().equalsIgnoreCase(title))
            .findFirst()
            .orElseGet(() -> movieRepository.save(
                Movie.builder()
                    .title(title)
                    .description(description)
                    .durationMinutes(duration)
                    .releaseDate(releaseDate)
                    .ageRating(ageRating)
                    .posterUrl("https://example.com/poster/" + title.replace(" ", "-").toLowerCase())
                    .trailerUrl("https://example.com/trailer/" + title.replace(" ", "-").toLowerCase())
                    .language("Vietnamese")
                    .active(true)
                    .build()
            ));
    }

    private Event seedEvent(String name, String description, LocalDateTime startTime, LocalDateTime endTime, String venue) {
        return eventRepository.findByActiveTrueOrderByStartTimeAsc().stream()
            .filter(e -> e.getName().equalsIgnoreCase(name))
            .findFirst()
            .orElseGet(() -> eventRepository.save(
                Event.builder()
                    .name(name)
                    .description(description)
                    .startTime(startTime)
                    .endTime(endTime)
                    .venue(venue)
                    .imageUrl("https://example.com/event/" + name.replace(" ", "-").toLowerCase())
                    .active(true)
                    .build()
            ));
    }

    private Showtime seedShowtimeWithSeats(Room room, Movie movie, LocalDateTime startTime, int durationMinutes, BigDecimal basePrice) {
        LocalDateTime endTime = startTime.plusMinutes(durationMinutes);
        Showtime showtime = showtimeRepository.findByRoomIdAndStartTimeBetween(
                room.getId(),
                startTime.minusMinutes(1),
                startTime.plusMinutes(1)
            ).stream()
            .filter(s -> s.getMovieId().equals(movie.getId()))
            .findFirst()
            .orElseGet(() -> showtimeRepository.save(
                Showtime.builder()
                    .roomId(room.getId())
                    .movieId(movie.getId())
                    .startTime(startTime)
                    .endTime(endTime)
                    .basePrice(basePrice)
                    .status(Showtime.Status.SCHEDULED)
                    .build()
            ));

        seedShowtimeSeats(showtime, basePrice);
        return showtime;
    }

    private void seedShowtimeSeats(Showtime showtime, BigDecimal basePrice) {
        List<ShowtimeSeat> existingSeats = showtimeSeatRepository.findByShowtimeId(showtime.getId());
        if (!existingSeats.isEmpty()) {
            return;
        }

        Room room = roomRepository.findById(showtime.getRoomId()).orElse(null);
        if (room == null) {
            return;
        }

        List<SeatTemplate> templates = seatTemplateRepository.findByRoomIdAndActiveTrue(room.getId()).stream()
            .sorted(Comparator.comparing(SeatTemplate::getRowLabel).thenComparing(SeatTemplate::getColumnNumber))
            .collect(Collectors.toList());

        for (SeatTemplate template : templates) {
            showtimeSeatRepository.save(
                ShowtimeSeat.builder()
                    .showtimeId(showtime.getId())
                    .seatTemplateId(template.getId())
                    .price(calculateSeatPrice(basePrice, template))
                    .status(ShowtimeSeat.SeatStatus.AVAILABLE)
                    .build()
            );
        }
    }

    private void seedVoucher(String code, Voucher.DiscountType type, BigDecimal value, BigDecimal maxDiscountAmount, int usageLimit) {
        voucherRepository.findByCodeAndActiveTrue(code).orElseGet(() -> voucherRepository.save(
            Voucher.builder()
                .code(code)
                .discountType(type)
                .discountValue(value)
                .maxDiscountAmount(maxDiscountAmount)
                .usageLimit(usageLimit)
                .usedCount(0)
                .validFrom(LocalDateTime.now().minusDays(1))
                .validUntil(LocalDateTime.now().plusMonths(6))
                .active(true)
                .build()
        ));
    }

    private BigDecimal calculateSeatPrice(BigDecimal basePrice, SeatTemplate template) {
        BigDecimal multiplier = BigDecimal.ONE;
        if (template.getSeatType() != null && template.getSeatType().getPriceMultiplier() != null) {
            multiplier = template.getSeatType().getPriceMultiplier();
        }
        return basePrice.multiply(multiplier);
    }

    private record SeedSeatTypes(SeatType standard, SeatType vip, SeatType couple) {
    }
}
