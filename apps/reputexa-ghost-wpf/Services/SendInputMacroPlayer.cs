using System.Runtime.InteropServices;

namespace ReputexaGhost.Services;

/// <summary>
/// Rejeu de macro au niveau OS (SendInput) — la caisse ne distingue pas d’une saisie clavier réelle.
/// </summary>
public static class SendInputMacroPlayer
{
    private const uint InputKeyboard = 1;
    private const uint KeyeventfKeyup = 0x0002;
    private const uint KeyeventfUnicode = 0x0004;

    public static void Play(IReadOnlyList<MacroStepDto> steps, string eurosText, int defaultDelayMs = 45)
    {
        foreach (var s in steps)
        {
            var delay = s.DelayMs ?? defaultDelayMs;
            var k = (s.Kind ?? "vk").Trim().ToLowerInvariant();
            if (k == "text")
            {
                var t = (s.Text ?? "").Replace("{EUROS}", eurosText, StringComparison.OrdinalIgnoreCase);
                foreach (var ch in t)
                    TapUnicode(ch);
            }
            else
            {
                TapVk((ushort)Math.Clamp(s.Vk, 0, 255));
            }

            Thread.Sleep(Math.Clamp(delay, 0, 5000));
        }
    }

    private static void TapVk(ushort vk)
    {
        var down = BuildKey(vk, 0);
        var up = BuildKey(vk, KeyeventfKeyup);
        INPUT[] buf = { down, up };
        _ = SendInput(2, buf, Marshal.SizeOf<INPUT>());
    }

    private static void TapUnicode(char c)
    {
        var u = (ushort)c;
        var down = BuildUnicode(u, 0);
        var up = BuildUnicode(u, KeyeventfKeyup);
        INPUT[] buf = { down, up };
        _ = SendInput(2, buf, Marshal.SizeOf<INPUT>());
    }

    private static INPUT BuildKey(ushort vk, uint flags) =>
        new()
        {
            type = InputKeyboard,
            U = new InputUnion
            {
                ki = new Keybdinput
                {
                    wVk = vk,
                    wScan = 0,
                    dwFlags = flags,
                    time = 0,
                    dwExtraInfo = UIntPtr.Zero,
                },
            },
        };

    private static INPUT BuildUnicode(ushort ch, uint flags) =>
        new()
        {
            type = InputKeyboard,
            U = new InputUnion
            {
                ki = new Keybdinput
                {
                    wVk = 0,
                    wScan = ch,
                    dwFlags = flags | KeyeventfUnicode,
                    time = 0,
                    dwExtraInfo = UIntPtr.Zero,
                },
            },
        };

    [DllImport("user32.dll", SetLastError = true)]
    private static extern uint SendInput(uint nInputs, INPUT[] pInputs, int cbSize);

    [StructLayout(LayoutKind.Sequential)]
    private struct INPUT
    {
        public uint type;
        public InputUnion U;
    }

    [StructLayout(LayoutKind.Explicit)]
    private struct InputUnion
    {
        [FieldOffset(0)] public Keybdinput ki;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct Keybdinput
    {
        public ushort wVk;
        public ushort wScan;
        public uint dwFlags;
        public uint time;
        public UIntPtr dwExtraInfo;
    }
}
