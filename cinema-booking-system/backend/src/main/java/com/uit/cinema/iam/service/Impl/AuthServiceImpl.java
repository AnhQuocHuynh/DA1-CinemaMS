package com.uit.cinema.iam.service.Impl;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.core.security.CustomUserDetails;
import com.uit.cinema.core.security.JwtTokenProvider;
import com.uit.cinema.iam.dto.response.AuthResponse;
import com.uit.cinema.iam.dto.request.LoginRequest;
import com.uit.cinema.iam.dto.request.RegisterRequest;
import com.uit.cinema.iam.dto.response.UserResponse;
import com.uit.cinema.iam.entity.Role;
import com.uit.cinema.iam.entity.User;
import com.uit.cinema.iam.repository.RoleRepository;
import com.uit.cinema.iam.repository.UserRepository;
import com.uit.cinema.iam.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

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
    public User register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new CustomException("Email đã được sử dụng", HttpStatus.CONFLICT, "EMAIL_TAKEN");
        }
        Role customerRole = roleRepository.findByName(Role.RoleName.ROLE_CUSTOMER)
            .orElseThrow(() -> new CustomException("Role không tồn tại", HttpStatus.INTERNAL_SERVER_ERROR));
        User user = User.builder()
            .email(request.getEmail())
            .passwordHash(passwordEncoder.encode(request.getPassword()))
            .fullName(request.getFullName())
            .phone(request.getPhone())
            .roles(Set.of(customerRole))
            .build();
        return userRepository.save(user);
    }

    @Override
    public AuthResponse login(LoginRequest request) {
        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );
        
        String token = jwtTokenProvider.generateAccessToken(authentication);
        CustomUserDetails userDetails = (CustomUserDetails) authentication.getPrincipal();
        User user = userDetails.getUser();
        
        List<String> roles = user.getRoles().stream()
                .map(role -> role.getName().name())
                .collect(Collectors.toList());
                
        UserResponse userResponse = UserResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .fullName(user.getFullName())
                .phone(user.getPhone())
                .roles(roles)
                .build();
                
        return AuthResponse.builder()
                .accessToken(token)
                .user(userResponse)
                .build();
    }
}
