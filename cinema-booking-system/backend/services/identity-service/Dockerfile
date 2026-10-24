FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy solution and project files
COPY ["services/identity-service/IdentityService.slnx", "services/identity-service/."]
COPY ["services/identity-service/IdentityService.Domain/IdentityService.Domain.csproj", "services/identity-service/IdentityService.Domain/"]
COPY ["services/identity-service/IdentityService.Application/IdentityService.Application.csproj", "services/identity-service/IdentityService.Application/"]
COPY ["services/identity-service/IdentityService.Infrastructure/IdentityService.Infrastructure.csproj", "services/identity-service/IdentityService.Infrastructure/"]
COPY ["services/identity-service/IdentityService.Presentation/IdentityService.Presentation.csproj", "services/identity-service/IdentityService.Presentation/"]

# Restore dependencies
COPY ["shared/Shared.Hosting/CinemaBooking.Shared.Hosting.csproj", "shared/Shared.Hosting/"]
RUN dotnet restore "services/identity-service/IdentityService.Presentation/IdentityService.Presentation.csproj"

# Copy the rest of the code
COPY . .

WORKDIR "/src/services/identity-service/IdentityService.Presentation"
RUN dotnet build "IdentityService.Presentation.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "IdentityService.Presentation.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "IdentityService.Presentation.dll"]
