using System.Globalization;
using System.Text.Json;

namespace ReputexaGhost.Services;

public sealed class GhostVoucherOffer
{
    public string PublicCode { get; init; } = "";
    public string Status { get; init; } = "";
    public string RewardKind { get; init; } = "";
    public int RewardEuroCents { get; init; }
    public double RewardPercent { get; init; }
    public string RewardLabel { get; init; } = "";
    public string? ExpiresAtIso { get; init; }
    public bool CanRedeem { get; init; }
    public string StatusHint { get; init; } = "";
}

public sealed class GhostMemberCardResolve
{
    public required string MemberId { get; init; }
    public string DisplayLabel { get; init; } = "";
    public int PointsBalanceBefore { get; init; }
    public int StampsBalanceBefore { get; init; }
    public bool StaffAllowanceEligible { get; init; }
    public int StaffRemainingEuroCents { get; init; }
    public int StaffMonthlyBudgetEuroCents { get; init; }
}

public static class GhostJsonParse
{
    public static GhostVoucherOffer? TryParseVoucherResolve(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (!root.TryGetProperty("ok", out var okEl) || okEl.ValueKind != JsonValueKind.True) return null;
            if (!root.TryGetProperty("resolved", out var resEl) || resEl.GetString() != "voucher") return null;
            if (!root.TryGetProperty("voucher", out var v) || v.ValueKind != JsonValueKind.Object) return null;

            var code = ReadString(v, "public_code");
            if (string.IsNullOrEmpty(code)) return null;
            var status = ReadString(v, "status").Trim().ToLowerInvariant();
            var kind = ReadString(v, "reward_kind").Trim().ToLowerInvariant();
            var label = ReadString(v, "reward_label").Trim();
            var euroCents = ReadInt(v, "reward_euro_cents", "rewardEuroCents");
            var pct = ReadDouble(v, "reward_percent", "rewardPercent");
            var exp = ReadString(v, "expires_at");
            var expiredByDate = false;
            if (!string.IsNullOrEmpty(exp) && DateTime.TryParse(exp, CultureInfo.InvariantCulture, DateTimeStyles.RoundtripKind, out var expDt))
            {
                expiredByDate = expDt.ToUniversalTime() < DateTime.UtcNow;
            }

            var can = status == "available" && !expiredByDate;
            var hint = !can
                ? status == "redeemed"
                    ? "Ce bon a déjà été utilisé."
                    : status == "expired" || expiredByDate
                        ? "Bon expiré."
                        : "Bon indisponible."
                : "";

            return new GhostVoucherOffer
            {
                PublicCode = code,
                Status = status,
                RewardKind = string.IsNullOrEmpty(kind) ? "label_only" : kind,
                RewardEuroCents = euroCents,
                RewardPercent = pct,
                RewardLabel = string.IsNullOrEmpty(label) ? "Bon fidélité" : label,
                ExpiresAtIso = string.IsNullOrEmpty(exp) ? null : exp,
                CanRedeem = can,
                StatusHint = hint,
            };
        }
        catch
        {
            return null;
        }
    }

    public static GhostMemberCardResolve? TryParseMemberCardResolve(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (!root.TryGetProperty("ok", out var okEl) || okEl.ValueKind != JsonValueKind.True) return null;
            if (!root.TryGetProperty("resolved", out var resEl)) return null;
            if (resEl.GetString() != "member_card") return null;
            if (!root.TryGetProperty("member", out var mem) || mem.ValueKind != JsonValueKind.Object) return null;
            var id = ReadString(mem, "id");
            if (string.IsNullOrEmpty(id)) return null;

            var first = ReadString(mem, "first_name").Trim();
            var last = ReadString(mem, "last_name").Trim();
            var disp = ReadString(mem, "display_name").Trim();
            var label = !string.IsNullOrEmpty(disp)
                ? disp
                : string.Join(" ", new[] { first, last }.Where(s => !string.IsNullOrEmpty(s))).Trim();
            if (string.IsNullOrEmpty(label)) label = "Client";

            var staffEligible = false;
            var staffRem = 0;
            var staffBudget = 0;
            if (root.TryGetProperty("staff_allowance", out var sa) && sa.ValueKind == JsonValueKind.Object)
            {
                staffEligible = ReadBool(sa, "eligible", "Eligible");
                staffRem = ReadInt(sa, "remaining_euro_cents", "remainingEuroCents");
                staffBudget = ReadInt(sa, "monthly_budget_euro_cents", "monthlyBudgetEuroCents");
            }

            return new GhostMemberCardResolve
            {
                MemberId = id,
                DisplayLabel = label,
                PointsBalanceBefore = ReadInt(mem, "points_balance", "pointsBalance"),
                StampsBalanceBefore = ReadInt(mem, "stamps_balance", "stampsBalance"),
                StaffAllowanceEligible = staffEligible,
                StaffRemainingEuroCents = staffRem,
                StaffMonthlyBudgetEuroCents = staffBudget,
            };
        }
        catch
        {
            return null;
        }
    }

    /// <summary>Lecture du débit staff après transact (centimes).</summary>
    public static (int debitCents, int remainingAfterCents) ReadStaffUsageFromTransact(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return (-1, -1);
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (!root.TryGetProperty("staffUsage", out var su) && !root.TryGetProperty("staff_usage", out su))
                return (-1, -1);
            if (su.ValueKind != JsonValueKind.Object) return (-1, -1);
            var debit = ReadInt(su, "debit_euro_cents", "debitEuroCents");
            var rem = ReadInt(su, "remaining_euro_cents_after", "remainingEuroCentsAfter");
            return (debit, rem);
        }
        catch
        {
            return (-1, -1);
        }
    }

    public static int ReadPointsAfterTransact(string? json)
    {
        var (p, _) = ReadMemberBalancesFromTransact(json);
        return p;
    }

    public static (int points, int stamps) ReadMemberBalancesFromTransact(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return (-1, -1);
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (!root.TryGetProperty("member", out var mem) || mem.ValueKind != JsonValueKind.Object) return (-1, -1);
            return (
                ReadInt(mem, "points_balance", "pointsBalance"),
                ReadInt(mem, "stamps_balance", "stampsBalance")
            );
        }
        catch
        {
            return (-1, -1);
        }
    }

    public static string? ReadTransactError(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            using var doc = JsonDocument.Parse(json);
            var root = doc.RootElement;
            if (root.TryGetProperty("error", out var e) && e.ValueKind == JsonValueKind.String) return e.GetString();
        }
        catch
        {
            /* ignore */
        }

        return null;
    }

    private static bool ReadBool(JsonElement o, string snake, string camel)
    {
        if (o.TryGetProperty(snake, out var p) && p.ValueKind == JsonValueKind.True) return true;
        if (o.TryGetProperty(snake, out var p2) && p2.ValueKind == JsonValueKind.False) return false;
        if (o.TryGetProperty(camel, out var c) && c.ValueKind == JsonValueKind.True) return true;
        if (o.TryGetProperty(camel, out var c2) && c2.ValueKind == JsonValueKind.False) return false;
        return false;
    }

    private static string ReadString(JsonElement o, string snake)
    {
        if (o.TryGetProperty(snake, out var p) && p.ValueKind == JsonValueKind.String) return p.GetString() ?? "";
        return "";
    }

    private static int ReadInt(JsonElement o, string a, string b)
    {
        if (o.TryGetProperty(a, out var p))
        {
            if (p.ValueKind == JsonValueKind.Number && p.TryGetInt32(out var v)) return v;
        }

        if (o.TryGetProperty(b, out var p2))
        {
            if (p2.ValueKind == JsonValueKind.Number && p2.TryGetInt32(out var v2)) return v2;
        }

        return 0;
    }

    private static double ReadDouble(JsonElement o, string a, string b)
    {
        if (TryReadDoubleProperty(o, a, out var x)) return x;
        if (TryReadDoubleProperty(o, b, out var y)) return y;
        return 0;
    }

    private static bool TryReadDoubleProperty(JsonElement o, string name, out double value)
    {
        value = 0;
        if (!o.TryGetProperty(name, out var p)) return false;
        if (p.ValueKind == JsonValueKind.Number && p.TryGetDouble(out var d))
        {
            value = d;
            return true;
        }

        return false;
    }
}
