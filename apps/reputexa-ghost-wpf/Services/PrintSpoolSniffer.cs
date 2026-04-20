namespace ReputexaGhost.Services;

/// <summary>
/// Surveille le dossier spool Windows et tente d’extraire le total TTC des jobs d’impression.
/// Peut exiger des droits élevés selon la politique machine.
/// </summary>
public sealed class PrintSpoolSniffer : IDisposable
{
    public const string DefaultSpoolPath = @"C:\Windows\System32\spool\PRINTERS";

    private FileSystemWatcher? _watcher;
    private readonly System.Threading.Timer _debounce;
    private readonly object _sync = new();
    private string _pendingPath = string.Empty;
    private bool _disposed;

    public event EventHandler<int>? TotalTtcCentsDetected;

    public PrintSpoolSniffer()
    {
        _debounce = new System.Threading.Timer(_ => FlushPending(), null, Timeout.Infinite, Timeout.Infinite);
    }

    public void Start(string? spoolPath = null)
    {
        Stop();
        var path = string.IsNullOrWhiteSpace(spoolPath) ? DefaultSpoolPath : spoolPath.Trim();
        if (!Directory.Exists(path))
            throw new DirectoryNotFoundException($"Dossier spool introuvable : {path}");

        _watcher = new FileSystemWatcher(path)
        {
            NotifyFilter = NotifyFilters.FileName | NotifyFilters.LastWrite | NotifyFilters.Size,
            EnableRaisingEvents = true,
            IncludeSubdirectories = false,
        };
        _watcher.Created += OnSpoolChange;
        _watcher.Changed += OnSpoolChange;
    }

    public void Stop()
    {
        _debounce.Change(Timeout.Infinite, Timeout.Infinite);
        if (_watcher != null)
        {
            _watcher.EnableRaisingEvents = false;
            _watcher.Dispose();
            _watcher = null;
        }
    }

    private void OnSpoolChange(object sender, FileSystemEventArgs e)
    {
        var ext = Path.GetExtension(e.FullPath).ToUpperInvariant();
        if (ext is not ".SPL" and not ".TMP" and not ".SHD") return;
        lock (_sync)
        {
            _pendingPath = e.FullPath;
            _debounce.Change(400, Timeout.Infinite);
        }
    }

    private void FlushPending()
    {
        string path;
        lock (_sync)
        {
            path = _pendingPath;
            _pendingPath = string.Empty;
        }

        if (string.IsNullOrEmpty(path) || !File.Exists(path)) return;

        try
        {
            byte[] buf;
            using (var fs = new FileStream(path, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            {
                var len = (int)Math.Min(fs.Length, 512_000);
                buf = new byte[len];
                _ = fs.Read(buf, 0, len);
            }

            var text = TicketAmountExtractor.BytesToSearchableText(buf);
            var cents = TicketAmountExtractor.TryExtractTotalCents(text);
            if (cents is > 0)
                TotalTtcCentsDetected?.Invoke(this, cents.Value);
        }
        catch
        {
            /* fichier verrouillé ou accès refusé */
        }
    }

    public void Dispose()
    {
        if (_disposed) return;
        Stop();
        _debounce.Dispose();
        _disposed = true;
    }
}
