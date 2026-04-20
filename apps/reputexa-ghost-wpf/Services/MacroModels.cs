using System.Text.Json.Serialization;

namespace ReputexaGhost.Services;

public sealed class MacroStepDto
{
    [JsonPropertyName("kind")]
    public string Kind { get; set; } = "vk";

    /// <summary>Virtual-key code (ex. F10 = 0x79, Entrée = 0x0D).</summary>
    [JsonPropertyName("vk")]
    public int Vk { get; set; }

    /// <summary>Si kind = text : chaîne ; utiliser {EUROS} pour le montant (ex. 12,50).</summary>
    [JsonPropertyName("text")]
    public string? Text { get; set; }

    [JsonPropertyName("delayMs")]
    public int? DelayMs { get; set; }
}

public sealed class GhostPersistedConfig
{
    [JsonPropertyName("baseUrl")]
    public string BaseUrl { get; set; } = "";

    [JsonPropertyName("token")]
    public string Token { get; set; } = "";

    [JsonPropertyName("remiseMacroSteps")]
    public List<MacroStepDto> RemiseMacroSteps { get; set; } = new();
}
