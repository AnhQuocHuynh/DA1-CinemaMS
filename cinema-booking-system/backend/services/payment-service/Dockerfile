FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 5003

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

# Copy project files and restore
COPY ["PaymentService.Domain/PaymentService.Domain.csproj", "PaymentService.Domain/"]
COPY ["PaymentService.Application/PaymentService.Application.csproj", "PaymentService.Application/"]
COPY ["PaymentService.Infrastructure/PaymentService.Infrastructure.csproj", "PaymentService.Infrastructure/"]
COPY ["PaymentService.Presentation/PaymentService.Presentation.csproj", "PaymentService.Presentation/"]

RUN dotnet restore "PaymentService.Presentation/PaymentService.Presentation.csproj"

# Copy all source
COPY . .

# Build
WORKDIR /src/PaymentService.Presentation
RUN dotnet build "PaymentService.Presentation.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "PaymentService.Presentation.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .

ENTRYPOINT ["dotnet", "PaymentService.Presentation.dll"]
