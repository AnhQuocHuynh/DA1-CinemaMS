package com.uit.cinema.iam.service;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.core.security.JwtTokenProvider;
import com.uit.cinema.iam.dto.request.ForgotPasswordRequest;
import com.uit.cinema.iam.dto.request.RegisterRequest;
import com.uit.cinema.iam.dto.request.ResetPasswordRequest;
import com.uit.cinema.iam.entity.PasswordResetToken;
import com.uit.cinema.iam.entity.Role;
import com.uit.cinema.iam.entity.User;
import com.uit.cinema.iam.mapper.AuthMapper;
import com.uit.cinema.iam.repository.PasswordResetTokenRepository;
import com.uit.cinema.iam.repository.RefreshTokenRepository;
import com.uit.cinema.iam.repository.RoleRepository;
import com.uit.cinema.iam.repository.UserRepository;
import com.uit.cinema.iam.service.Impl.AuthServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceImplTest {

    @Mock
    private UserRepository userRepository;
    @Mock
    private RoleRepository roleRepository;
    @Mock
    private RefreshTokenRepository refreshTokenRepository;
    @Mock
    private PasswordResetTokenRepository passwordResetTokenRepository;
    @Mock
    private PasswordEncoder passwordEncoder;
    @Mock
    private AuthenticationManager authenticationManager;
    @Mock
    private JwtTokenProvider jwtTokenProvider;
    @Mock
    private AuthMapper authMapper;

    @InjectMocks
    private AuthServiceImpl authService;

    private RegisterRequest registerRequest;
    private User mockUser;
    private Role mockRole;

    @BeforeEach
    void setUp() {
        registerRequest = new RegisterRequest();
        registerRequest.setEmail("test@example.com");
        registerRequest.setPassword("password123");
        registerRequest.setFullName("Nguyen Van Test");
        registerRequest.setPhone("0987654321");

        mockRole = Role.builder()
                .id(1L)
                .name(Role.RoleName.ROLE_CUSTOMER)
                .build();

        mockUser = User.builder()
                .id(1L)
                .email("test@example.com")
                .fullName("Nguyen Van Test")
                .passwordHash("hashedPassword")
                .phone("0987654321")
                .active(true)
                .build();
    }

    @Test
    void register_Success() {
        when(userRepository.existsByEmail(any())).thenReturn(false);
        when(userRepository.existsByPhone(any())).thenReturn(false);
        when(roleRepository.findByName(any())).thenReturn(Optional.of(mockRole));
        when(authMapper.toUser(any())).thenReturn(mockUser);
        when(passwordEncoder.encode(any())).thenReturn("hashedPassword");
        when(userRepository.save(any())).thenReturn(mockUser);

        User savedUser = authService.register(registerRequest);

        assertNotNull(savedUser);
        assertEquals("test@example.com", savedUser.getEmail());
        verify(userRepository, times(1)).save(any());
    }

    @Test
    void register_EmailAlreadyExists_ThrowsException() {
        when(userRepository.existsByEmail(any())).thenReturn(true);

        assertThrows(CustomException.class, () -> authService.register(registerRequest));
        verify(userRepository, never()).save(any());
    }

    @Test
    void forgotPassword_Success() {
        ForgotPasswordRequest request = new ForgotPasswordRequest();
        request.setEmail("test@example.com");

        when(userRepository.findByEmail(any())).thenReturn(Optional.of(mockUser));
        when(passwordResetTokenRepository.save(any())).thenReturn(new PasswordResetToken());

        assertDoesNotThrow(() -> authService.forgotPassword(request));
        verify(passwordResetTokenRepository, times(1)).deleteByUserId(any());
        verify(passwordResetTokenRepository, times(1)).save(any());
    }

    @Test
    void resetPassword_Success() {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-token");
        request.setNewPassword("newPassword123");
        request.setConfirmPassword("newPassword123");

        PasswordResetToken resetToken = PasswordResetToken.builder()
                .token("valid-token")
                .user(mockUser)
                .expiryDate(Instant.now().plusSeconds(300))
                .build();

        when(passwordResetTokenRepository.findByToken(any())).thenReturn(Optional.of(resetToken));
        when(passwordEncoder.encode(any())).thenReturn("newHashedPassword");
        when(userRepository.save(any())).thenReturn(mockUser);

        assertDoesNotThrow(() -> authService.resetPassword(request));
        verify(refreshTokenRepository, times(1)).deleteByUserId(any());
        verify(passwordResetTokenRepository, times(1)).delete(any());
    }

    @Test
    void resetPassword_ConfirmPasswordMismatch_ThrowsException() {
        ResetPasswordRequest request = new ResetPasswordRequest();
        request.setToken("valid-token");
        request.setNewPassword("newPassword123");
        request.setConfirmPassword("mismatchPassword");

        assertThrows(CustomException.class, () -> authService.resetPassword(request));
        verify(userRepository, never()).save(any());
    }
}
