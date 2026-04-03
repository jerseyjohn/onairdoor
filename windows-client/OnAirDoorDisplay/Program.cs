using System.Text.Json;

namespace OnAirDoorDisplay;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new MainForm(LoadSettings()));
    }

    private static ClientSettings LoadSettings()
    {
        var settingsPath = Path.Combine(AppContext.BaseDirectory, "appsettings.json");
        ClientSettings settings = new();

        if (File.Exists(settingsPath))
        {
            var json = File.ReadAllText(settingsPath);
            settings = JsonSerializer.Deserialize<ClientSettings>(json) ?? new ClientSettings();
        }

        var displayUrl = Environment.GetEnvironmentVariable("ONAIRDOOR_DISPLAY_URL");
        if (!string.IsNullOrWhiteSpace(displayUrl))
        {
            settings.DisplayUrl = displayUrl;
        }

        return settings;
    }
}
