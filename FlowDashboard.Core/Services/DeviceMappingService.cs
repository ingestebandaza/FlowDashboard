using System.Collections.Concurrent;
using System.Text.Json;

namespace FlowDashboard.Core.Services;

/// <summary>
/// Servicio para mapear ANDROID_ID (identificador único del dispositivo Android)
/// con la dirección IP:PUERTO del dispositivo en ADB.
/// 
/// Esto permite que el streaming WebSocket use un identificador estable
/// en lugar de la dirección IP que puede cambiar.
/// 
/// Los mappings se persisten en un archivo JSON para sobrevivir reinicios.
/// </summary>
public class DeviceMappingService
{
    private readonly ConcurrentDictionary<string, DeviceMapping> _mappings = new();
    private readonly ILogger<DeviceMappingService> _logger;
    private readonly string _mappingsFilePath;
    private readonly object _fileLock = new object();

    public DeviceMappingService(ILogger<DeviceMappingService> logger)
    {
        _logger = logger;
        var legacyPath = Path.Combine(AppPaths.BaseDir, "device_mappings.json");
        _mappingsFilePath = AppPaths.DataFile("device_mappings.json");
        AppPaths.MigrateFileIfMissing(legacyPath, _mappingsFilePath);
        LoadMappingsFromFile();
    }

    /// <summary>
    /// Carga los mappings desde el archivo JSON
    /// </summary>
    private void LoadMappingsFromFile()
    {
        try
        {
            if (File.Exists(_mappingsFilePath))
            {
                var json = File.ReadAllText(_mappingsFilePath);
                var mappingsList = JsonSerializer.Deserialize<List<DeviceMapping>>(json);
                
                if (mappingsList != null)
                {
                    foreach (var mapping in mappingsList)
                    {
                        _mappings.TryAdd(mapping.AndroidId, mapping);
                    }
                    _logger.LogInformation($"✅ Cargados {mappingsList.Count} mappings desde archivo");
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error cargando mappings desde archivo");
        }
    }

    /// <summary>
    /// Guarda los mappings en el archivo JSON
    /// </summary>
    private void SaveMappingsToFile()
    {
        try
        {
            lock (_fileLock)
            {
                var mappingsList = _mappings.Values.ToList();
                var json = JsonSerializer.Serialize(mappingsList, new JsonSerializerOptions { WriteIndented = true });
                AppPaths.AtomicWriteText(_mappingsFilePath, json + Environment.NewLine);
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error guardando mappings en archivo");
        }
    }

    /// <summary>
    /// Registra un mapeo entre ANDROID_ID y dirección ADB
    /// </summary>
    public void RegisterDevice(string androidId, string adbSerial)
    {
        var mapping = new DeviceMapping
        {
            AndroidId = androidId,
            AdbSerial = adbSerial,
            RegisteredAt = DateTime.UtcNow,
            LastSeen = DateTime.UtcNow
        };

        _mappings.AddOrUpdate(androidId, mapping, (key, old) =>
        {
            mapping.RegisteredAt = old.RegisteredAt;
            return mapping;
        });

        _logger.LogInformation($"📱 Dispositivo registrado: {androidId} → {adbSerial}");
        
        // Guardar en archivo
        SaveMappingsToFile();
    }

    /// <summary>
    /// Obtiene el ANDROID_ID a partir del serial ADB
    /// </summary>
    public string? GetAndroidIdByAdbSerial(string adbSerial)
    {
        var mapping = _mappings.Values.FirstOrDefault(m => m.AdbSerial == adbSerial);
        return mapping?.AndroidId;
    }

    /// <summary>
    /// Obtiene el serial ADB a partir del ANDROID_ID
    /// </summary>
    public string? GetAdbSerialByAndroidId(string androidId)
    {
        if (_mappings.TryGetValue(androidId, out var mapping))
        {
            mapping.LastSeen = DateTime.UtcNow;
            return mapping.AdbSerial;
        }
        return null;
    }

    /// <summary>
    /// Obtiene todos los mapeos
    /// </summary>
    public List<DeviceMapping> GetAllMappings()
    {
        return _mappings.Values.ToList();
    }

    /// <summary>
    /// Actualiza el último acceso de un dispositivo
    /// </summary>
    public void UpdateLastSeen(string androidId)
    {
        if (_mappings.TryGetValue(androidId, out var mapping))
        {
            mapping.LastSeen = DateTime.UtcNow;
        }
    }
}

public class DeviceMapping
{
    public string AndroidId { get; set; } = string.Empty;
    public string AdbSerial { get; set; } = string.Empty;
    public DateTime RegisteredAt { get; set; }
    public DateTime LastSeen { get; set; }
}
