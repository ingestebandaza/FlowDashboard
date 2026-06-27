using FlowDashboard.Core.Services;
using FlowDashboard.Core.Hubs;
using System.Net.WebSockets;
using System.Net;
using System.Reflection;
using System.Text.Json;
// using FlowDashboard.Core.Hubs; // Comentado temporalmente - Canvas Streaming en desarrollo

var builder = WebApplication.CreateBuilder(args);
var coreVersion = Assembly.GetExecutingAssembly()
    .GetCustomAttribute<AssemblyInformationalVersionAttribute>()?
    .InformationalVersion ?? "2.0.0";

// Configurar CORS para Electron
builder.Services.AddCors(options =>
{
    options.AddPolicy("AllowElectron", policy =>
    {
        policy.WithOrigins("http://localhost:*", "file://")
              .AllowAnyMethod()
              .AllowAnyHeader()
              .AllowCredentials();
    });
});

// Agregar servicios
builder.Services.AddControllers();
builder.Services.AddSignalR(); // Habilitado para Canvas Streaming
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Servicios personalizados
builder.Services.AddSingleton<AdbService>();
builder.Services.AddSingleton<ScrcpyService>();
builder.Services.AddSingleton<PythonBridgeService>();
builder.Services.AddSingleton<VideoStreamingService>();
builder.Services.AddSingleton<StreamingWebSocketService>();
builder.Services.AddSingleton<DeviceMappingService>();
builder.Services.AddSingleton<MailService>();
builder.Services.AddSingleton<EntitlementsService>();
// builder.Services.AddSingleton<CanvasStreamingService>(); // Comentado temporalmente - Canvas Streaming en desarrollo

var app = builder.Build();

// Habilitar WebSockets PRIMERO
app.UseWebSockets();

// Manejar WebSocket para video streaming ANTES de otros middleware
app.Use(async (context, next) =>
{
    if (context.Request.Path.StartsWithSegments("/ws/streaming"))
    {
        if (context.WebSockets.IsWebSocketRequest)
        {
            var webSocket = await context.WebSockets.AcceptWebSocketAsync();
            var streamingService = context.RequestServices.GetRequiredService<StreamingWebSocketService>();
            
            Console.WriteLine($"🔌 WebSocket streaming conectado");
            
            // Generar ID único para el cliente
            string clientId = Guid.NewGuid().ToString();
            
            // Registrar cliente en el servicio
            streamingService.RegisterClient(clientId, webSocket);
            
            var buffer = new byte[1024 * 64]; // 64KB buffer para frames
            
            try
            {
                while (webSocket.State == WebSocketState.Open)
                {
                    try
                    {
                        var result = await webSocket.ReceiveAsync(
                            new ArraySegment<byte>(buffer),
                            CancellationToken.None
                        );

                        if (result.MessageType == WebSocketMessageType.Close)
                        {
                            await webSocket.CloseAsync(
                                WebSocketCloseStatus.NormalClosure,
                                "Client closed",
                                CancellationToken.None
                            );
                            break;
                        }
                        
                        // Procesar mensaje recibido
                        if (result.Count > 0)
                        {
                            string message = System.Text.Encoding.UTF8.GetString(buffer, 0, result.Count);
                            await streamingService.HandleClientMessageAsync(clientId, message);
                        }
                    }
                    catch (OperationCanceledException)
                    {
                        // Timeout o cancelación - cerrar conexión
                        break;
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"❌ Error en WebSocket: {ex.Message}");
            }
            finally
            {
                if (webSocket.State != WebSocketState.Closed)
                {
                    try
                    {
                        await webSocket.CloseAsync(
                            WebSocketCloseStatus.InternalServerError,
                            "Server error",
                            CancellationToken.None
                        );
                    }
                    catch { }
                }
                webSocket.Dispose();
                streamingService.UnregisterClient(clientId);
                Console.WriteLine($"🔌 WebSocket streaming desconectado: {clientId}");
            }
            
            return;
        }
        else
        {
            context.Response.StatusCode = 400;
            return;
        }
    }
    
    if (context.Request.Path.StartsWithSegments("/api/videostream/ws"))
    {
        if (context.WebSockets.IsWebSocketRequest)
        {
            var pathParts = context.Request.Path.Value?.Split('/');
            var serial = pathParts?.LastOrDefault();
            
            if (!string.IsNullOrEmpty(serial))
            {
                var quality = int.TryParse(context.Request.Query["quality"], out var q) ? q : 720;
                var fps = int.TryParse(context.Request.Query["fps"], out var f) ? f : 30;
                
                var webSocket = await context.WebSockets.AcceptWebSocketAsync();
                var videoService = context.RequestServices.GetRequiredService<VideoStreamingService>();
                
                Console.WriteLine($"🔌 WebSocket conectado para {serial}");
                
                await videoService.StartVideoStream(serial, webSocket, quality, fps);
                
                // Mantener conexión abierta
                var buffer = new byte[1024];
                while (webSocket.State == WebSocketState.Open)
                {
                    var result = await webSocket.ReceiveAsync(
                        new ArraySegment<byte>(buffer),
                        CancellationToken.None
                    );

                    if (result.MessageType == WebSocketMessageType.Close)
                    {
                        await videoService.StopVideoStream(serial);
                        await webSocket.CloseAsync(
                            WebSocketCloseStatus.NormalClosure,
                            "Client closed",
                            CancellationToken.None
                        );
                        break;
                    }
                }
                
                return;
            }
        }
        else
        {
            context.Response.StatusCode = 400;
            return;
        }
    }
    
    await next();
});

// Configurar pipeline HTTP
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("AllowElectron");

app.UseAuthorization();

app.Use(async (context, next) =>
{
    var entitlements = context.RequestServices.GetRequiredService<EntitlementsService>();
    if (entitlements.EnforcementEnabled && HttpMethods.IsPost(context.Request.Method))
    {
        var (allowed, feature) = entitlements.CheckPath(context.Request.Path.Value ?? string.Empty);
        if (!allowed)
        {
            context.Response.StatusCode = 403;
            await context.Response.WriteAsJsonAsync(new
            {
                error = "feature_not_entitled",
                feature
            });
            return;
        }
    }

    await next();
});

app.MapGet("/api/entitlements", (EntitlementsService entitlements) => Results.Ok(entitlements.GetState()));
app.MapPost("/api/entitlements", async (HttpContext context, EntitlementsService entitlements) =>
{
    try
    {
        using var document = await JsonDocument.ParseAsync(context.Request.Body);
        entitlements.SetEntitlements(document.RootElement.Clone(), "push");
        return Results.Ok(entitlements.GetState());
    }
    catch
    {
        return Results.BadRequest(new { error = "invalid_payload" });
    }
});

app.MapGet("/api/health", (AdbService adbService) => Results.Ok(new
{
    status = "ok",
    service = "FlowDashboard.Core",
    productName = "FlowDashboard",
    version = coreVersion,
    productMode = AppPaths.ProductMode,
    baseDir = AppPaths.BaseDir,
    resourceDir = AppPaths.ResourceDir,
    dataDir = AppPaths.DataDir,
    adb = new
    {
        available = adbService.IsAvailable,
        path = adbService.AdbPath,
        error = adbService.StartupError
    },
    features = new[]
    {
        "adb_devices",
        "adb_wifi_scan",
        "scrcpy_native_streaming",
        "live_device_grid"
    }
}));
app.MapControllers();
app.MapHub<StreamingHub>("/hubs/streaming"); // SignalR Hub para streaming
// app.MapHub<DeviceHub>("/hubs/devices"); // Comentado temporalmente - Canvas Streaming en desarrollo

// Iniciar servicios en background
var adbService = app.Services.GetRequiredService<AdbService>();
var pythonBridge = app.Services.GetRequiredService<PythonBridgeService>();
var streamingWebSocket = app.Services.GetRequiredService<StreamingWebSocketService>();
var disablePythonAutostart = string.Equals(
    Environment.GetEnvironmentVariable("FLOWDASHBOARD_DISABLE_CSHARP_PYTHON_AUTOSTART"),
    "1",
    StringComparison.OrdinalIgnoreCase);

Task.Run(() => adbService.StartMonitoring());
if (!disablePythonAutostart)
{
    Task.Run(() => pythonBridge.EnsurePythonServerRunning());
}
else
{
    Console.WriteLine("Python autostart deshabilitado; Electron RuntimeManager gobierna el backend Python.");
}
Task.Run(() => streamingWebSocket.StartAsync(5000)); // Puerto 5000 para WebSocket (mismo que API REST)

Console.WriteLine("🚀 FlowDashboard Core Engine iniciado");
Console.WriteLine("📡 API REST: http://localhost:5000");
Console.WriteLine("🔌 SignalR Devices: http://localhost:5000/hubs/devices");
Console.WriteLine("🎥 SignalR Streaming: http://localhost:5000/hubs/streaming");
Console.WriteLine("📖 Swagger: http://localhost:5000/swagger");

app.Run("http://localhost:5000");
