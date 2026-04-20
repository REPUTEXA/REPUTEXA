using System.Runtime.InteropServices;

namespace ReputexaGhost.Interop;

/// <summary>
/// Dwmapi : effet type « verre » système (DWMSBT_TRANSIENTWINDOW ≈ Acrylic transitoire Win11).
/// Sans layered WPF classique — meilleure perf que BlurEffect GPU côté WPF.
/// </summary>
internal static class DwmInterop
{
    private const int DwmwaSystemBackdropType = 38;
    private const int DwmwaWindowCornerPreference = 33;

    /// <summary>DWMSBT_TRANSIENTWINDOW — arrière-plan flou type popover.</summary>
    private const int DwmsbtTransientWindow = 3;

    private const int DwmwcpRound = 2;

    [DllImport("dwmapi.dll", PreserveSig = true)]
    private static extern int DwmSetWindowAttribute(nint hwnd, int dwAttribute, ref int pvAttribute, int cbAttribute);

    public static void TryApplyGlassChrome(nint hwnd)
    {
        if (hwnd == nint.Zero) return;
        try
        {
            var backdrop = DwmsbtTransientWindow;
            _ = DwmSetWindowAttribute(hwnd, DwmwaSystemBackdropType, ref backdrop, sizeof(int));
            var round = DwmwcpRound;
            _ = DwmSetWindowAttribute(hwnd, DwmwaWindowCornerPreference, ref round, sizeof(int));
        }
        catch
        {
            /* Win10 ou DWM indisponible */
        }
    }
}
