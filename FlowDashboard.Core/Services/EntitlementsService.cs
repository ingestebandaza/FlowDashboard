using System.Text.Json;

namespace FlowDashboard.Core.Services;

public class EntitlementsService
{
    private readonly object _lock = new();
    private readonly HashSet<string> _features = new(StringComparer.OrdinalIgnoreCase);
    private bool _loaded;
    private string? _plan;
    private string? _status;
    private DateTime? _lastUpdated;
    private string? _source;

    private static readonly Dictionary<string, string> PathFeatureMap = new(StringComparer.OrdinalIgnoreCase)
    {
        { "/api/devices/execute", "adb.shell" },
        { "/api/devices/install-apk", "apps.manage" },
        { "/api/devices/flowlogin/start", "flowlogin.execute" }
    };

    public bool EnforcementEnabled => IsTruthy(Environment.GetEnvironmentVariable("FLOWDASHBOARD_ENFORCE_ENTITLEMENTS"));

    private static bool IsTruthy(string? value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        var normalized = value.Trim().ToLowerInvariant();
        return normalized is "1" or "true" or "yes" or "on";
    }

    public void SetEntitlements(JsonElement payload, string source)
    {
        lock (_lock)
        {
            _features.Clear();

            if (payload.ValueKind == JsonValueKind.Object)
            {
                if (payload.TryGetProperty("features", out var featuresElement) && featuresElement.ValueKind == JsonValueKind.Array)
                {
                    foreach (var item in featuresElement.EnumerateArray())
                    {
                        if (item.ValueKind == JsonValueKind.String)
                        {
                            var code = item.GetString();
                            if (!string.IsNullOrWhiteSpace(code))
                            {
                                _features.Add(code);
                            }
                        }
                    }
                }

                if (payload.TryGetProperty("plan", out var planElement) && planElement.ValueKind == JsonValueKind.String)
                {
                    _plan = planElement.GetString();
                }

                if (payload.TryGetProperty("status", out var statusElement) && statusElement.ValueKind == JsonValueKind.String)
                {
                    _status = statusElement.GetString();
                }
            }

            _loaded = true;
            _source = source;
            _lastUpdated = DateTime.UtcNow;
        }
    }

    public void Clear()
    {
        lock (_lock)
        {
            _features.Clear();
            _loaded = false;
            _plan = null;
            _status = null;
            _source = null;
            _lastUpdated = null;
        }
    }

    public bool IsFeatureAllowed(string code)
    {
        if (!EnforcementEnabled)
        {
            return true;
        }

        lock (_lock)
        {
            if (!_loaded)
            {
                return true;
            }

            if (_features.Count == 0)
            {
                return true;
            }

            return _features.Contains(code);
        }
    }

    public (bool Allowed, string? Feature) CheckPath(string path)
    {
        if (string.IsNullOrWhiteSpace(path))
        {
            return (true, null);
        }

        var normalized = path.TrimEnd('/');
        if (normalized.Length == 0)
        {
            normalized = "/";
        }

        if (!PathFeatureMap.TryGetValue(normalized, out var feature))
        {
            return (true, null);
        }

        return (IsFeatureAllowed(feature), feature);
    }

    public object GetState()
    {
        lock (_lock)
        {
            return new
            {
                enforcement_enabled = EnforcementEnabled,
                loaded = _loaded,
                plan = _plan,
                status = _status,
                source = _source,
                features = _features.ToArray(),
                features_count = _features.Count,
                last_updated = _lastUpdated
            };
        }
    }
}
