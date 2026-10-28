using System.Text;
using System.Text.Json.Serialization;
using CoopIS.Api.Middleware;
using CoopIS.Application.Common;
using CoopIS.Application.Services;
using CoopIS.Infrastructure.Data;
using CoopIS.Infrastructure.Security;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
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

// 2. Database Connection (PostgreSQL with graceful In-Memory fallback)
var connectionString = builder.Configuration.GetConnectionString("CoopDbConnection")
    ?? "Host=localhost;Port=5432;Database=coopis_db;Username=postgres;Password=postgres";

bool isPostgresAvailable = true;
try
{
    using var conn = new Npgsql.NpgsqlConnection(connectionString);
    conn.Open();
    conn.Close();
}
catch
{
    isPostgresAvailable = false;
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

// 4. JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? "CoopIS_Super_Secure_Secret_Key_For_Jwt_Token_Generation_2026_Enterprise!";
var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "CoopIS.Api";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "CoopIS.Client";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        RoleClaimType = "role"
    };
});

builder.Services.AddAuthorization();

// 5. CORS for React Client
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowFrontend", policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// 6. Swagger / OpenAPI Configuration
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "CoopIS API - Cooperative Management System",
        Version = "v1",
        Description = "Enterprise Clean Architecture Web API with JWT Authentication and RBAC"
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

// 7. Initialize & Seed Database
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

// 8. Middleware Pipeline
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c => c.SwaggerEndpoint("/swagger/v1/swagger.json", "CoopIS API v1"));
}

app.UseCors("AllowFrontend");

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
