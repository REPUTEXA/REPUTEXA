namespace ReputexaGhost.Services;

/// <summary>
/// Dernier total TTC vu par le sniffer spool — corrélation avec le prochain scan membre (mémoire vive uniquement).
/// </summary>
public static class TicketLedger
{
    private static readonly object Sync = new();
    private static int? _lastCents;
    private static DateTime? _detectedAtUtc;

    public static void RecordTotalTtc(int cents)
    {
        if (cents < 1) return;
        lock (Sync)
        {
            _lastCents = cents;
            _detectedAtUtc = DateTime.UtcNow;
        }
    }

    /// <summary>Montant encore valide (fenêtre temporelle) — ne consomme pas (plusieurs lectures possibles jusqu’au succès transact).</summary>
    public static bool TryGetFreshTicket(out int cents, TimeSpan maxAge)
    {
        lock (Sync)
        {
            cents = 0;
            if (_lastCents is null or < 1 || _detectedAtUtc is null) return false;
            if (DateTime.UtcNow - _detectedAtUtc.Value > maxAge) return false;
            cents = _lastCents.Value;
            return true;
        }
    }

    /// <summary>Appeler après un earn_visit réussi pour éviter de réutiliser le même ticket pour un autre client.</summary>
    public static void ClearAfterSuccessfulTransact()
    {
        lock (Sync)
        {
            _lastCents = null;
            _detectedAtUtc = null;
        }
    }
}
