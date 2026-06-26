using FlowDashboard.Core.Services;
using Microsoft.AspNetCore.Mvc;

namespace FlowDashboard.Core.Controllers;

[ApiController]
[Route("api/mail")]
public sealed class MailController : ControllerBase
{
    private readonly MailService _mailService;

    public MailController(MailService mailService)
    {
        _mailService = mailService;
    }

    [HttpGet("status")]
    public ActionResult<MailStatus> Status()
    {
        return Ok(_mailService.GetStatus());
    }

    [HttpPost("connect")]
    public async Task<ActionResult<MailStatus>> Connect([FromBody] MailConnectRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var status = await _mailService.ConnectAsync(request.Email, request.AppPassword, cancellationToken);
            return Ok(status);
        }
        catch (Exception ex)
        {
            return BadRequest(new MailStatus
            {
                Configured = false,
                Connected = false,
                Status = "error",
                Email = request.Email ?? "",
                Message = ex.Message
            });
        }
    }

    [HttpPost("search-spotify-link")]
    public async Task<ActionResult<MagicLinkSearchResult>> SearchSpotifyLink([FromBody] MagicLinkSearchRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _mailService.SearchSpotifyMagicLinkAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new MagicLinkSearchResult
            {
                Found = false,
                Message = ex.Message
            });
        }
    }

    [HttpPost("debug-search")]
    public async Task<ActionResult<object>> DebugSearch([FromBody] MailDebugSearchRequest request, CancellationToken cancellationToken)
    {
        try
        {
            var result = await _mailService.DebugSearchSpotifyMagicLinkAsync(request, cancellationToken);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return BadRequest(new
            {
                ok = false,
                found = false,
                message = ex.Message
            });
        }
    }
}
