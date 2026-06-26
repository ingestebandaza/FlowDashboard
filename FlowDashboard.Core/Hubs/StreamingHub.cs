using Microsoft.AspNetCore.SignalR;
using System.Collections.Concurrent;

namespace FlowDashboard.Core.Hubs;

public class StreamingHub : Hub
{
    private static readonly ConcurrentDictionary<string, HashSet<string>> _clientSubscriptions = new();

    public override async Task OnConnectedAsync()
    {
        Console.WriteLine($"🔌 Cliente SignalR conectado: {Context.ConnectionId}");
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        Console.WriteLine($"🔌 Cliente SignalR desconectado: {Context.ConnectionId}");
        _clientSubscriptions.TryRemove(Context.ConnectionId, out _);
        await base.OnDisconnectedAsync(exception);
    }

    public async Task SubscribeToDevice(string serial)
    {
        if (string.IsNullOrEmpty(serial))
            return;

        var subscriptions = _clientSubscriptions.GetOrAdd(Context.ConnectionId, _ => new HashSet<string>());
        subscriptions.Add(serial);
        
        Console.WriteLine($"📡 Cliente {Context.ConnectionId} suscrito a {serial}");
        await Clients.Caller.SendAsync("SubscriptionConfirmed", serial);
    }

    public async Task UnsubscribeFromDevice(string serial)
    {
        if (string.IsNullOrEmpty(serial))
            return;

        if (_clientSubscriptions.TryGetValue(Context.ConnectionId, out var subscriptions))
        {
            subscriptions.Remove(serial);
            Console.WriteLine($"📡 Cliente {Context.ConnectionId} desuscrito de {serial}");
        }

        await Clients.Caller.SendAsync("UnsubscriptionConfirmed", serial);
    }

    public static async Task BroadcastFrameAsync(IHubContext<StreamingHub> hubContext, string serial, string format, string base64Data)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        
        foreach (var kvp in _clientSubscriptions)
        {
            if (kvp.Value.Contains(serial))
            {
                await hubContext.Clients.Client(kvp.Key).SendAsync("ReceiveFrame", new
                {
                    serial,
                    format,
                    data = base64Data,
                    timestamp
                });
            }
        }
    }
}
