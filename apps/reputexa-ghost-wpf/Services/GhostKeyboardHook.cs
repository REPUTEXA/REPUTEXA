using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;

namespace ReputexaGhost.Services;

/// <summary>
/// Hook clavier bas niveau : accumule la ligne jusqu’à Entrée, détecte les scans REP-…
/// </summary>
public sealed class GhostKeyboardHook : IDisposable
{
    private const int WhKeyboardLl = 13;
    private const int WmKeydown = 0x0100;
    private const int WmSyskeydown = 0x0104;
    private const int VkReturn = 0x0D;
    private const int VkBack = 0x08;

    private nint _hook = nint.Zero;
    private LowLevelKeyboardProc? _proc;
    private readonly StringBuilder _line = new();
    private bool _disposed;

    public event EventHandler<string>? RepLineCaptured;

    public void Start()
    {
        if (_hook != nint.Zero) return;
        _proc = HookCallback;
        var mod = Process.GetCurrentProcess().MainModule?.FileName;
        var hMod = string.IsNullOrEmpty(mod) ? nint.Zero : GetModuleHandle(mod);
        _hook = SetWindowsHookEx(WhKeyboardLl, _proc, hMod, 0);
        if (_hook == nint.Zero)
            throw new InvalidOperationException("Impossible d’installer le hook clavier (droits admin ?).");
    }

    public void Stop()
    {
        if (_hook == nint.Zero) return;
        UnhookWindowsHookEx(_hook);
        _hook = nint.Zero;
        _proc = null;
        _line.Clear();
    }

    private nint HookCallback(int nCode, nint wParam, nint lParam)
    {
        if (nCode >= 0 && (wParam == WmKeydown || wParam == WmSyskeydown))
        {
            var info = Marshal.PtrToStructure<Kbdllhookstruct>(lParam);
            int vk = info.VkCode;

            if (vk == VkReturn)
            {
                var s = _line.ToString().Trim();
                _line.Clear();
                if (s.StartsWith("REP-", StringComparison.OrdinalIgnoreCase))
                    RepLineCaptured?.Invoke(this, s);
            }
            else if (vk == VkBack)
            {
                if (_line.Length > 0) _line.Length -= 1;
            }
            else
            {
                var ch = VkToChar(vk);
                if (ch != '\0') _line.Append(ch);
            }
        }

        return CallNextHookEx(_hook, nCode, wParam, lParam);
    }

    private static char VkToChar(int vk)
    {
        if (vk is >= 0x30 and <= 0x39) return (char)vk;
        if (vk is >= 0x41 and <= 0x5A) return (char)vk;
        if (vk == 0xBD) return '-';
        if (vk == 0x6D) return '-';
        return '\0';
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
