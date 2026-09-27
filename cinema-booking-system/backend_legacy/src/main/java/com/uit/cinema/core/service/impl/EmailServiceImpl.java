package com.uit.cinema.core.service.impl;

import com.uit.cinema.core.service.EmailService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class EmailServiceImpl implements EmailService {

    @Override
    public void sendPasswordResetEmail(String to, String resetLink) {
        log.info("=========================================================");
        log.info("MOCK EMAIL SENDER");
        log.info("To: {}", to);
        log.info("From: admin@cinema.com");
        log.info("Subject: Password Reset Request");
        log.info("Body:");
        log.info("Click the following link to reset your password:");
        log.info("{}", resetLink);
        log.info("If you did not request this, please ignore this email.");
        log.info("=========================================================");
    }
}
