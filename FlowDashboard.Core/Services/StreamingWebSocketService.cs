using System.Collections.Concurrent;
using System.Net;
using System.Net.WebSockets;
using System.Text;
using System.Text.Json;

namespace FlowDashboard.Core.Services;

/// <summary>
/// Servicio WebSocket para streaming de frames WebP desde APK FlowAgent a clientes Electron.
/// Maneja conexiones de clientes, recepción de frames y broadcast.
/// </summary>
public class StreamingWebSocketService
{
    private readonly ILogger<StreamingWebSocketService> _logger;
    private readonly ConcurrentDictionary<string, ConnectedClient> _clients = new();
    private readonly ConcurrentDictionary<string, byte[]> _latestFrames = new(); // serial -> frame data
    private HttpListener? _httpListener;
    private CancellationTokenSource? _cancellationTokenSource;
    private Task? _listenerTask;

    public StreamingWebSocketService(ILogger<StreamingWebSocketService> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Registra un cliente WebSocket conectado
    /// </summary>
    public void RegisterClient(string clientId, WebSocket webSocket)
    {
        var client = new ConnectedClient { Id = clientId, WebSocket = webSocket };
        _clients.TryAdd(clientId, client);
        _logger.LogInformation($"✅ Cliente WebSocket registrado: {clientId} (total: {_clients.Count})");
    }

    /// <summary>
    /// Desregistra un cliente WebSocket desconectado
    /// </summary>
    public void UnregisterClient(string clientId)
    {
        _clients.TryRemove(clientId, out _);
        _logger.LogInformation($"🔌 Cliente WebSocket desregistrado: {clientId} (total: {_clients.Count})");
    }

    /// <summary>
    /// Inicia el servidor WebSocket en el puerto especificado
    /// </summary>
    public async Task StartAsync(int port)
    {
        try
        {
            _logger.LogInformation($"✅ WebSocket streaming iniciado en puerto {port}");
            // El servicio ahora usa el middleware de ASP.NET Core
            // No necesita escuchar en un puerto separado
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error iniciando WebSocket streaming");
            throw;
        }
    }

    /// <summary>
    /// Detiene el servidor WebSocket
    /// </summary>
    public async Task StopAsync()
    {
        try
        {
            _cancellationTokenSource?.Cancel();
            _httpListener?.Stop();
            _httpListener?.Close();

            if (_listenerTask != null)
            {
                await _listenerTask;
            }

            _logger.LogInformation("✅ WebSocket streaming detenido");
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "❌ Error deteniendo WebSocket streaming");
        }
    }

    /// <summary>
    /// Loop principal que acepta conexiones WebSocket
    /// </summary>
    private async Task ListenForConnectionsAsync(CancellationToken cancellationToken)
    {
        while (!cancellationToken.IsCancellationRequested)
        {
            try
            {
                HttpListenerContext context = await _httpListener!.GetContextAsync();
                if (!context.Request.IsWebSocketRequest)
                {
                    context.Response.StatusCode = 400;
                    context.Response.Close();
                    continue;
                }

                HttpListenerWebSocketContext webSocketContext = await context.AcceptWebSocketAsync(null);
                WebSocket webSocket = webSocketContext.WebSocket;
                string clientId = Guid.NewGuid().ToString();

                var client = new ConnectedClient { Id = clientId, WebSocket = webSocket };
                _clients.TryAdd(clientId, client);

                _logger.LogInformation($"✅ Cliente WebSocket conectado: {clientId}");

                // Manejar cliente en background
                _ = HandleClientAsync(clientId, webSocket, cancellationToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error aceptando conexión WebSocket");
            }
        }
    }

    /// <summary>
    /// Maneja un cliente WebSocket conectado
    /// </summary>
    private async Task HandleClientAsync(string clientId, WebSocket webSocket, CancellationToken cancellationToken)
    {
        byte[] buffer = new byte[1024 * 64]; // 64KB buffer para frames

        try
        {
            while (webSocket.State == WebSocketState.Open && !cancellationToken.IsCancellationRequested)
            {
                WebSocketReceiveResult result = await webSocket.ReceiveAsync(
                    new ArraySegment<byte>(buffer),
                    cancellationToken
                );

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    await webSocket.CloseAsync(
                        WebSocketCloseStatus.NormalClosure,
                        "Cerrando",
                        CancellationToken.None
                    );
                }
                else if (result.MessageType == WebSocketMessageType.Text)
                {
                    string message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                    await HandleClientMessageAsync(clientId, message);
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"❌ Error manejando cliente {clientId}");
        }
        finally
        {
            _clients.TryRemove(clientId, out _);
            webSocket.Dispose();
            _logger.LogInformation($"✅ Cliente WebSocket desconectado: {clientId}");
        }
    }

    /// <summary>
    /// Maneja un mensaje recibido de un cliente
    /// </summary>
    public async Task HandleClientMessageAsync(string clientId, string message)
    {
        try
        {
            using JsonDocument doc = JsonDocument.Parse(message);
            string type = doc.RootElement.GetProperty("type").GetString() ?? "";

            if (type == "ping")
            {
                // Responder a ping
                await SendToClientAsync(clientId, new { type = "pong" });
            }
            else if (type == "subscribe")
            {
                // Cliente se suscribe a frames de un dispositivo
                string serial = doc.RootElement.GetProperty("serial").GetString() ?? "";
                if (!string.IsNullOrEmpty(serial))
                {
                    if (!_clients.TryGetValue(clientId, out var client))
                        return;

                    client.SubscribedSerials.Add(serial);
                    _logger.LogDebug($"📡 Cliente {clientId} suscrito a {serial}");

                    // Enviar último frame si existe
                    if (_latestFrames.TryGetValue(serial, out var frameData))
                    {
                        await SendFrameToClientAsync(clientId, serial, frameData);
                    }
                }
            }
            else if (type == "unsubscribe")
            {
                // Cliente se desuscribe de frames
                string serial = doc.RootElement.GetProperty("serial").GetString() ?? "";
                if (!string.IsNullOrEmpty(serial))
                {
                    if (_clients.TryGetValue(clientId, out var client))
                    {
                        client.SubscribedSerials.Remove(serial);
                        _logger.LogDebug($"📡 Cliente {clientId} desuscrito de {serial}");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"❌ Error procesando mensaje de cliente {clientId}");
        }
    }

    /// <summary>
    /// Recibe un frame WebP desde el APK y lo broadcast a clientes suscritos
    /// </summary>
    public async Task ReceiveFrameAsync(string serial, string format, byte[] frameData)
    {
        try
        {
            // Guardar último frame
            _latestFrames[serial] = frameData;

            // Convertir a base64 para envío
            string base64Data = Convert.ToBase64String(frameData);

            // Broadcast a clientes suscritos
            var frameMessage = new
            {
                type = "frame",
                serial,
                format,
                data = base64Data,
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
            };

            await BroadcastToSubscribersAsync(serial, frameMessage);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"❌ Error recibiendo frame para {serial}");
        }
    }

    /// <summary>
    /// Broadcast un mensaje a todos los clientes suscritos a un dispositivo
    /// </summary>
    private async Task BroadcastToSubscribersAsync(string serial, object message)
    {
        var tasks = new List<Task>();

        foreach (var kvp in _clients)
        {
            if (kvp.Value.SubscribedSerials.Contains(serial))
            {
                tasks.Add(SendToClientAsync(kvp.Key, message));
            }
        }

        if (tasks.Count > 0)
        {
            await Task.WhenAll(tasks);
        }
    }

    /// <summary>
    /// Envía un frame a un cliente específico
    /// </summary>
    private async Task SendFrameToClientAsync(string clientId, string serial, byte[] frameData)
    {
        string base64Data = Convert.ToBase64String(frameData);
        var frameMessage = new
        {
            type = "frame",
            serial,
            format = "webp",
            data = base64Data,
            timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        };

        await SendToClientAsync(clientId, frameMessage);
    }

    /// <summary>
    /// Envía un mensaje JSON a un cliente específico
    /// </summary>
    private async Task SendToClientAsync(string clientId, object message)
    {
        try
        {
            if (!_clients.TryGetValue(clientId, out var client))
                return;

            if (client.WebSocket.State != WebSocketState.Open)
                return;

            string json = JsonSerializer.Serialize(message);
            byte[] buffer = Encoding.UTF8.GetBytes(json);

            await client.WebSocket.SendAsync(
                new ArraySegment<byte>(buffer),
                WebSocketMessageType.Text,
                true,
                CancellationToken.None
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, $"❌ Error enviando mensaje a cliente {clientId}");
        }
    }

    /// <summary>
    /// Obtiene estadísticas del servicio
    /// </summary>
    public object GetStats()
    {
        return new
        {
            connectedClients = _clients.Count,
            cachedFrames = _latestFrames.Count,
            clients = _clients.Values.Select(c => new
            {
                id = c.Id,
                subscribedSerials = c.SubscribedSerials.ToList()
            }).ToList()
        };
    }

    /// <summary>
    /// Clase interna para representar un cliente conectado
    /// </summary>
    private class ConnectedClient
    {
        public string Id { get; set; } = "";
        public WebSocket WebSocket { get; set; } = null!;
        public HashSet<string> SubscribedSerials { get; set; } = new();
    }
}
