using System;

namespace IdentityService.Application.Exceptions;

public class UserNotFoundException : Exception
{
    public UserNotFoundException(long userId) 
        : base($"User with ID {userId} was not found.")
    {
    }

    public UserNotFoundException(string keycloakId) 
        : base($"User with Keycloak ID {keycloakId} was not found.")
    {
    }
}
