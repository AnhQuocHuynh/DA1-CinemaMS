FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build

WORKDIR /src

# Copy the .slnx file first to leverage Docker layer caching
COPY *.slnx ./

# Copy the csproj files for each project
COPY ["FacilityService.Application/FacilityService.Application.csproj", "FacilityService.Application/"]
COPY ["FacilityService.Domain/FacilityService.Domain.csproj", "FacilityService.Domain/"]
COPY ["FacilityService.Infrastructure/FacilityService.Infrastructure.csproj", "FacilityService.Infrastructure/"]
COPY ["FacilityService.Presentation/FacilityService.Presentation.csproj", "FacilityService.Presentation/"]

# Restore dependencies
RUN dotnet restore "FacilityService.Presentation/FacilityService.Presentation.csproj" -nowarn:msb3202

# Copy the rest of the source code
COPY . .

# Build the application
RUN dotnet build "FacilityService.Presentation/FacilityService.Presentation.csproj" -c Release -o /app/build -v m

# Publish the application
RUN dotnet publish "FacilityService.Presentation/FacilityService.Presentation.csproj" -c Release -o /app/publish /p:UseAppHost=false /p:BlazorWebAssemblyEnableLinking=false

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
