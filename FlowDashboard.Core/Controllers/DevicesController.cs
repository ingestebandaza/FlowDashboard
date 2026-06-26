using Microsoft.AspNetCore.Mvc;
using FlowDashboard.Core.Services;
using FlowDashboard.Core.Models;

namespace FlowDashboard.Core.Controllers;

[ApiController]
[Route("api/[controller]")]
public class DevicesController : ControllerBase
{
    private readonly AdbService _adbService;
    private readonly PythonBridgeService _pythonBridge;
    private readonly DeviceMappingService _deviceMapping;

    public DevicesController(AdbService adbService, PythonBridgeService pythonBridge, DeviceMappingService deviceMapping)
    {
        _adbService = adbService;
        _pythonBridge = pythonBridge;
        _deviceMapping = deviceMapping;
    }

    [HttpGet]
    public ActionResult<List<Device>> GetDevices()
    {
        var devices = _adbService.GetConnectedDevices();
        return Ok(devices);
    }

    /// <summary>
    /// Endpoint para que el APK registre su ANDROID_ID
    /// </summary>
    [HttpPost("register")]
    public ActionResult RegisterDevice([FromBody] RegisterDeviceRequest request)
    {
        try
        {
            if (string.IsNullOrEmpty(request.AndroidId) || string.IsNullOrEmpty(request.AdbSerial))
            {
                return BadRequest(new { error = "androidId y adbSerial son requeridos" });
            }

            _deviceMapping.RegisterDevice(request.AndroidId, request.AdbSerial);
            return Ok(new { success = true, message = "Dispositivo registrado" });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Obtiene el ANDROID_ID de un dispositivo dado su serial ADB
    /// Usado por Electron para suscribirse al streaming correcto
    /// </summary>
    [HttpGet("mapping/{adbSerial}")]
    public ActionResult<object> GetAndroidId(string adbSerial)
    {
        try
        {
            var androidId = _deviceMapping.GetAndroidIdByAdbSerial(adbSerial);
            if (string.IsNullOrEmpty(androidId))
            {
                return NotFound(new { error = $"No se encontró mapeo para {adbSerial}" });
            }

            return Ok(new { adbSerial, androidId });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    /// <summary>
    /// Obtiene todos los mapeos de dispositivos
    /// </summary>
    [HttpGet("mappings")]
    public ActionResult<List<object>> GetAllMappings()
    {
        try
        {
            var mappings = _deviceMapping.GetAllMappings();
            return Ok(mappings.Select(m => new { m.AndroidId, m.AdbSerial, m.RegisteredAt, m.LastSeen }).ToList());
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("execute")]
    public async Task<ActionResult<string>> ExecuteCommand([FromBody] CommandRequest request)
    {
        try
        {
            var result = await _adbService.ExecuteShellCommand(request.Serial, request.Command);
            return Ok(new { serial = request.Serial, result });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("install-apk")]
    public async Task<ActionResult> InstallApk([FromBody] InstallApkRequest request)
    {
        try
        {
            var success = await _adbService.InstallApk(request.Serial, request.ApkPath);
            return Ok(new { success });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("flowlogin/start")]
    public async Task<ActionResult> StartFlowLogin([FromBody] FlowLoginRequest request)
    {
        try
        {
            var success = await _pythonBridge.StartFlowLogin(request.Serial, request.Accounts);
            return Ok(new { success });
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("flowlogin/status")]
    public async Task<ActionResult> GetFlowLoginStatus([FromQuery] string serial)
    {
        try
        {
            var status = await _pythonBridge.GetFlowLoginStatus(serial);
            return Ok(status);
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("{serial}/screenshot")]
    public async Task<IActionResult> GetScreenshot(string serial)
    {
        try
        {
            var screenshotBytes = await _adbService.CaptureScreenshot(serial);
            
            if (screenshotBytes == null || screenshotBytes.Length == 0)
            {
                return NotFound(new { error = "No se pudo capturar screenshot" });
            }

            return File(screenshotBytes, "image/png");
        }
        catch (Exception ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("adb/connect")]
    public async Task<ActionResult> ConnectDevice([FromBody] ConnectRequest request)
    {
        try
        {
            var success = await _adbService.ConnectDevice(request.Serial);
            return Ok(new { success, serial = request.Serial });
        }
        catch (Exception ex)
        {
            return Ok(new { success = false, error = ex.Message });
        }
    }
}

public class InstallApkRequest
{
    public string Serial { get; set; } = string.Empty;
    public string ApkPath { get; set; } = string.Empty;
}

public class FlowLoginRequest
{
    public string Serial { get; set; } = string.Empty;
    public List<object> Accounts { get; set; } = new();
}

public class ConnectRequest
{
    public string Serial { get; set; } = string.Empty;
}
