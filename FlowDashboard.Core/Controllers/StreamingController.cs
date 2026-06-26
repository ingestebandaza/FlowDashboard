using Microsoft.AspNetCore.Mvc;
using FlowDashboard.Core.Services;
using FlowDashboard.Core.Models;

namespace FlowDashboard.Core.Controllers;

[ApiController]
[Route("api/streaming")]
public class StreamingController : ControllerBase
{
    private readonly ScrcpyService _scrcpyService;
    private readonly StreamingWebSocketService _webSocketService;
    private readonly ILogger<StreamingController> _logger;

    public StreamingController(
        ScrcpyService scrcpyService,
        StreamingWebSocketService webSocketService,
        ILogger<StreamingController> logger)
    {
        _scrcpyService = scrcpyService;
        _webSocketService = webSocketService;
        _logger = logger;
    }

    [HttpPost("start-embedded")]
    public IActionResult StartEmbedded([FromBody] EmbeddedStreamRequest request)
    {
        try
        {
            _logger.LogInformation($"[Embedded] serials={request.Serials.Count} parentHwnd=0x{request.ParentHwnd:X} quality={request.Quality}");

            var quality = GetQualitySettings(request.Quality);
            var usesExplicitPositions = request.Positions.Count == request.Serials.Count;
            var layout = usesExplicitPositions
                ? request.Positions
                : CalculateLayout(request.Serials.Count, request.Layout);
            var hasParent = request.ParentHwnd != 0;
            var streams = new List<StreamInfo>();

            for (int i = 0; i < request.Serials.Count; i++)
            {
                var serial = request.Serials[i];
                var position = layout[i];

                var config = new StreamConfig
                {
                    Serial = serial,
                    X = position.X,
                    Y = position.Y,
                    Width = position.Width,
                    Height = position.Height,
                    MaxSize = quality.MaxSize,
                    MaxFps = quality.MaxFps,
                    BitRate = quality.BitRate,
                    Borderless = true,
                    // Con parent real reparenteamos -> always-on-top no aplica.
                    // Sin parent (modo legado), conservamos always-on-top cuando hay posiciones explicitas.
                    AlwaysOnTop = !hasParent && usesExplicitPositions,
                    NoControl = usesExplicitPositions,
                    Restart = !hasParent, // con reparenting podemos reusar; en modo legado seguimos con restart
                    ParentHwnd = request.ParentHwnd
                };

                var streamInfo = _scrcpyService.StartStream(config);
                streams.Add(streamInfo);
            }

            return Ok(new { streams });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error iniciando streaming embebido");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("stop")]
    public IActionResult Stop([FromBody] StopStreamRequest request)
    {
        try
        {
            var success = _scrcpyService.StopStream(request.Serial);
            return Ok(new { success, message = success ? "Stream detenido" : "Stream no encontrado" });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"Error deteniendo stream {request.Serial}");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("reposition")]
    public IActionResult Reposition([FromBody] RepositionStreamsRequest request)
    {
        try
        {
            var hasParent = request.ParentHwnd != 0;
            if (!hasParent)
            {
                return BadRequest(new { error = "parentHwnd requerido para reposicionar streams embebidos" });
            }

            var moved = _scrcpyService.RepositionMany(request.ParentHwnd, request.Items);
            return Ok(new { moved });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error reposicionando streams");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("set-visibility")]
    public IActionResult SetVisibility([FromBody] SetVisibilityRequest request)
    {
        try
        {
            _scrcpyService.SetVisibilityAll(request.Visible);
            return Ok(new { ok = true });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error cambiando visibilidad de streams");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("stop-all")]
    public IActionResult StopAll()
    {
        try
        {
            var activeStreams = _scrcpyService.GetActiveStreams();
            var stopped = 0;

            foreach (var stream in activeStreams)
            {
                if (_scrcpyService.StopStream(stream.Serial))
                {
                    stopped++;
                }
            }

            return Ok(new { success = true, stopped });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error deteniendo todos los streams");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("active")]
    public IActionResult GetActive()
    {
        try
        {
            var streams = _scrcpyService.GetActiveStreams();
            return Ok(new { streams });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo streams activos");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpPost("frames")]
    public async Task<IActionResult> ReceiveFrame([FromBody] FrameData frameData)
    {
        try
        {
            if (frameData == null || string.IsNullOrEmpty(frameData.Serial))
            {
                return BadRequest(new { error = "Serial requerido" });
            }

            if (string.IsNullOrEmpty(frameData.Data))
            {
                return BadRequest(new { error = "Frame data requerido" });
            }

            // Decodificar base64 a bytes
            byte[] frameBytes = Convert.FromBase64String(frameData.Data);

            // Enviar frame a WebSocket service para broadcast
            await _webSocketService.ReceiveFrameAsync(
                frameData.Serial,
                frameData.Format,
                frameBytes
            );

            _logger.LogDebug($"[Frame] serial={frameData.Serial} format={frameData.Format} size={frameBytes.Length} bytes");

            return Ok(new { ok = true, received = frameBytes.Length });
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error recibiendo frame");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    [HttpGet("stats")]
    public IActionResult GetStats()
    {
        try
        {
            var stats = _webSocketService.GetStats();
            return Ok(stats);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error obteniendo estadísticas");
            return StatusCode(500, new { error = ex.Message });
        }
    }

    private QualitySettings GetQualitySettings(string quality)
    {
        return quality?.ToLower() switch
        {
            "360p" => new QualitySettings { MaxSize = 360, BitRate = "1M", MaxFps = 24 },
            "480p" => new QualitySettings { MaxSize = 480, BitRate = "2M", MaxFps = 30 },
            "600p" => new QualitySettings { MaxSize = 600, BitRate = "3M", MaxFps = 30 },
            "720p" => new QualitySettings { MaxSize = 720, BitRate = "4M", MaxFps = 30 },
            "1080p" => new QualitySettings { MaxSize = 1080, BitRate = "8M", MaxFps = 30 },
            "4k" => new QualitySettings { MaxSize = 2160, BitRate = "16M", MaxFps = 30 },
            _ => new QualitySettings { MaxSize = 720, BitRate = "4M", MaxFps = 30 } // Default 720p
        };
    }

    private List<StreamPosition> CalculateLayout(int deviceCount, LayoutConfig? layoutConfig)
    {
        var config = layoutConfig ?? new LayoutConfig
        {
            Columns = 2,
            ContainerWidth = 1200,
            ContainerHeight = 800
        };

        var positions = new List<StreamPosition>();
        var columns = Math.Min(config.Columns, deviceCount);
        var rows = (int)Math.Ceiling((double)deviceCount / columns);

        var gap = 12;
        var availableWidth = config.ContainerWidth - (gap * (columns + 1));
        var availableHeight = config.ContainerHeight - (gap * (rows + 1));

        var cellWidth = availableWidth / columns;
        var cellHeight = availableHeight / rows;

        // Mantener aspect ratio 9:16 (vertical) o 16:9 (horizontal)
        var streamWidth = cellWidth;
        var streamHeight = (int)(streamWidth * 16.0 / 9.0);

        if (streamHeight > cellHeight)
        {
            streamHeight = cellHeight;
            streamWidth = (int)(streamHeight * 9.0 / 16.0);
        }

        for (int i = 0; i < deviceCount; i++)
        {
            var col = i % columns;
            var row = i / columns;

            var x = gap + (col * (cellWidth + gap)) + (cellWidth - streamWidth) / 2;
            var y = gap + (row * (cellHeight + gap)) + (cellHeight - streamHeight) / 2;

            positions.Add(new StreamPosition
            {
                X = x,
                Y = y,
                Width = streamWidth,
                Height = streamHeight
            });
        }

        return positions;
    }
}

// Request Models
public class EmbeddedStreamRequest
{
    public List<string> Serials { get; set; } = new();
    public string Quality { get; set; } = "720p";
    public List<StreamPosition> Positions { get; set; } = new();
    public LayoutConfig? Layout { get; set; }
    /// <summary>
    /// HWND nativo del contenedor (ventana Electron) al que reparentamos las ventanas scrcpy.
    /// Si es 0, se mantiene el comportamiento legado (overlay always-on-top).
    /// </summary>
    public long ParentHwnd { get; set; } = 0;
}

public class RepositionStreamsRequest
{
    public long ParentHwnd { get; set; } = 0;
    public List<RepositionItem> Items { get; set; } = new();
}

public class SetVisibilityRequest
{
    public bool Visible { get; set; } = true;
}

public class LayoutConfig
{
    public int Columns { get; set; } = 2;
    public int ContainerWidth { get; set; } = 1200;
    public int ContainerHeight { get; set; } = 800;
}

public class StopStreamRequest
{
    public string Serial { get; set; } = "";
}

public class QualitySettings
{
    public int MaxSize { get; set; }
    public string BitRate { get; set; } = "4M";
    public int MaxFps { get; set; } = 30;
}

public class StreamPosition
{
    public int X { get; set; }
    public int Y { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
}

public class FrameData
{
    public string Serial { get; set; } = "";
    public string Format { get; set; } = "webp"; // webp, png, jpeg
    public string Data { get; set; } = ""; // base64 encoded frame data
    public long Timestamp { get; set; } = 0;
}
