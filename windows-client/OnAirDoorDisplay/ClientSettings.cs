namespace OnAirDoorDisplay;

internal sealed class ClientSettings
{
    public string DisplayUrl { get; set; } = "http://localhost:8080/display";
    public bool LaunchFullscreen { get; set; } = true;
}
