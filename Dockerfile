# Multi-stage build for .NET 8 Web API
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copy solution and project definitions for optimized Docker layer caching
COPY CoopIS.sln ./
COPY src/Domain/CoopIS.Domain.csproj src/Domain/
COPY src/Application/CoopIS.Application.csproj src/Application/
COPY src/Infrastructure/CoopIS.Infrastructure.csproj src/Infrastructure/
COPY src/Api/CoopIS.Api.csproj src/Api/

# Restore dependencies
RUN dotnet restore CoopIS.sln

# Copy remaining source code and publish release build
COPY src/ src/
RUN dotnet publish src/Api/CoopIS.Api.csproj -c Release -o /app/publish /p:UseAppHost=false

# Build the React/Vite frontend so the API can serve it as static files
FROM node:20-alpine AS web
WORKDIR /app
COPY client/web/package*.json ./
RUN npm ci || npm install
COPY client/web/ ./
RUN npm run build

# Runtime container using lightweight ASP.NET 8 image
FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS final
WORKDIR /app
EXPOSE 8080

# Configure ASP.NET runtime environment defaults
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

# Copy compiled binary artifacts from build stage
COPY --from=build /app/publish .

# Copy compiled frontend into wwwroot (served by the API's static file middleware)
COPY --from=web /app/dist ./wwwroot

ENTRYPOINT ["dotnet", "CoopIS.Api.dll"]
