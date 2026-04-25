package com.uit.cinema.iam.service;

import com.uit.cinema.iam.entity.User;
public interface AuthService {
    User register(String email, String password, String fullName, String phone);
    String login(String email, String password);
}
