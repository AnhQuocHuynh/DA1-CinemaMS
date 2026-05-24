package com.uit.cinema.iam.service.Impl;

import com.uit.cinema.core.exception.CustomException;
import com.uit.cinema.core.exception.ErrorCode;
import com.uit.cinema.core.security.CustomUserDetails;
import com.uit.cinema.core.security.JwtTokenProvider;
import com.uit.cinema.iam.dto.request.LoginRequest;
import com.uit.cinema.iam.dto.request.RegisterRequest;
import com.uit.cinema.iam.dto.request.TokenRefreshRequest;
import com.uit.cinema.iam.dto.request.ForgotPasswordRequest;
import com.uit.cinema.iam.dto.request.ResetPasswordRequest;
import com.uit.cinema.iam.dto.response.AuthResponse;
import com.uit.cinema.iam.dto.response.UserResponse;
import com.uit.cinema.iam.entity.Role;
import com.uit.cinema.iam.entity.User;
import com.uit.cinema.iam.entity.RefreshToken;
import com.uit.cinema.iam.entity.PasswordResetToken;
import com.uit.cinema.iam.mapper.AuthMapper;
import com.uit.cinema.iam.repository.RoleRepository;
import com.uit.cinema.iam.repository.UserRepository;
import com.uit.cinema.iam.repository.RefreshTokenRepository;
import com.uit.cinema.iam.repository.PasswordResetTokenRepository;
import com.uit.cinema.iam.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Set;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthServiceImpl implements AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordResetTokenRepository passwordResetTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthMapper authMapper;

    @Override
    @Transactional
    public User register(RegisterRequest request) {
        if (userRepository.existsByEmail(request.getEmail())) {
            throw new CustomException(ErrorCode.EMAIL_ALREADY_EXISTS);
        }
        if (request.getPhone() != null && userRepository.existsByPhone(request.getPhone())) {
            throw new CustomException(ErrorCode.PHONE_ALREADY_EXISTS);
        }
        Role customerRole = roleRepository.findByName(Role.RoleName.ROLE_CUSTOMER)
            .orElseThrow(() -> new CustomException("Role không tồn tại", HttpStatus.INTERNAL_SERVER_ERROR));
            
        User user = authMapper.toUser(request);
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setRoles(Set.of(customerRole));
        
        return userRepository.save(user);
    }

    @Override
    @Transactional
    public AuthResponse login(LoginRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
            .orElseThrow(() -> new CustomException(ErrorCode.INVALID_CREDENTIALS));

        if (!user.isActive()) {
            throw new CustomException(ErrorCode.USER_LOCKED);
        }

        Authentication authentication = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
        );
        
        String token = jwtTokenProvider.generateAccessToken(authentication);
        String refreshTokenValue = jwtTokenProvider.generateRefreshToken(user.getEmail());
        
        // Save refresh token
        RefreshToken refreshToken = RefreshToken.builder()
                .user(user)
                .token(refreshTokenValue)
                .expiryDate(Instant.now().plusMillis(2592000000L)) // 30 ngày
                .revoked(false)
                .build();
                
        refreshTokenRepository.deleteByUserId(user.getId());
        refreshTokenRepository.save(refreshToken);
        
        UserResponse userResponse = authMapper.toUserResponse(user);
                
        return AuthResponse.builder()
                .accessToken(token)
                .refreshToken(refreshTokenValue)
                .user(userResponse)
                .build();
    }

    @Override
    @Transactional
    public AuthResponse refreshToken(TokenRefreshRequest request) {
        String requestRefreshToken = request.getRefreshToken();
        
        if (!jwtTokenProvider.validateToken(requestRefreshToken)) {
            throw new CustomException(ErrorCode.TOKEN_INVALID);
        }
        
        RefreshToken refreshToken = refreshTokenRepository.findByToken(requestRefreshToken)
            .orElseThrow(() -> new CustomException(ErrorCode.TOKEN_INVALID));
            
        if (refreshToken.isRevoked() || refreshToken.getExpiryDate().isBefore(Instant.now())) {
            throw new CustomException(ErrorCode.TOKEN_EXPIRED);
        }
        
        User user = refreshToken.getUser();
        if (!user.isActive()) {
            throw new CustomException(ErrorCode.USER_LOCKED);
        }
        
        CustomUserDetails userDetails = new CustomUserDetails(user);
        Authentication authentication = new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
        String newAccessToken = jwtTokenProvider.generateAccessToken(authentication);
        
        return AuthResponse.builder()
                .accessToken(newAccessToken)
                .refreshToken(requestRefreshToken)
                .user(authMapper.toUserResponse(user))
                .build();
    }

    @Override
    @Transactional
    public void logout(String refreshTokenValue) {
        RefreshToken refreshToken = refreshTokenRepository.findByToken(refreshTokenValue)
            .orElse(null);
        if (refreshToken != null) {
            refreshToken.setRevoked(true);
            refreshTokenRepository.save(refreshToken);
        }
    }

    @Override
    @Transactional
    public void forgotPassword(ForgotPasswordRequest request) {
        User user = userRepository.findByEmail(request.getEmail())
            .orElseThrow(() -> new CustomException(ErrorCode.RESOURCE_NOT_FOUND, "Không tìm thấy tài khoản với email này"));
            
        passwordResetTokenRepository.deleteByUserId(user.getId());
        
        String token = UUID.randomUUID().toString();
        PasswordResetToken resetToken = PasswordResetToken.builder()
                .user(user)
                .token(token)
                .expiryDate(Instant.now().plusSeconds(900)) // 15 phút
                .build();
                
        passwordResetTokenRepository.save(resetToken);
        
        log.info("Reset password link: http://localhost:8080/api/auth/reset-password?token={}", token);
    }

    @Override
    @Transactional
    public void resetPassword(ResetPasswordRequest request) {
        if (!request.getNewPassword().equals(request.getConfirmPassword())) {
            throw new CustomException(ErrorCode.INVALID_INPUT, "Mật khẩu xác nhận không khớp");
        }
        
        PasswordResetToken resetToken = passwordResetTokenRepository.findByToken(request.getToken())
            .orElseThrow(() -> new CustomException(ErrorCode.TOKEN_INVALID, "Token khôi phục không hợp lệ"));
            
        if (resetToken.getExpiryDate().isBefore(Instant.now())) {
            throw new CustomException(ErrorCode.TOKEN_EXPIRED, "Token khôi phục đã hết hạn");
        }
        
        User user = resetToken.getUser();
        user.setPasswordHash(passwordEncoder.encode(request.getNewPassword()));
        userRepository.save(user);
        
        refreshTokenRepository.deleteByUserId(user.getId());
        passwordResetTokenRepository.delete(resetToken);
    }
}
