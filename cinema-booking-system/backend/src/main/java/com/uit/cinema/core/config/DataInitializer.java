package com.uit.cinema.core.config;

import com.uit.cinema.iam.entity.Role;
import com.uit.cinema.iam.entity.User;
import com.uit.cinema.iam.repository.RoleRepository;
import com.uit.cinema.iam.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.Set;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        log.info("Starting database initialization...");

        // 1. Seed Roles
        Role customerRole = seedRole(Role.RoleName.ROLE_CUSTOMER);
        Role staffRole = seedRole(Role.RoleName.ROLE_STAFF);
        Role adminRole = seedRole(Role.RoleName.ROLE_ADMIN);

        // 2. Seed Admin User
        seedAdminUser(adminRole);

        log.info("Database initialization completed successfully.");
    }

    private Role seedRole(Role.RoleName roleName) {
        return roleRepository.findByName(roleName)
                .orElseGet(() -> {
                    Role role = Role.builder()
                            .name(roleName)
                            .build();
                    log.info("Seeding role: {}", roleName);
                    return roleRepository.save(role);
                });
    }

    private void seedAdminUser(Role adminRole) {
        String adminEmail = "admin@cinema.com";
        if (!userRepository.existsByEmail(adminEmail)) {
            User admin = User.builder()
                    .email(adminEmail)
                    .fullName("System Admin")
                    .passwordHash(passwordEncoder.encode("admin123"))
                    .phone("0123456789")
                    .active(true)
                    .roles(Set.of(adminRole))
                    .build();
            log.info("Seeding admin user: {}", adminEmail);
            userRepository.save(admin);
        }
    }
}
