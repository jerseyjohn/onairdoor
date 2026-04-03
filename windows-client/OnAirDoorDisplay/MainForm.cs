using Microsoft.Web.WebView2.WinForms;

namespace OnAirDoorDisplay;

internal sealed class MainForm : Form
{
    private readonly ClientSettings _settings;
    private readonly WebView2 _webView;

    public MainForm(ClientSettings settings)
    {
        _settings = settings;
        Text = "OnAirDoor Display";
        WindowState = _settings.LaunchFullscreen ? FormWindowState.Maximized : FormWindowState.Normal;
        FormBorderStyle = _settings.LaunchFullscreen ? FormBorderStyle.None : FormBorderStyle.Sizable;
        KeyPreview = true;
        BackColor = Color.Black;

        _webView = new WebView2
        {
            Dock = DockStyle.Fill
        };

        Controls.Add(_webView);
        Load += OnLoad;
        KeyDown += OnKeyDown;
    }

    private async void OnLoad(object? sender, EventArgs e)
    {
        await _webView.EnsureCoreWebView2Async();
        _webView.Source = new Uri(_settings.DisplayUrl);
    }

    private void OnKeyDown(object? sender, KeyEventArgs e)
    {
        if (e.KeyCode == Keys.F11)
        {
            ToggleFullscreen();
        }

        if (e.KeyCode == Keys.F5)
        {
            _webView.Reload();
        }

        if (e.KeyCode == Keys.Escape && FormBorderStyle == FormBorderStyle.None)
        {
            ToggleFullscreen();
        }
    }

    private void ToggleFullscreen()
    {
        var isFullscreen = FormBorderStyle == FormBorderStyle.None;
        FormBorderStyle = isFullscreen ? FormBorderStyle.Sizable : FormBorderStyle.None;
        WindowState = isFullscreen ? FormWindowState.Normal : FormWindowState.Maximized;
    }
}
