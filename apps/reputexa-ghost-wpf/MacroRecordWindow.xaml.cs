using System.Windows;
using ReputexaGhost.Services;

namespace ReputexaGhost;

public partial class MacroRecordWindow : Window
{
    private readonly MacroLearningHook _learn = new();
    private bool _finished;

    public List<MacroStepDto> RecordedSteps { get; private set; } = new();

    public MacroRecordWindow()
    {
        InitializeComponent();
        Loaded += OnLoaded;
        Closing += OnClosing;
        _learn.KeyCountChanged += (_, n) =>
        {
            Dispatcher.Invoke(() => CountBlock.Text = $"Touches enregistrées : {n} — Échap pour terminer");
        };
        _learn.Completed += (_, _) =>
        {
            Dispatcher.Invoke(FinishOk);
        };
    }

    private void OnLoaded(object sender, RoutedEventArgs e)
    {
        try
        {
            _learn.Start();
        }
        catch (Exception ex)
        {
            MessageBox.Show(this, ex.Message, "Hook", MessageBoxButton.OK, MessageBoxImage.Error);
            DialogResult = false;
            Close();
        }
    }

    private void OnClosing(object? sender, System.ComponentModel.CancelEventArgs e)
    {
        _learn.Dispose();
    }

    private void FinishOk()
    {
        if (_finished) return;
        _finished = true;
        _learn.Stop();
        RecordedSteps = _learn.RecordedVirtualKeys
            .Select(vk => new MacroStepDto { Kind = "vk", Vk = vk, DelayMs = 55 })
            .ToList();
        DialogResult = true;
        Close();
    }

    private void Cancel_OnClick(object sender, RoutedEventArgs e)
    {
        _learn.Stop();
        DialogResult = false;
        Close();
    }
}
