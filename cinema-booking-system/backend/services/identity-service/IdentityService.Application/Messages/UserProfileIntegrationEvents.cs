namespace IdentityService.Application.Messages;

public record UserProfileUpdatedPayload(long UserId, string Email, string FullName, string? PhoneNumber);
public record KeycloakUserRegisteredPayload(string KeycloakId, string Email, string FullName, string? PhoneNumber);
