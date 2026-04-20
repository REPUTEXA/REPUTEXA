using System.Globalization;

namespace ReputexaGhost.Services;

/// <summary>
/// Calcule le montant injectable dans la macro et valide par rapport au ticket capté (sniffer).
/// </summary>
public static class GhostVoucherDiscount
{
    public static string FormatEurosFr(int cents) =>
        (cents / 100m).ToString("0.00", CultureInfo.GetCultureInfo("fr-FR"));

    /// <summary>
    /// Prépare discountCents + libellé FR pour SendInput ; bloque si ticket insuffisant (montant fixe) ou ticket manquant quand requis.
    /// </summary>
    public static bool TryBuild(
        GhostVoucherOffer v,
        bool hasFreshTicket,
        int ticketCents,
        out int discountCents,
        out string? macroEurosFr,
        out string? blockMessageFr)
    {
        macroEurosFr = null;
        blockMessageFr = null;
        discountCents = 0;
        var kind = (v.RewardKind ?? "").Trim().ToLowerInvariant();

        if (kind == "fixed_euro")
        {
            discountCents = Math.Max(0, v.RewardEuroCents);
            if (discountCents < 1) return true;
            macroEurosFr = FormatEurosFr(discountCents);
            if (!hasFreshTicket)
            {
                blockMessageFr =
                    "Montant du ticket inconnu. Activez le sniffer spool et assurez-vous qu’un total TTC récent est mémorisé avant d’appliquer ce bon.";
                return false;
            }

            if (ticketCents < discountCents)
            {
                blockMessageFr =
                    $"Montant ticket insuffisant : ticket ≈ {FormatEurosFr(ticketCents)} €, bon {FormatEurosFr(discountCents)} €.";
                return false;
            }

            return true;
        }

        if (kind == "percent")
        {
            if (!hasFreshTicket || ticketCents < 1)
            {
                blockMessageFr =
                    "Bon en pourcentage : un ticket TTC récent est obligatoire (sniffer actif). Réimprimez la note ou attendez la capture du total.";
                return false;
            }

            discountCents = (int)Math.Round(ticketCents * v.RewardPercent / 100.0, MidpointRounding.AwayFromZero);
            if (discountCents < 1)
            {
                blockMessageFr = "Remise calculée nulle (vérifiez le % du bon et le montant du ticket).";
                return false;
            }

            if (discountCents > ticketCents) discountCents = ticketCents;
            macroEurosFr = FormatEurosFr(discountCents);
            return true;
        }

        // label_only ou inconnu : encaissement sans montant macro auto
        return true;
    }
}
