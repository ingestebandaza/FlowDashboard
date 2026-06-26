using Microsoft.AspNetCore.Mvc;
using FlowDashboard.Core.Services;
using System.Net.WebSockets;

namespace FlowDashboard.Core.Controllers;

[ApiController]
[Route("api/[controller]")]
public class VideoStreamController : ControllerBase
{
    private readonly VideoStreamingService _videoStreamingService;

    public VideoStreamController(VideoStreamingService videoStreamingService)
    {
        _videoStreamingService = videoStreamingService;
    }

    [HttpGet("ws/{serial}")]
    public async Task<IActionResult> StreamVideo(string serial, [FromQuery] int quality = 720, [FromQuery] int fps = 30)
    {
        if (!HttpContext.WebSockets.IsWebSocketRequest)
        {
            return BadRequest("WebSocket request expected");
        }

        try
        {
            var webSocket = await HttpContext.WebSockets.AcceptWebSocketAsync();
            
            Console.WriteLine($"🔌 WebSocket conectado para {serial}");

            var success = await _videoStreamingService.StartVideoStream(serial, webSocket, quality, fps);

            if (!success)
            {
                await webSocket.CloseAsync(
                    WebSocketCloseStatus.InternalServerError,
                    "Failed to start video stream",
                    CancellationToken.None
                );
                return StatusCode(500, "Failed to start video stream");
            }

            // Mantener la conexión abierta
            var buffer = new byte[1024];
            while (webSocket.State == WebSocketState.Open)
            {
                var result = await webSocket.ReceiveAsync(
                    new ArraySegment<byte>(buffer),
                    CancellationToken.None
                );

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await _videoStreamingService.StopVideoStream(serial);
                    await webSocket.CloseAsync(
                        WebSocketCloseStatus.NormalClosure,
                        "Client closed connection",
                        CancellationToken.None
                    );
                    break;
                }
            }

            return Ok();
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ Error en WebSocket para {serial}: {ex.Message}");
            return StatusCode(500, ex.Message);
        }
    }

    [HttpPost("stop/{serial}")]
    public async Task<IActionResult> StopStream(string serial)
    {
        var success = await _videoStreamingService.StopVideoStream(serial);
        return success ? Ok() : NotFound();
    }

    [HttpGet("active")]
    public ActionResult<List<string>> GetActiveStreams()
    {
        var streams = _videoStreamingService.GetActiveStreams();
        return Ok(streams);
    }
}
