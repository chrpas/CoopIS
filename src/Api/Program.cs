using System;
using System.IdentityModel.Tokens.Jwt;
using System.Text;
using System.Text.Json.Serialization;
using System.Threading.RateLimiting;
using CoopIS.Api.Middleware;
using CoopIS.Application.Common;
using CoopIS.Application.Services;
using CoopIS.Infrastructure.Data;
using CoopIS.Infrastructure.Security;
using CoopIS.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;

var builder = WebApplication.CreateBuilder(args);

// 1. Controllers & JSON Serialization
builder.Services.AddControllers()
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.ReferenceHandler = ReferenceHandler.IgnoreCycles;
    });

// 2. Database Connection (PostgreSQL with graceful In-Memory fallback & URI parsing)
string connectionString = ResolveConnectionString(builder.Configuration);

bool isPostgresAvailable = false;
try
{
    using var conn = new Npgsql.NpgsqlConnection(connectionString);
    conn.Open();
    conn.Close();
    isPostgresAvailable = true;
}
catch (Exception ex)
{
    Console.WriteLine($"[Database Notice] PostgreSQL not reachable ({ex.Message}). Using In-Memory database.");
}

if (isPostgresAvailable)
{
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseNpgsql(connectionString));
}
else
{
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseInMemoryDatabase("CoopIS_Db"));
}

// 3. Application & Infrastructure Services
builder.Services.AddScoped<ITokenService, JwtTokenService>();
builder.Services.AddScoped<IPasswordHasher, BcryptPasswordHasher>();
builder.Services.AddScoped<IMemberService, MemberService>();
builder.Services.AddScoped<IContributionService, ContributionService>();
builder.Services.AddScoped<IAccountingService, AccountingService>();
builder.Services.AddScoped<IDistributionService, DistributionService>();
builder.Services.AddScoped<IUserService, UserService>();

// 4. Rate Limiting for Brute-Force Protection
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddFixedWindowLimiter("LoginRateLimiter", opt =>
    {
        opt.PermitLimit = 5;
        opt.Window = TimeSpan.FromMinutes(1);
        opt.QueueLimit = 0;
    });
});

// 5. JWT Authentication & Claims Mapping
JwtSecurityTokenHandler.DefaultInboundClaimTypeMap.Clear();
var jwtKey = Environment.GetEnvironmentVariable("JWT_SECRET")
    ?? Environment.GetEnvironmentVariable("Jwt__Key")
    ?? builder.Configuration["Jwt:Key"]
    ?? "CoopIS_Super_Secure_Secret_Key_For_Jwt_Token_Generation_2026_Enterprise!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "CoopIS.Api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "CoopIS.Client";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.MapInboundClaims = false;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        RoleClaimType = "role",
        NameClaimType = "name"
    };
});

builder.Services.AddAuthorization();

// 6. CORS for React Client
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://localhost")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// 7. Swagger / OpenAPI Configuration
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "CoopIS API - Cooperative Financial System",
        Version = "v1",
        Description = "Enterprise Clean Architecture Web API with RBAC and Rate Limiting"
    });

    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Name = "Authorization",
        Type = SecuritySchemeType.ApiKey,
        Scheme = "Bearer",
        BearerFormat = "JWT",
        In = ParameterLocation.Header,
        Description = "Enter 'Bearer' [space] and your JWT token."
    });

    c.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});

var app = builder.Build();

// 8. Automatic EF Core Database Migration and Seed on Startup
using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var logger = services.GetRequiredService<ILogger<Program>>();
    try
    {
        var db = services.GetRequiredService<AppDbContext>();
        await DbInitializer.InitializeAsync(db, logger);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Failed to initialize or seed database.");
    }
}

// 9. Middleware Pipeline
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment() || builder.Configuration.GetValue<bool>("EnableSwaggerInProd", true))
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "CoopIS API v1"));
}

app.UseCors("AllowFrontend");
app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();

// Helper to support Cloud DATABASE_URL and local configurations
static string ResolveConnectionString(IConfiguration config)
{
    var raw = Environment.GetEnvironmentVariable("DATABASE_URL")
        ?? Environment.GetEnvironmentVariable("ConnectionStrings__CoopDbConnection")
        ?? config.GetConnectionString("CoopDbConnection")
        ?? "Host=localhost;Port=5432;Database=coopis_db;Username=postgres;Password=postgres";

    if (raw.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) ||
        raw.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase))
    {
        try
        {
            var uri = new Uri(raw);
            var userInfo = uri.UserInfo.Split(':');
            var user = userInfo[0];
            var password = userInfo.Length > 1 ? userInfo[1] : "";
            var port = uri.Port > 0 ? uri.Port : 5432;
            var database = uri.AbsolutePath.TrimStart('/');
            return $"Host={uri.Host};Port={port};Database={database};Username={user};Password={password};SSL Mode=Prefer;";
        }
        catch
        {
            return raw;
        }
    }

    return raw;
}
