using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using CoopIS.Domain.Entities;
using CoopIS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;

namespace CoopIS.Infrastructure.Services.RemoteAccess;

public class NgrokRemoteAccessService : IRemoteAccessService, IDisposable
{
    private readonly ILogger<NgrokRemoteAccessService> _logger;
    private readonly IConfiguration _configuration;
    private readonly IServiceScopeFactory? _scopeFactory;
    private readonly HttpClient _httpClient;
    private readonly SemaphoreSlim _semaphore = new(1, 1);

    // DB setting keys
    private const string KeyNgrokPath = "RemoteAccess:NgrokPath";
    private const string KeyAuthtoken = "RemoteAccess:Authtoken";
    private const string KeyAutoStart = "RemoteAccess:AutoStart";

    // Runtime state
    private Process? _ngrokProcess;
    private RemoteAccessStatusState _state = RemoteAccessStatusState.Disabled;
    private string? _publicUrl;
    private string? _localAddress;
    private DateTime? _startedAt;
    private string? _errorMessage;

    // Cached settings
    private string _ngrokPath = "ngrok";
    private string? _authtoken = null;
    private bool _autoStart = false;

    public NgrokRemoteAccessService(
        ILogger<NgrokRemoteAccessService> logger,
        IConfiguration configuration,
        IServiceScopeFactory? scopeFactory = null)
    {
        _logger = logger;
        _configuration = configuration;
        _scopeFactory = scopeFactory;
        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(3) };
    }

    public async Task<RemoteAccessStatusDto> GetStatusAsync(CancellationToken cancellationToken = default)
    {
        await _semaphore.WaitAsync(cancellationToken);
        try
        {
            await RefreshCachedSettingsAsync(cancellationToken);

            var activePublicUrl = await FetchNgrokPublicUrlAsync(cancellationToken);
            if (!string.IsNullOrEmpty(activePublicUrl))
            {
                _state = RemoteAccessStatusState.Running;
                _publicUrl = activePublicUrl;
                if (string.IsNullOrEmpty(_localAddress))
                    _localAddress = $"http://localhost:{GetLocalServerPort()}";
                _errorMessage = null;
            }
            else if (_ngrokProcess == null || _ngrokProcess.HasExited)
            {
                if (_state == RemoteAccessStatusState.Running)
                {
                    _state = RemoteAccessStatusState.Stopped;
                    _publicUrl = null;
                }
            }

            return BuildStatusDto();
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public async Task<RemoteAccessSettingsDto> GetSettingsAsync(CancellationToken cancellationToken = default)
    {
        await _semaphore.WaitAsync(cancellationToken);
        try
        {
            await RefreshCachedSettingsAsync(cancellationToken);
            return BuildSettingsDto();
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public async Task<RemoteAccessSettingsDto> UpdateSettingsAsync(
        UpdateRemoteAccessSettingsDto dto,
        CancellationToken cancellationToken = default)
    {
        await _semaphore.WaitAsync(cancellationToken);
        try
        {
            await RefreshCachedSettingsAsync(cancellationToken);

            if (dto.NgrokPath != null)
                _ngrokPath = dto.NgrokPath.Trim();

            if (dto.Authtoken != null)
            {
                var token = dto.Authtoken.Trim();
                _authtoken = string.IsNullOrEmpty(token) ? null : token;
            }

            if (dto.AutoStart.HasValue)
                _autoStart = dto.AutoStart.Value;

            await PersistSettingsAsync(cancellationToken);
            _logger.LogInformation("[RemoteAccess] Settings updated and persisted.");

            return BuildSettingsDto();
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public async Task<RemoteAccessStatusDto> StartTunnelAsync(CancellationToken cancellationToken = default)
    {
        await _semaphore.WaitAsync(cancellationToken);
        try
        {
            await RefreshCachedSettingsAsync(cancellationToken);

            // Check if ngrok is already running (e.g. externally via CLI)
            var existingPublicUrl = await FetchNgrokPublicUrlAsync(cancellationToken);
            if (!string.IsNullOrEmpty(existingPublicUrl))
            {
                _state = RemoteAccessStatusState.Running;
                _publicUrl = existingPublicUrl;
                _localAddress = $"http://localhost:{GetLocalServerPort()}";
                _startedAt ??= DateTime.UtcNow;
                _errorMessage = null;
                _logger.LogInformation("[RemoteAccess] Active ngrok tunnel discovered. Public URL: {PublicUrl}", _publicUrl);
                return BuildStatusDto();
            }

            if (_state == RemoteAccessStatusState.Running &&
                (_ngrokProcess is { HasExited: false } || !string.IsNullOrEmpty(_publicUrl)))
            {
                _logger.LogInformation("[RemoteAccess] Start requested but tunnel is already active.");
                return BuildStatusDto();
            }

            _state = RemoteAccessStatusState.Starting;
            _errorMessage = null;

            var (detected, path, version) = DetectNgrok(_ngrokPath);
            if (!detected || string.IsNullOrEmpty(path))
            {
                _state = RemoteAccessStatusState.NgrokNotFound;
                _errorMessage = "ngrok executable was not found. Please ensure ngrok is installed and available on PATH.";
                _logger.LogWarning("[RemoteAccess] ngrok executable not found at '{Path}'.", _ngrokPath);
                return BuildStatusDto();
            }

            if (!string.IsNullOrWhiteSpace(_authtoken))
                ConfigureAuthtoken(path, _authtoken);

            var localPort = GetLocalServerPort();
            _localAddress = $"http://localhost:{localPort}";

            _logger.LogInformation("[RemoteAccess] Starting ngrok process targeting {LocalAddress}...", _localAddress);

            var psi = new ProcessStartInfo
            {
                FileName = path,
                Arguments = $"http {localPort}",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };

            _ngrokProcess = new Process { StartInfo = psi };
            _ngrokProcess.EnableRaisingEvents = true;
            _ngrokProcess.Exited += (_, _) =>
            {
                if (_state is RemoteAccessStatusState.Running or RemoteAccessStatusState.Starting)
                {
                    _state = RemoteAccessStatusState.Error;
                    _errorMessage = "ngrok process terminated unexpectedly.";
                    _logger.LogWarning("[RemoteAccess] ngrok process exited unexpectedly.");
                }
            };

            _ngrokProcess.Start();

            string? publicUrl = null;
            for (int i = 0; i < 20; i++)
            {
                await Task.Delay(500, cancellationToken);

                if (_ngrokProcess.HasExited)
                {
                    _state = RemoteAccessStatusState.Error;
                    _errorMessage = "ngrok process failed to start or exited immediately. Please check your authtoken configuration.";
                    return BuildStatusDto();
                }

                publicUrl = await FetchNgrokPublicUrlAsync(cancellationToken);
                if (!string.IsNullOrEmpty(publicUrl)) break;
            }

            if (string.IsNullOrEmpty(publicUrl))
            {
                _state = RemoteAccessStatusState.Error;
                _errorMessage = "ngrok started but public URL could not be retrieved from local inspection endpoint (http://127.0.0.1:4040).";
                StopProcessInternal();
                return BuildStatusDto();
            }

            _state = RemoteAccessStatusState.Running;
            _publicUrl = publicUrl;
            _startedAt = DateTime.UtcNow;
            _errorMessage = null;

            _logger.LogInformation("[RemoteAccess] ngrok tunnel started successfully. Public URL: {PublicUrl} -> {LocalAddress}",
                _publicUrl, _localAddress);

            return BuildStatusDto();
        }
        catch (Exception ex)
        {
            _state = RemoteAccessStatusState.Error;
            _errorMessage = ex.Message;
            _logger.LogError(ex, "[RemoteAccess] Failed to start ngrok tunnel.");
            StopProcessInternal();
            return BuildStatusDto();
        }
        finally
        {
            _semaphore.Release();
        }
    }

    public async Task<RemoteAccessStatusDto> StopTunnelAsync(CancellationToken cancellationToken = default)
    {
        await _semaphore.WaitAsync(cancellationToken);
        try
        {
            _logger.LogInformation("[RemoteAccess] Stopping ngrok tunnel...");
            StopProcessInternal();

            _state = RemoteAccessStatusState.Stopped;
            _publicUrl = null;
            _startedAt = null;
            _errorMessage = null;

            return BuildStatusDto();
        }
        finally
        {
            _semaphore.Release();
        }
    }

    // -------------------------------------------------------------------------
    // Persistence & Cache
    // -------------------------------------------------------------------------

    private async Task RefreshCachedSettingsAsync(CancellationToken ct)
    {
        if (_scopeFactory is not null)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                var pathSetting = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == KeyNgrokPath, ct);
                var tokenSetting = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == KeyAuthtoken, ct);
                var autoStartSetting = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == KeyAutoStart, ct);

                if (pathSetting != null && !string.IsNullOrWhiteSpace(pathSetting.Value))
                    _ngrokPath = pathSetting.Value;

                _authtoken = tokenSetting?.Value;

                if (autoStartSetting != null && bool.TryParse(autoStartSetting.Value, out var autoVal))
                    _autoStart = autoVal;

                return;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[RemoteAccess] Could not load settings from DB; falling back to local file.");
            }
        }

        // Fallback to local app data file
        try
        {
            var jsonPath = GetLocalSettingsFilePath();
            if (File.Exists(jsonPath))
            {
                var json = await File.ReadAllTextAsync(jsonPath, ct);
                var fileSettings = JsonSerializer.Deserialize<FileStoredSettings>(json);
                if (fileSettings != null)
                {
                    _ngrokPath = fileSettings.NgrokPath ?? "ngrok";
                    _authtoken = fileSettings.Authtoken;
                    _autoStart = fileSettings.AutoStart;
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[RemoteAccess] Error reading local settings file.");
        }
    }

    private async Task PersistSettingsAsync(CancellationToken ct)
    {
        if (_scopeFactory is not null)
        {
            try
            {
                using var scope = _scopeFactory.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();

                await UpsertSettingAsync(db, KeyNgrokPath, _ngrokPath, ct);
                await UpsertSettingAsync(db, KeyAuthtoken, _authtoken, ct);
                await UpsertSettingAsync(db, KeyAutoStart, _autoStart ? "true" : "false", ct);

                await db.SaveChangesAsync(ct);
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "[RemoteAccess] Error persisting settings to DB.");
            }
        }

        // Also update local file for backup
        try
        {
            var jsonPath = GetLocalSettingsFilePath();
            var dir = Path.GetDirectoryName(jsonPath);
            if (!string.IsNullOrEmpty(dir) && !Directory.Exists(dir))
                Directory.CreateDirectory(dir);

            var fileSettings = new FileStoredSettings
            {
                NgrokPath = _ngrokPath,
                Authtoken = _authtoken,
                AutoStart = _autoStart
            };

            await File.WriteAllTextAsync(jsonPath, JsonSerializer.Serialize(fileSettings), ct);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[RemoteAccess] Error saving settings to local file.");
        }
    }

    private static async Task UpsertSettingAsync(AppDbContext db, string key, string? value, CancellationToken ct)
    {
        var existing = await db.AppSettings.FirstOrDefaultAsync(s => s.Key == key, ct);
        if (existing is null)
        {
            db.AppSettings.Add(new AppSetting { Key = key, Value = value, UpdatedAt = DateTime.UtcNow });
        }
        else
        {
            existing.Value = value;
            existing.UpdatedAt = DateTime.UtcNow;
        }
    }

    private static string GetLocalSettingsFilePath()
    {
        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        return Path.Combine(localAppData, "CoopIS", "remoteaccess.json");
    }

    // -------------------------------------------------------------------------
    // ngrok Process & Discovery Helpers
    // -------------------------------------------------------------------------

    private void StopProcessInternal()
    {
        if (_ngrokProcess is null) return;
        try
        {
            if (!_ngrokProcess.HasExited)
            {
                _ngrokProcess.Kill(entireProcessTree: true);
                _ngrokProcess.WaitForExit(2000);
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[RemoteAccess] Error stopping ngrok process.");
        }
        finally
        {
            _ngrokProcess.Dispose();
            _ngrokProcess = null;
        }
    }

    private RemoteAccessStatusDto BuildStatusDto() =>
        new(_state, _publicUrl, _localAddress ?? $"http://localhost:{GetLocalServerPort()}", _startedAt, _errorMessage);

    private RemoteAccessSettingsDto BuildSettingsDto()
    {
        var (detected, path, version) = DetectNgrok(_ngrokPath);
        return new RemoteAccessSettingsDto(
            _state == RemoteAccessStatusState.Running,
            detected ? (path ?? _ngrokPath) : _ngrokPath,
            !string.IsNullOrWhiteSpace(_authtoken),
            _autoStart,
            version,
            detected
        );
    }

    private (bool Detected, string? ExecutablePath, string? Version) DetectNgrok(string configuredPath)
    {
        var candidates = new List<string>();

        if (!string.IsNullOrWhiteSpace(configuredPath))
            candidates.Add(configuredPath);

        candidates.Add("ngrok");

        var localAppData = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        if (!string.IsNullOrEmpty(localAppData))
        {
            var winGetPackageDir = Path.Combine(localAppData, "Microsoft", "WinGet", "Packages");
            if (Directory.Exists(winGetPackageDir))
            {
                try
                {
                    var matches = Directory.GetFiles(winGetPackageDir, "ngrok.exe", SearchOption.AllDirectories);
                    candidates.AddRange(matches);
                }
                catch { }
            }
        }

        var userProfile = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        if (!string.IsNullOrEmpty(userProfile))
        {
            candidates.Add(Path.Combine(userProfile, "ngrok.exe"));
            candidates.Add(Path.Combine(userProfile, "AppData", "Local", "bin", "ngrok.exe"));
        }

        foreach (var candidatePath in candidates.Distinct())
        {
            try
            {
                var psi = new ProcessStartInfo
                {
                    FileName = candidatePath,
                    Arguments = "--version",
                    UseShellExecute = false,
                    CreateNoWindow = true,
                    RedirectStandardOutput = true,
                    RedirectStandardError = true
                };

                using var proc = Process.Start(psi);
                if (proc is not null)
                {
                    var output = proc.StandardOutput.ReadToEnd();
                    proc.WaitForExit(3000);
                    if (proc.ExitCode == 0)
                        return (true, candidatePath, output.Trim());
                }
            }
            catch { }
        }

        return (false, null, null);
    }

    private void ConfigureAuthtoken(string ngrokPath, string authtoken)
    {
        try
        {
            var psi = new ProcessStartInfo
            {
                FileName = ngrokPath,
                Arguments = $"config add-authtoken {authtoken}",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true
            };

            using var proc = Process.Start(psi);
            proc?.WaitForExit(5000);
            _logger.LogInformation("[RemoteAccess] Configured ngrok authtoken successfully.");
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "[RemoteAccess] Error configuring ngrok authtoken.");
        }
    }

    private async Task<string?> FetchNgrokPublicUrlAsync(CancellationToken ct)
    {
        try
        {
            var response = await _httpClient.GetFromJsonAsync<NgrokTunnelsResponse>(
                "http://127.0.0.1:4040/api/tunnels", ct);
            var httpsTunnel = response?.Tunnels?.FirstOrDefault(
                t => t.Proto == "https" || t.PublicUrl?.StartsWith("https") == true);
            return (httpsTunnel ?? response?.Tunnels?.FirstOrDefault())?.PublicUrl;
        }
        catch { return null; }
    }

    private int GetLocalServerPort()
    {
        // In local development, forward port 5173 (Vite) so remote users land directly on the web app UI
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(500) };
            var response = client.GetAsync("http://localhost:5173").GetAwaiter().GetResult();
            if (response.IsSuccessStatusCode || response.StatusCode == System.Net.HttpStatusCode.NotFound)
                return 5173;
        }
        catch { }

        // Fallback to API port
        var urls = _configuration["ASPNETCORE_URLS"] ?? _configuration["Urls"];
        if (!string.IsNullOrEmpty(urls))
        {
            foreach (var part in urls.Split(';', StringSplitOptions.RemoveEmptyEntries))
            {
                if (Uri.TryCreate(part, UriKind.Absolute, out var uri))
                    return uri.Port;
            }
        }
        return 5208;
    }

    public void Dispose()
    {
        StopProcessInternal();
        _semaphore.Dispose();
        _httpClient.Dispose();
    }

    private class FileStoredSettings
    {
        public string? NgrokPath { get; set; } = "ngrok";
        public string? Authtoken { get; set; }
        public bool AutoStart { get; set; } = false;
    }

    private class NgrokTunnelsResponse
    {
        [JsonPropertyName("tunnels")]
        public List<NgrokTunnel>? Tunnels { get; set; }
    }

    private class NgrokTunnel
    {
        [JsonPropertyName("public_url")]
        public string? PublicUrl { get; set; }

        [JsonPropertyName("proto")]
        public string? Proto { get; set; }
    }
}
