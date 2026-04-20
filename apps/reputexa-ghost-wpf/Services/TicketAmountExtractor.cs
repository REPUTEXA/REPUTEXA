using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace ReputexaGhost.Services;

/// <summary>
/// Extraction heuristique du total TTC depuis le texte brut d’un ticket (.spl / spool souvent partiellement lisible).
/// </summary>
public static partial class TicketAmountExtractor
{
    [GeneratedRegex(@"TOTAL\s*TTC[^\d]{0,20}(\d[\d\s\.,]*[.,]\d{2})", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex RxTotalTtc();

    [GeneratedRegex(@"TOTAL\s*[€\s]*[:\s]*(\d+[\s]?\d*[.,]\d{2})", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex RxTotal();

    [GeneratedRegex(@"MONTANT\s*TTC[^\d]{0,12}(\d[\d\s\.,]*[.,]\d{2})", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex RxMontantTtc();

    [GeneratedRegex(@"A\s*PAYER[^\d]{0,12}(\d[\d\s\.,]*[.,]\d{2})", RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex RxAPayer();

    /// <summary>Texte brut depuis octets (UTF-8 puis Windows-1252 fallback).</summary>
    public static string BytesToSearchableText(ReadOnlySpan<byte> data)
    {
        if (data.IsEmpty) return string.Empty;
        try
        {
            var utf8 = Encoding.UTF8.GetString(data);
            if (utf8.Contains("TOTAL", StringComparison.OrdinalIgnoreCase)) return utf8;
        }
        catch
        {
            /* ignore */
        }

        try
        {
            return Encoding.GetEncoding(1252).GetString(data);
        }
        catch
        {
            return string.Empty;
        }
    }

    /// <summary>Montant en centimes si trouvé, sinon null.</summary>
    public static int? TryExtractTotalCents(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;
        foreach (var rx in new[] { RxTotalTtc(), RxMontantTtc(), RxAPayer(), RxTotal() })
        {
            var m = rx.Match(text);
            if (!m.Success) continue;
            var g = m.Groups[1].Value.Replace(" ", "", StringComparison.Ordinal);
            if (TryParseEuros(g, out var cents)) return cents;
        }

        return null;
    }

    private static bool TryParseEuros(string raw, out int cents)
    {
        cents = 0;
        var s = raw.Trim();
        if (s.Length < 3) return false;
        var lastComma = s.LastIndexOf(',');
        var lastDot = s.LastIndexOf('.');
        char sep;
        if (lastComma > lastDot)
            sep = ',';
        else if (lastDot > lastComma)
            sep = '.';
        else
            return false;

        var idx = Math.Max(lastComma, lastDot);
        var intPart = s[..idx].Replace(",", "").Replace(".", "").Replace(" ", "");
        var decPart = s[(idx + 1)..];
        if (decPart.Length != 2) return false;
        if (sep == ',')
            intPart = intPart.Replace(".", "", StringComparison.Ordinal).Replace(" ", "", StringComparison.Ordinal);
        else
            intPart = intPart.Replace(",", "", StringComparison.Ordinal).Replace(" ", "", StringComparison.Ordinal);

        if (!int.TryParse(intPart, NumberStyles.None, CultureInfo.InvariantCulture, out var euros))
            return false;
        if (!int.TryParse(decPart, NumberStyles.None, CultureInfo.InvariantCulture, out var c))
            return false;
        cents = euros * 100 + c;
        return cents > 0 && cents <= 100_000_000;
    }
}
