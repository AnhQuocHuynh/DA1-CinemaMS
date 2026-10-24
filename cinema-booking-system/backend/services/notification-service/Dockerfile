FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy project files and restore
COPY ["services/notification-service/NotificationService.Domain/NotificationService.Domain.csproj", "services/notification-service/NotificationService.Domain/"]
COPY ["services/notification-service/NotificationService.Application/NotificationService.Application.csproj", "services/notification-service/NotificationService.Application/"]
COPY ["services/notification-service/NotificationService.Infrastructure/NotificationService.Infrastructure.csproj", "services/notification-service/NotificationService.Infrastructure/"]
COPY ["services/notification-service/NotificationService.Presentation/NotificationService.Presentation.csproj", "services/notification-service/NotificationService.Presentation/"]

COPY ["shared/Shared.Hosting/CinemaBooking.Shared.Hosting.csproj", "shared/Shared.Hosting/"]
RUN dotnet restore "services/notification-service/NotificationService.Presentation/NotificationService.Presentation.csproj"

# Copy all source
COPY . .

# Build
WORKDIR /src/services/notification-service/NotificationService.Presentation
RUN dotnet build "NotificationService.Presentation.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "NotificationService.Presentation.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

ENTRYPOINT ["dotnet", "NotificationService.Presentation.dll"]
