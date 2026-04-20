using System.Diagnostics;
using System.Runtime.InteropServices;

namespace ReputexaGhost.Services;

/// <summary>
/// Enregistre une séquence de touches (Virtual-Key) jusqu’à Échap.
/// </summary>
public sealed class MacroLearningHook : IDisposable
{
    private const int WhKeyboardLl = 13;
    private const int WmKeydown = 0x0100;
    private const int WmSyskeydown = 0x0104;
    private const int VkEscape = 0x1B;

    private nint _hook = nint.Zero;
    private LowLevelKeyboardProc? _proc;
    private readonly List<ushort> _keys = new();
    private bool _disposed;

    public event EventHandler? Completed;
    public event EventHandler<int>? KeyCountChanged;

    public IReadOnlyList<ushort> RecordedVirtualKeys => _keys;

    public void Start()
    {
        Stop();
        _keys.Clear();
        _proc = HookCallback;
        var mod = Process.GetCurrentProcess().MainModule?.FileName;
        var hMod = string.IsNullOrEmpty(mod) ? nint.Zero : GetModuleHandle(mod);
        _hook = SetWindowsHookEx(WhKeyboardLl, _proc, hMod, 0);
        if (_hook == nint.Zero)
            throw new InvalidOperationException("Impossible d’installer le hook d’apprentissage.");
    }

    public void Stop()
    {
        if (_hook == nint.Zero) return;
        UnhookWindowsHookEx(_hook);
        _hook = nint.Zero;
        _proc = null;
    }

    private nint HookCallback(int nCode, nint wParam, nint lParam)
    {
        if (nCode >= 0 && (wParam == WmKeydown || wParam == WmSyskeydown))
        {
            var info = Marshal.PtrToStructure<Kbdllhookstruct>(lParam);
            var vk = (ushort)info.VkCode;
            if (vk == VkEscape)
            {
                try
                {
                    Completed?.Invoke(this, EventArgs.Empty);
                }
                catch
                {
                    /* ignore */
                }
            }
            else
            {
                _keys.Add(vk);
                try
                {
                    KeyCountChanged?.Invoke(this, _keys.Count);
                }
                catch
                {
                    /* ignore */
                }
            }
        }

        return CallNextHookEx(_hook, nCode, wParam, lParam);
    }

    public void Dispose()
    {
        if (_disposed) return;
        Stop();
        _disposed = true;
    }

    private delegate nint LowLevelKeyboardProc(int nCode, nint wParam, nint lParam);

    [StructLayout(LayoutKind.Sequential)]
    private struct Kbdllhookstruct
    {
        public int VkCode;
        public int ScanCode;
        public int Flags;
        public int Time;
        public nint DwExtraInfo;
    }

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern nint SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, nint hMod, uint dwThreadId);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool UnhookWindowsHookEx(nint hhk);

    [DllImport("user32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern nint CallNextHookEx(nint hhk, int nCode, nint wParam, nint lParam);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern nint GetModuleHandle(string? lpModuleName);
}
