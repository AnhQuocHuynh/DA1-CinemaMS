FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 5003

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy project files and restore
COPY ["services/payment-service/PaymentService.Domain/PaymentService.Domain.csproj", "services/payment-service/PaymentService.Domain/"]
COPY ["services/payment-service/PaymentService.Application/PaymentService.Application.csproj", "services/payment-service/PaymentService.Application/"]
COPY ["services/payment-service/PaymentService.Infrastructure/PaymentService.Infrastructure.csproj", "services/payment-service/PaymentService.Infrastructure/"]
COPY ["services/payment-service/PaymentService.Presentation/PaymentService.Presentation.csproj", "services/payment-service/PaymentService.Presentation/"]

COPY ["shared/Shared.Hosting/CinemaBooking.Shared.Hosting.csproj", "shared/Shared.Hosting/"]
RUN dotnet restore "services/payment-service/PaymentService.Presentation/PaymentService.Presentation.csproj"

# Copy all source
COPY . .

# Build
WORKDIR /src/services/payment-service/PaymentService.Presentation
RUN dotnet build "PaymentService.Presentation.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "PaymentService.Presentation.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

ENTRYPOINT ["dotnet", "PaymentService.Presentation.dll"]
