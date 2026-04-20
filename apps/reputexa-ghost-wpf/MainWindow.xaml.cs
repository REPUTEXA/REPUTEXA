using System.Globalization;
using System.IO;
using System.Net;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Windows;
using ReputexaGhost.Services;

namespace ReputexaGhost;

public partial class MainWindow : Window
{
    private static readonly JsonSerializerOptions JsonOpts = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true,
        DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
    };

    private readonly GhostKeyboardHook _hook = new();
    private readonly GhostApiClient _api = new();
    private readonly OverlayWindow _overlay = new();
    private readonly PrintSpoolSniffer _spool = new();
    private bool _hookRunning;
    private bool _spoolRunning;
    private List<MacroStepDto> _macroSteps = new();

    private static string ConfigPath =>
        Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ReputexaGhost", "config.json");

    public MainWindow()
    {
        InitializeComponent();
        Loaded += MainWindow_OnLoaded;
        Closed += (_, _) =>
        {
            _hook.Dispose();
            _api.Dispose();
            _overlay.Close();
            _spool.Dispose();
        };
        _spool.TotalTtcCentsDetected += (_, cents) =>
        {
            _ = Dispatcher.InvokeAsync(() =>
            {
                TicketLedger.RecordTotalTtc(cents);
                var euros = cents / 100m;
                AppendLog(
                    $"[Spool] Total TTC ≈ {euros.ToString("0.00", CultureInfo.GetCultureInfo("fr-FR"))} € — mémorisé pour le prochain scan membre.");
            });
        };
        _overlay.MacroInjectRequested += (_, euros) =>
        {
            try
            {
                if (_macroSteps.Count == 0)
                {
                    AppendLog("[Macro] Aucune macro enregistrée.");
                    return;
                }

                SendInputMacroPlayer.Play(_macroSteps, euros);
                AppendLog($"[Macro] Séquence rejouée avec « {euros} ».");
            }
            catch (Exception ex)
            {
                AppendLog($"[Macro] Erreur : {ex.Message}");
            }
        };
        _hook.RepLineCaptured += (_, line) =>
        {
            _ = Dispatcher.InvokeAsync(async () =>
            {
                try
                {
                    await HandleRepScanAsync(line);
                }
                catch (Exception ex)
                {
                    AppendLog($"Scan: erreur {ex.Message}");
                    _overlay.ShowSlideFromTop("Erreur", ex.Message);
                }
            });
        };
    }

    private static string FormatEuros(int cents) =>
        (cents / 100m).ToString("0.00", CultureInfo.GetCultureInfo("fr-FR"));

    private static string BuildTransactSuccessMessage(string raw, int beforePoints, int beforeStamps)
    {
        var (p, s) = GhostJsonParse.ReadMemberBalancesFromTransact(raw);
        var dP = p >= 0 ? p - beforePoints : 0;
        var dS = s >= 0 ? s - beforeStamps : 0;
        if (dP > 0 && dS > 0)
            return $"+{dP} points et +{dS} tampon(s) ! Nouveaux soldes : {p} pts / {s} tampons.";
        if (dP > 0)
            return $"+{dP} points ! Nouveau solde : {p}.";
        if (dS > 0)
            return $"+{dS} tampon(s) ! Nouveau solde : {s}.";
        return "Passage enregistré.";
    }

    private async Task HandleRepScanAsync(string line)
    {
        AppendLog($"Scan: {line}");
        try
        {
            var json = await _api.ResolveScanAsync(line);
            AppendLog($"Réponse: {json}");

            var member = GhostJsonParse.TryParseMemberCardResolve(json);
            if (member != null)
            {
                const int maxTicketAgeMin = 20;

                if (member.StaffAllowanceEligible && member.StaffRemainingEuroCents > 0)
                {
                    if (!TicketLedger.TryGetFreshTicket(out var staffTicketCents, TimeSpan.FromMinutes(maxTicketAgeMin)))
                    {
                        _overlay.ShowSlideFromTop(
                            "Ticket requis (crédit staff)",
                            $"Collaborateur : {member.DisplayLabel}\n" +
                            $"Crédit staff disponible : {FormatEuros(member.StaffRemainingEuroCents)} €\n\n" +
                            $"Aucun total TTC récent (≤ {maxTicketAgeMin} min). Lancez le sniffer et réimprimez le ticket, puis scannez à nouveau.");
                        return;
                    }

                    var remCents = member.StaffRemainingEuroCents;
                    var budgetBlock = member.StaffMonthlyBudgetEuroCents > 0
                        ? $"Budget mensuel (plafond) : {FormatEuros(member.StaffMonthlyBudgetEuroCents)} €\n"
                        : "";

                    if (staffTicketCents <= remCents)
                    {
                        var macroFr = FormatEuros(staffTicketCents);
                        var staffDetail =
                            $"{budgetBlock}" +
                            $"Employé : {member.DisplayLabel}\n" +
                            $"Solde crédit staff : {FormatEuros(remCents)} €\n" +
                            $"Ticket : {macroFr} €\n\n" +
                            "Consommer le crédit sur la totalité du ticket et injecter la macro remise ?";

                        var macroInlineFull = _macroSteps.Count > 0;
                        _overlay.PresentTransactOffer(
                            "Crédit staff — repas offert",
                            staffDetail,
                            autoConfirmSeconds: 3,
                            macroEurosForInject: macroFr,
                            hasMacroSteps: !macroInlineFull && _macroSteps.Count > 0,
                            confirmAsync: async () =>
                            {
                                var idem = Guid.NewGuid().ToString();
                                var (status, raw) = await _api.TransactStaffUsageAsync(
                                    member.MemberId,
                                    staffTicketCents,
                                    "require_full_ticket",
                                    idem);
                                if (status == HttpStatusCode.OK)
                                {
                                    TicketLedger.ClearAfterSuccessfulTransact();
                                    var (deb, after) = GhostJsonParse.ReadStaffUsageFromTransact(raw);
                                    var msg = deb >= 0
                                        ? $"Crédit débité : {FormatEuros(deb)} €. Solde staff restant : {FormatEuros(after)} €."
                                        : "Crédit staff appliqué.";
                                    if (macroInlineFull)
                                    {
                                        try
                                        {
                                            SendInputMacroPlayer.Play(_macroSteps, macroFr);
                                            return (true, msg + " Macro injectée sur la caisse.");
                                        }
                                        catch (Exception ex)
                                        {
                                            return (true, $"{msg} Macro : {ex.Message}");
                                        }
                                    }

                                    return (true, msg);
                                }

                                var err =
                                    GhostJsonParse.ReadTransactError(raw)
                                    ?? $"HTTP {(int)status}";
                                return (false, err);
                            },
                            validateButtonText: "Consommer le crédit staff");
                        return;
                    }

                    {
                        var macroFrPartial = FormatEuros(remCents);
                        var staffDetailPartial =
                            $"{budgetBlock}" +
                            "Solde staff insuffisant pour couvrir tout le ticket.\n\n" +
                            $"Employé : {member.DisplayLabel}\n" +
                            $"Ticket : {FormatEuros(staffTicketCents)} €\n" +
                            $"Solde staff : {macroFrPartial} €\n\n" +
                            $"Débiter tout le solde restant ({macroFrPartial} €) et injecter la macro pour cette remise ?\n" +
                            "Le reliquat du ticket s’encaisse normalement.";

                        var macroInlinePartial = _macroSteps.Count > 0;
                        _overlay.PresentTransactOffer(
                            "Crédit staff — débit partiel",
                            staffDetailPartial,
                            autoConfirmSeconds: 0,
                            macroEurosForInject: macroFrPartial,
                            hasMacroSteps: !macroInlinePartial && _macroSteps.Count > 0,
                            confirmAsync: async () =>
                            {
                                var idem = Guid.NewGuid().ToString();
                                var (status, raw) = await _api.TransactStaffUsageAsync(
                                    member.MemberId,
                                    staffTicketCents,
                                    "partial_max",
                                    idem);
                                if (status == HttpStatusCode.OK)
                                {
                                    TicketLedger.ClearAfterSuccessfulTransact();
                                    var (deb, after) = GhostJsonParse.ReadStaffUsageFromTransact(raw);
                                    var msg = deb >= 0
                                        ? $"Débit partiel : {FormatEuros(deb)} €. Solde staff restant : {FormatEuros(after)} €."
                                        : "Débit staff appliqué.";
                                    if (macroInlinePartial)
                                    {
                                        try
                                        {
                                            SendInputMacroPlayer.Play(_macroSteps, macroFrPartial);
                                            return (true, msg + " Macro injectée sur la caisse.");
                                        }
                                        catch (Exception ex)
                                        {
                                            return (true, $"{msg} Macro : {ex.Message}");
                                        }
                                    }

                                    return (true, msg);
                                }

                                var err =
                                    GhostJsonParse.ReadTransactError(raw)
                                    ?? $"HTTP {(int)status}";
                                return (false, err);
                            },
                            validateButtonText: "Débiter le solde restant");
                        return;
                    }
                }

                if (!TicketLedger.TryGetFreshTicket(out var ticketCents, TimeSpan.FromMinutes(maxTicketAgeMin)))
                {
                    _overlay.ShowSlideFromTop(
                        "Montant ticket manquant",
                        $"Client : {member.DisplayLabel}\n\nAucun total TTC récent (≤ {maxTicketAgeMin} min). Lancez le sniffer spool et réimprimez ou attendez le ticket, puis scannez à nouveau.");
                    return;
                }

                var eurosLabel = FormatEuros(ticketCents);
                var detail =
                    $"Client : {member.DisplayLabel}\n" +
                    $"Ticket détecté : {eurosLabel} €\n\n" +
                    "Créditer la fidélité sur ce montant ?\n" +
                    "(Les points ou tampons sont calculés par votre programme Reputexa.)";

                _overlay.PresentTransactOffer(
                    "Confirmer le passage",
                    detail,
                    autoConfirmSeconds: 3,
                    macroEurosForInject: eurosLabel,
                    hasMacroSteps: _macroSteps.Count > 0,
                    confirmAsync: async () =>
                    {
                        var idem = Guid.NewGuid().ToString();
                        var (status, raw) = await _api.TransactEarnVisitAsync(
                            member.MemberId,
                            ticketCents,
                            idem
                        );
                        if (status == HttpStatusCode.OK)
                        {
                            TicketLedger.ClearAfterSuccessfulTransact();
                            var msg = BuildTransactSuccessMessage(
                                raw,
                                member.PointsBalanceBefore,
                                member.StampsBalanceBefore
                            );
                            return (true, msg);
                        }

                        var err =
                            GhostJsonParse.ReadTransactError(raw)
                            ?? $"HTTP {(int)status} — vérifiez le programme fidélité (mode points / tampons).";
                        return (false, err);
                    });
                return;
            }

            var voucher = GhostJsonParse.TryParseVoucherResolve(json);
            if (voucher != null)
            {
                HandleVoucherScan(voucher);
                return;
            }

            if (!string.IsNullOrEmpty(json) &&
                json.Contains("\"ok\":false", StringComparison.Ordinal))
            {
                var errScan = GhostJsonParse.ReadTransactError(json);
                if (!string.IsNullOrEmpty(errScan))
                {
                    _overlay.ShowSlideFromTop("Scan", errScan);
                    return;
                }
            }

            _overlay.ShowSlideFromTop("Scan Reputexa", json ?? "(vide)");
        }
        catch (Exception ex)
        {
            AppendLog($"Erreur API: {ex.Message}");
            _overlay.ShowSlideFromTop("Erreur réseau", ex.Message);
        }
    }

    private void HandleVoucherScan(GhostVoucherOffer v)
    {
        if (!v.CanRedeem)
        {
            _overlay.ShowSlideFromTop("Bon indisponible", string.IsNullOrEmpty(v.StatusHint) ? "Ce bon ne peut pas être utilisé." : v.StatusHint);
            return;
        }

        const int maxTicketAgeMin = 20;
        var hasTicket = TicketLedger.TryGetFreshTicket(out var ticketCents, TimeSpan.FromMinutes(maxTicketAgeMin));

        if (!GhostVoucherDiscount.TryBuild(v, hasTicket, ticketCents, out _, out var macroFr, out var block))
        {
            _overlay.ShowSlideFromTop("Bon fidélité", block ?? "Impossible d’appliquer ce bon.");
            return;
        }

        var labelBlock = string.IsNullOrWhiteSpace(v.RewardLabel) ? "" : $"{v.RewardLabel}\n";
        var amountBlock =
            macroFr != null && hasTicket
                ? $"Montant remise cible : {macroFr} € (ticket ≈ {GhostVoucherDiscount.FormatEurosFr(ticketCents)} €)\n"
                : macroFr != null
                    ? $"Montant remise cible : {macroFr} €\n"
                    : "Sans montant automatique pour la macro (libellé seul).\n";
        var detail =
            $"{labelBlock}{amountBlock}Code {v.PublicCode}\n\n" +
            "Valider encaisse le bon côté Reputexa puis, si une macro est configurée, injecte la remise sur la caisse.";

        var executeMacroInline = _macroSteps.Count > 0 && !string.IsNullOrEmpty(macroFr);
        _overlay.PresentTransactOffer(
            "Appliquer le bon",
            detail,
            autoConfirmSeconds: 3,
            macroEurosForInject: macroFr,
            hasMacroSteps: !executeMacroInline && _macroSteps.Count > 0 && macroFr != null,
            confirmAsync: async () =>
            {
                var idem = Guid.NewGuid().ToString();
                var (status, raw) = await _api.RedeemVoucherAsync(v.PublicCode, idem);
                if (status != HttpStatusCode.OK)
                {
                    var err =
                        GhostJsonParse.ReadTransactError(raw)
                        ?? $"HTTP {(int)status}";
                    return (false, err);
                }

                if (executeMacroInline)
                {
                    try
                    {
                        SendInputMacroPlayer.Play(_macroSteps, macroFr!);
                        return (true, "Bon utilisé et remise injectée sur la caisse.");
                    }
                    catch (Exception ex)
                    {
                        return (true, $"Bon enregistré, mais la macro a échoué : {ex.Message}");
                    }
                }

                return (true, macroFr != null && _macroSteps.Count > 0
                    ? "Bon utilisé. Touchez « Injecter macro » si la remise ne part pas seule."
                    : "Bon utilisé.");
            });
    }

    private void MainWindow_OnLoaded(object sender, RoutedEventArgs e)
    {
        LoadConfig();
        RefreshMacroStatus();
    }

    private void RefreshMacroStatus()
    {
        MacroStatusText.Text = $"Macro : {_macroSteps.Count} étape(s)";
    }

    private void LoadConfig()
    {
        try
        {
            if (!File.Exists(ConfigPath)) return;
            var txt = File.ReadAllText(ConfigPath);
            var cfg = JsonSerializer.Deserialize<GhostPersistedConfig>(txt, JsonOpts);
            if (cfg != null)
            {
                BaseUrlBox.Text = cfg.BaseUrl ?? "";
                TokenBox.Password = cfg.Token ?? "";
                _macroSteps = cfg.RemiseMacroSteps ?? new List<MacroStepDto>();
                return;
            }
        }
        catch
        {
            /* legacy */
        }

        try
        {
            if (!File.Exists(ConfigPath)) return;
            using var doc = JsonDocument.Parse(File.ReadAllText(ConfigPath));
            var root = doc.RootElement;
            if (root.TryGetProperty("baseUrl", out var b)) BaseUrlBox.Text = b.GetString() ?? "";
            if (root.TryGetProperty("token", out var t)) TokenBox.Password = t.GetString() ?? "";
        }
        catch
        {
            /* ignore */
        }
    }

    private void SaveConfig()
    {
        try
        {
            var dir = Path.GetDirectoryName(ConfigPath);
            if (!string.IsNullOrEmpty(dir)) Directory.CreateDirectory(dir);
            var cfg = new GhostPersistedConfig
            {
                BaseUrl = BaseUrlBox.Text.Trim(),
                Token = TokenBox.Password,
                RemiseMacroSteps = _macroSteps,
            };
            File.WriteAllText(ConfigPath, JsonSerializer.Serialize(cfg, JsonOpts));
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Sauvegarde config: {ex.Message}");
        }
    }

    private void AppendLog(string line)
    {
        var ts = DateTime.Now.ToString("HH:mm:ss");
        LogBlock.Text = $"[{ts}] {line}\n" + LogBlock.Text;
    }

    private void HookToggleBtn_OnClick(object sender, RoutedEventArgs e)
    {
        if (!_hookRunning)
        {
            try
            {
                if (string.IsNullOrWhiteSpace(BaseUrlBox.Text))
                {
                    MessageBox.Show("Indiquez l’URL de l’API.");
                    return;
                }

                _api.SetBaseUrl(BaseUrlBox.Text.Trim());
                _api.SetBearer(TokenBox.Password);
                SaveConfig();
                _hook.Start();
                _hookRunning = true;
                HookToggleBtn.Content = "Arrêter le hook REP-";
                AppendLog("Hook démarré.");
            }
            catch (Exception ex)
            {
                MessageBox.Show(ex.Message);
            }
        }
        else
        {
            _hook.Stop();
            _hookRunning = false;
            HookToggleBtn.Content = "Démarrer le hook REP-";
            AppendLog("Hook arrêté.");
        }
    }

    private void SnifferToggleBtn_OnClick(object sender, RoutedEventArgs e)
    {
        if (!_spoolRunning)
        {
            try
            {
                _spool.Start();
                _spoolRunning = true;
                SnifferToggleBtn.Content = "Arrêter sniffer ticket";
                AppendLog($"Sniffer : surveillance {PrintSpoolSniffer.DefaultSpoolPath} (droits admin souvent requis).");
            }
            catch (Exception ex)
            {
                MessageBox.Show(this, ex.Message, "Spool", MessageBoxButton.OK, MessageBoxImage.Warning);
            }
        }
        else
        {
            _spool.Stop();
            _spoolRunning = false;
            SnifferToggleBtn.Content = "Démarrer sniffer ticket (spool)";
            AppendLog("Sniffer arrêté.");
        }
    }

    private void LearnMacroBtn_OnClick(object sender, RoutedEventArgs e)
    {
        if (_hookRunning)
        {
            MessageBox.Show("Arrêtez le hook clavier avant l’apprentissage macro.");
            return;
        }

        var dlg = new MacroRecordWindow { Owner = this };
        if (dlg.ShowDialog() == true && dlg.RecordedSteps.Count > 0)
        {
            _macroSteps = dlg.RecordedSteps;
            SaveConfig();
            RefreshMacroStatus();
            AppendLog($"Macro enregistrée : {_macroSteps.Count} étapes (éditez config.json pour insérer {{EUROS}} en mode text).");
        }
    }

    private void TestMacroBtn_OnClick(object sender, RoutedEventArgs e)
    {
        if (_macroSteps.Count == 0)
        {
            MessageBox.Show("Enregistrez d’abord une macro (ou éditez remiseMacroSteps dans config.json).");
            return;
        }

        var euros = MacroEurosBox.Text.Trim();
        if (string.IsNullOrEmpty(euros)) euros = "10,50";

        var r = MessageBox.Show(
            "La macro va simuler des frappes clavier globales. Placez le focus sur la fenêtre de caisse, puis OK.",
            "SendInput",
            MessageBoxButton.OKCancel,
            MessageBoxImage.Warning);
        if (r != MessageBoxResult.OK) return;

        try
        {
            SendInputMacroPlayer.Play(_macroSteps, euros);
            AppendLog($"Macro rejouée avec montant « {euros} ».");
        }
        catch (Exception ex)
        {
            MessageBox.Show(ex.Message);
        }
    }
}
