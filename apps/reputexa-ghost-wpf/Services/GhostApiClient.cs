using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace ReputexaGhost.Services;

public sealed class GhostApiClient : IDisposable
{
    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(25) };

    public void SetBaseUrl(string baseUrl)
    {
        var u = baseUrl.Trim().TrimEnd('/');
        _http.BaseAddress = new Uri(u + "/", UriKind.Absolute);
    }

    public void SetBearer(string token)
    {
        _http.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", token.Trim());
    }

    public async Task<string?> ResolveScanAsync(string raw, CancellationToken ct = default)
    {
        var body = JsonSerializer.Serialize(new { raw });
        using var req = new HttpRequestMessage(HttpMethod.Post, "/api/banano/ghost/resolve")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };
        using var res = await _http.SendAsync(req, ct);
        return await res.Content.ReadAsStringAsync(ct);
    }

    /// <summary>Crédite points ou tampons selon le programme (même contrat que le terminal).</summary>
    public async Task<(HttpStatusCode status, string raw)> TransactEarnVisitAsync(
        string memberId,
        int ticketAmountCents,
        string? idempotencyKey,
        CancellationToken ct = default)
    {
        var payload = new Dictionary<string, object?>
        {
            ["memberId"] = memberId,
            ["kind"] = "earn_visit",
            ["ticketAmountCents"] = ticketAmountCents,
        };
        if (!string.IsNullOrWhiteSpace(idempotencyKey)) payload["idempotencyKey"] = idempotencyKey;

        var body = JsonSerializer.Serialize(payload);
        using var req = new HttpRequestMessage(HttpMethod.Post, "/api/banano/ghost/transact")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };
        using var res = await _http.SendAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);
        return (res.StatusCode, raw);
    }

    /// <summary>Débite le crédit repas staff (bons internes) — couverture totale ou partielle.</summary>
    public async Task<(HttpStatusCode status, string raw)> TransactStaffUsageAsync(
        string memberId,
        int ticketAmountCents,
        string staffUsageMode,
        string? idempotencyKey,
        CancellationToken ct = default)
    {
        var payload = new Dictionary<string, object?>
        {
            ["memberId"] = memberId,
            ["kind"] = "staff_usage",
            ["ticketAmountCents"] = ticketAmountCents,
            ["staffUsageMode"] = staffUsageMode,
        };
        if (!string.IsNullOrWhiteSpace(idempotencyKey)) payload["idempotencyKey"] = idempotencyKey;

        var body = JsonSerializer.Serialize(payload);
        using var req = new HttpRequestMessage(HttpMethod.Post, "/api/banano/ghost/transact")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };
        using var res = await _http.SendAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);
        return (res.StatusCode, raw);
    }

    public async Task<(HttpStatusCode status, string raw)> RedeemVoucherAsync(
        string publicCode,
        string? idempotencyKey,
        CancellationToken ct = default)
    {
        var payload = new Dictionary<string, object?> { ["code"] = publicCode.Trim() };
        if (!string.IsNullOrWhiteSpace(idempotencyKey)) payload["idempotencyKey"] = idempotencyKey;

        var body = JsonSerializer.Serialize(payload);
        using var req = new HttpRequestMessage(HttpMethod.Post, "/api/banano/ghost/vouchers/redeem")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };
        using var res = await _http.SendAsync(req, ct);
        var raw = await res.Content.ReadAsStringAsync(ct);
        return (res.StatusCode, raw);
    }

    public void Dispose() => _http.Dispose();
}
