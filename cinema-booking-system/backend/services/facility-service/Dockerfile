FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build

WORKDIR /src

# Copy the .slnx file first to leverage Docker layer caching
COPY ["services/facility-service/*.slnx", "services/facility-service/"]

# Copy the csproj files for each project
COPY ["services/facility-service/FacilityService.Application/FacilityService.Application.csproj", "services/facility-service/FacilityService.Application/"]
COPY ["services/facility-service/FacilityService.Domain/FacilityService.Domain.csproj", "services/facility-service/FacilityService.Domain/"]
COPY ["services/facility-service/FacilityService.Infrastructure/FacilityService.Infrastructure.csproj", "services/facility-service/FacilityService.Infrastructure/"]
COPY ["services/facility-service/FacilityService.Presentation/FacilityService.Presentation.csproj", "services/facility-service/FacilityService.Presentation/"]

# Restore dependencies
COPY ["shared/Shared.Hosting/CinemaBooking.Shared.Hosting.csproj", "shared/Shared.Hosting/"]
RUN dotnet restore "services/facility-service/FacilityService.Presentation/FacilityService.Presentation.csproj" -nowarn:msb3202

# Copy the rest of the source code
COPY . .

# Build the application
RUN dotnet build "services/facility-service/FacilityService.Presentation/FacilityService.Presentation.csproj" -c Release -o /app/build -v m

# Publish the application
RUN dotnet publish "services/facility-service/FacilityService.Presentation/FacilityService.Presentation.csproj" -c Release -o /app/publish /p:UseAppHost=false /p:BlazorWebAssemblyEnableLinking=false

# Use the ASP.NET Core runtime image for the final stage
FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS final

WORKDIR /app

# Copy the published output from the build stage
COPY --from=build /app/publish ./

# Set environment variables (these act as default values and can be overridden by docker-compose)
ENV DOTNET_ENVIRONMENT=Development
ENV ASPNETCORE_ENVIRONMENT=Development
ENV ConnectionStrings__DefaultConnection="Host=localhost;Database=facility_db;Username=postgres;Password=password"
ENV ServiceUrls__ShowtimeService="http://localhost:5001"

EXPOSE 5002

ENTRYPOINT ["dotnet", "FacilityService.Presentation.dll"]
