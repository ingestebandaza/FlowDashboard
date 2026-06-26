using Microsoft.AspNetCore.SignalR;
using FlowDashboard.Core.Models;

namespace FlowDashboard.Core.Hubs;

public class DeviceHub : Hub
{
    public async Task SendDeviceUpdate(Device device)
    {
        await Clients.All.SendAsync("DeviceUpdated", device);
    }

    public async Task SendAccountStatusUpdate(string serial, List<AccountStatus> accounts)
    {
        await Clients.All.SendAsync("AccountStatusUpdated", new { serial, accounts });
    }

    public async Task SendStreamUpdate(StreamInfo streamInfo)
    {
        await Clients.All.SendAsync("StreamUpdated", streamInfo);
    }

    public override async Task OnConnectedAsync()
    {
        Console.WriteLine($"🔌 Cliente conectado: {Context.ConnectionId}");
        await base.OnConnectedAsync();
    }

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        Console.WriteLine($"🔌 Cliente desconectado: {Context.ConnectionId}");
        await base.OnDisconnectedAsync(exception);
    }
}
