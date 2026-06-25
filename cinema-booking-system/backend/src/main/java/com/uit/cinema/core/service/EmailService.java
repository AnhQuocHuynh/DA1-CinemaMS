package com.uit.cinema.core.service;

public interface EmailService {
    void sendPasswordResetEmail(String to, String resetLink);
}
