FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 80

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy project files and restore
COPY ["NotificationService.Domain/NotificationService.Domain.csproj", "NotificationService.Domain/"]
COPY ["NotificationService.Application/NotificationService.Application.csproj", "NotificationService.Application/"]
COPY ["NotificationService.Infrastructure/NotificationService.Infrastructure.csproj", "NotificationService.Infrastructure/"]
COPY ["NotificationService.Presentation/NotificationService.Presentation.csproj", "NotificationService.Presentation/"]

RUN dotnet restore "NotificationService.Presentation/NotificationService.Presentation.csproj"

# Copy all source
COPY . .

# Build
WORKDIR /src/NotificationService.Presentation
RUN dotnet build "NotificationService.Presentation.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "NotificationService.Presentation.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

ENTRYPOINT ["dotnet", "NotificationService.Presentation.dll"]
