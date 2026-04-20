using System.Threading;
using System.Windows;
using System.Windows.Interop;
using System.Windows.Media;
using System.Windows.Media.Animation;
using System.Windows.Threading;
using ReputexaGhost.Interop;

namespace ReputexaGhost;

/// <summary>
/// Overlay non modal : toast simple, ou confirmation transact (auto 3s) + succès / macro.
/// </summary>
public partial class OverlayWindow : Window
{
    private readonly DispatcherTimer _autoClose = new() { Interval = TimeSpan.FromSeconds(5) };
    private readonly DispatcherTimer _countdownTimer = new() { Interval = TimeSpan.FromSeconds(1) };
    private Func<Task<(bool ok, string msg)>>? _confirmAsync;
    private string? _macroEuros;
    private bool _hasMacroSteps;
    private int _countdownRemaining;
    private int _confirmGate;

    public event EventHandler<string>? MacroInjectRequested;

    public OverlayWindow()
    {
        InitializeComponent();
        _autoClose.Tick += (_, _) =>
        {
            _autoClose.Stop();
            Hide();
            ResetAfterHide();
        };
        _countdownTimer.Tick += CountdownOnTick;
    }

    protected override bool ShowWithoutActivation => true;

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);
        var h = new WindowInteropHelper(this).Handle;
        DwmInterop.TryApplyGlassChrome(h);
    }

    /// <summary>Toast lecture seule (ex. JSON brut, erreur réseau).</summary>
    public void ShowSlideFromTop(string title, string detail)
    {
        StopAllTimers();
        _confirmAsync = null;
        TitleText.Text = title;
        TitleText.Foreground = Brushes.White;
        DetailText.Text = detail.Length > 900 ? detail[..900] + "…" : detail;
        TransactPanel.Visibility = Visibility.Collapsed;
        SimpleDismissPanel.Visibility = Visibility.Visible;
        MacroInjectBtn.Visibility = Visibility.Collapsed;
        CountdownText.Visibility = Visibility.Collapsed;
        AnimateIn();
        _autoClose.Interval = TimeSpan.FromSeconds(5);
        _autoClose.Start();
    }

    /// <summary>Confirmation crédit fidélité + validation auto.</summary>
    public void PresentTransactOffer(
        string title,
        string detail,
        int autoConfirmSeconds,
        string? macroEurosForInject,
        bool hasMacroSteps,
        Func<Task<(bool ok, string msg)>> confirmAsync,
        string? validateButtonText = null)
    {
        StopAllTimers();
        _confirmAsync = confirmAsync;
        _macroEuros = macroEurosForInject;
        _hasMacroSteps = hasMacroSteps;
        TitleText.Text = title;
        TitleText.Foreground = Brushes.White;
        DetailText.Text = detail;
        ValidateTransactBtn.Content = string.IsNullOrWhiteSpace(validateButtonText)
            ? "Valider la transaction"
            : validateButtonText.Trim();
        TransactPanel.Visibility = Visibility.Visible;
        SimpleDismissPanel.Visibility = Visibility.Collapsed;
        MacroInjectBtn.Visibility = Visibility.Collapsed;
        ValidateTransactBtn.IsEnabled = true;
        CancelTransactBtn.IsEnabled = true;
        _countdownRemaining = Math.Clamp(autoConfirmSeconds, 0, 120);
        if (_countdownRemaining > 0)
        {
            CountdownText.Visibility = Visibility.Visible;
            UpdateCountdownLabel();
            _countdownTimer.Start();
        }
        else
        {
            CountdownText.Visibility = Visibility.Collapsed;
        }

        AnimateIn();
    }

    private void StopAllTimers()
    {
        _autoClose.Stop();
        _countdownTimer.Stop();
    }

    private void AnimateIn()
    {
        var wa = SystemParameters.WorkArea;
        Left = wa.Left + (wa.Width - Width) / 2;
        Top = wa.Top - Height;
        Opacity = 0;
        Show();
        var animTop = new DoubleAnimation(wa.Top + 12, TimeSpan.FromMilliseconds(280))
        {
            EasingFunction = new CubicEase { EasingMode = EasingMode.EaseOut },
        };
        var animOp = new DoubleAnimation(1, TimeSpan.FromMilliseconds(200));
        BeginAnimation(TopProperty, animTop);
        BeginAnimation(OpacityProperty, animOp);
    }

    private void UpdateCountdownLabel()
    {
        CountdownText.Text = _countdownRemaining > 0
            ? $"Validation automatique dans {_countdownRemaining}s…"
            : string.Empty;
    }

    private void CountdownOnTick(object? sender, EventArgs e)
    {
        _countdownRemaining--;
        if (_countdownRemaining <= 0)
        {
            _countdownTimer.Stop();
            CountdownText.Visibility = Visibility.Collapsed;
            RunTransactConfirm();
            return;
        }

        UpdateCountdownLabel();
    }

    private void ValidateTransactBtn_OnClick(object sender, RoutedEventArgs e)
    {
        _countdownTimer.Stop();
        CountdownText.Visibility = Visibility.Collapsed;
        RunTransactConfirm();
    }

    private async void RunTransactConfirm()
    {
        if (Interlocked.Exchange(ref _confirmGate, 1) == 1) return;
        _countdownTimer.Stop();
        CountdownText.Visibility = Visibility.Collapsed;
        ValidateTransactBtn.IsEnabled = false;
        CancelTransactBtn.IsEnabled = false;
        try
        {
            if (_confirmAsync == null) return;
            var (ok, msg) = await _confirmAsync();
            TransactPanel.Visibility = Visibility.Collapsed;
            SimpleDismissPanel.Visibility = Visibility.Visible;
            TitleText.Text = ok ? "Succès" : "Erreur";
            TitleText.Foreground = ok
                ? new SolidColorBrush(Color.FromRgb(52, 211, 153))
                : new SolidColorBrush(Color.FromRgb(248, 113, 113));
            DetailText.Text = msg;
            MacroInjectBtn.Visibility =
                ok && _hasMacroSteps && !string.IsNullOrEmpty(_macroEuros)
                    ? Visibility.Visible
                    : Visibility.Collapsed;
            var seconds = ok ? (MacroInjectBtn.Visibility == Visibility.Visible ? 14d : 4d) : 10d;
            _autoClose.Interval = TimeSpan.FromSeconds(seconds);
            _autoClose.Start();
        }
        finally
        {
            Interlocked.Exchange(ref _confirmGate, 0);
        }
    }

    private void CancelTransactBtn_OnClick(object sender, RoutedEventArgs e)
    {
        StopAllTimers();
        _confirmAsync = null;
        TransactPanel.Visibility = Visibility.Collapsed;
        Hide();
        ResetAfterHide();
    }

    private void MacroInjectBtn_OnClick(object sender, RoutedEventArgs e)
    {
        if (!string.IsNullOrEmpty(_macroEuros))
            MacroInjectRequested?.Invoke(this, _macroEuros);
        MacroInjectBtn.Visibility = Visibility.Collapsed;
    }

    private void DismissBtn_OnClick(object sender, RoutedEventArgs e)
    {
        StopAllTimers();
        Hide();
        ResetAfterHide();
    }

    private void ResetAfterHide()
    {
        _confirmAsync = null;
        TransactPanel.Visibility = Visibility.Collapsed;
        SimpleDismissPanel.Visibility = Visibility.Visible;
        MacroInjectBtn.Visibility = Visibility.Collapsed;
        CountdownText.Visibility = Visibility.Collapsed;
        ValidateTransactBtn.Content = "Valider la transaction";
        ValidateTransactBtn.IsEnabled = true;
        CancelTransactBtn.IsEnabled = true;
        TitleText.Foreground = Brushes.White;
    }
}
