FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 80
EXPOSE 443

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy solution and project files
COPY ["IdentityService.slnx", "."]
COPY ["IdentityService.Domain/IdentityService.Domain.csproj", "IdentityService.Domain/"]
COPY ["IdentityService.Application/IdentityService.Application.csproj", "IdentityService.Application/"]
COPY ["IdentityService.Infrastructure/IdentityService.Infrastructure.csproj", "IdentityService.Infrastructure/"]
COPY ["IdentityService.Presentation/IdentityService.Presentation.csproj", "IdentityService.Presentation/"]

# Restore dependencies
RUN dotnet restore "IdentityService.Presentation/IdentityService.Presentation.csproj"

# Copy the rest of the code
COPY . .

WORKDIR "/src/IdentityService.Presentation"
RUN dotnet build "IdentityService.Presentation.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "IdentityService.Presentation.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "IdentityService.Presentation.dll"]
