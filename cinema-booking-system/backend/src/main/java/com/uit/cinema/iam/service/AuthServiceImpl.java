package com.uit.cinema.iam.service;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.core.security.JwtTokenProvider;
import com.uit.cinema.iam.entity.Role;
import com.uit.cinema.iam.entity.User;
import com.uit.cinema.iam.repository.RoleRepository;
import com.uit.cinema.iam.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Set;

@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;

    @Override
    @Transactional
    public User register(String email, String password, String fullName, String phone) {
        if (userRepository.existsByEmail(email)) {
            throw new CustomException("Email đã được sử dụng", HttpStatus.CONFLICT, "EMAIL_TAKEN");
        }
        Role customerRole = roleRepository.findByName(Role.RoleName.ROLE_CUSTOMER)
            .orElseThrow(() -> new CustomException("Role không tồn tại", HttpStatus.INTERNAL_SERVER_ERROR));
        User user = User.builder()
            .email(email)
            .passwordHash(passwordEncoder.encode(password))
            .fullName(fullName)
            .phone(phone)
            .roles(Set.of(customerRole))
            .build();
        return userRepository.save(user);
    }

    @Override
    public String login(String email, String password) {
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(email, password)
        );
        return jwtTokenProvider.generateAccessToken(authentication);
    }
}
