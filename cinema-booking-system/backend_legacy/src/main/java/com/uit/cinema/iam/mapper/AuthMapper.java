package com.uit.cinema.iam.mapper;

import com.uit.cinema.iam.dto.request.RegisterRequest;
import com.uit.cinema.iam.dto.response.UserResponse;
import com.uit.cinema.iam.entity.Role;
import com.uit.cinema.iam.entity.User;
import org.mapstruct.Mapper;
import org.mapstruct.Mapping;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Mapper
public interface AuthMapper {

    @Mapping(target = "id", ignore = true)
    @Mapping(target = "passwordHash", ignore = true)
    @Mapping(target = "roles", ignore = true)
    @Mapping(target = "createdAt", ignore = true)
    @Mapping(target = "updatedAt", ignore = true)
    User toUser(RegisterRequest request);

    @Mapping(target = "roles", expression = "java(mapRoles(user.getRoles()))")
    UserResponse toUserResponse(User user);

    default List<String> mapRoles(Set<Role> roles) {
        if (roles == null) return null;
        return roles.stream().map(role -> role.getName().name()).collect(Collectors.toList());
    }
}
