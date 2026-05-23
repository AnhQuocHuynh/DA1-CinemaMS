package com.uit.cinema.iam.service;

import com.uit.cinema.iam.dto.response.AuthResponse;
import com.uit.cinema.iam.dto.request.LoginRequest;
import com.uit.cinema.iam.dto.request.RegisterRequest;
import com.uit.cinema.iam.entity.User;

import com.uit.cinema.iam.dto.request.TokenRefreshRequest;
import com.uit.cinema.iam.dto.request.ForgotPasswordRequest;
import com.uit.cinema.iam.dto.request.ResetPasswordRequest;

public interface AuthService {
    User register(RegisterRequest request);
    AuthResponse login(LoginRequest request);
    AuthResponse refreshToken(TokenRefreshRequest request);
    void logout(String refreshToken);
    void forgotPassword(ForgotPasswordRequest request);
    void resetPassword(ResetPasswordRequest request);
}
