using System;
using System.IO;
using System.Text.Json;
using System.Windows;
using Microsoft.Web.WebView2.Core;
using Jnn.Contracts;

namespace Jnn.Desktop;

public partial class MainWindow : Window
{
    private const string DevServerUrl = "http://localhost:5173";

    public MainWindow()
    {
        InitializeComponent();
        Loaded += OnWindowLoaded;
    }

    private async void OnWindowLoaded(object sender, RoutedEventArgs e)
    {
        try
        {
            var userDataFolder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "JnnBimViewer", "WebView2Data");
            var environment = await CoreWebView2Environment.CreateAsync(null, userDataFolder);

            await ViewerWebView.EnsureCoreWebView2Async(environment);

            ViewerWebView.CoreWebView2.WebMessageReceived += OnWebMessageReceived;

            // Navigate to active frontend
            ViewerWebView.Source = new Uri(DevServerUrl);
        }
        catch (Exception ex)
        {
            MessageBox.Show($"Failed to initialize WebView2 engine: {ex.Message}", "JNN BIM Desktop", MessageBoxButton.OK, MessageBoxImage.Error);
        }
    }

    private void OnWebMessageReceived(object? sender, CoreWebView2WebMessageReceivedEventArgs e)
    {
        try
        {
            var json = e.WebMessageAsJson;
            var message = JsonSerializer.Deserialize<BridgeMessage<JsonElement>>(json);
            if (message != null)
            {
                System.Diagnostics.Debug.WriteLine($"[IPC Received] Action={message.Action}");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[IPC Error] {ex.Message}");
        }
    }

    private void OnOpenLocalFileClicked(object sender, RoutedEventArgs e)
    {
        var dialog = new Microsoft.Win32.OpenFileDialog
        {
            Filter = "BIM Model Files (*.ifc;*.rvt;*.nwd;*.nwc)|*.ifc;*.rvt;*.nwd;*.nwc|All Files (*.*)|*.*",
            Title = "Select BIM Model to Ingest"
        };

        if (dialog.ShowDialog() == true)
        {
            var fileInfo = new FileInfo(dialog.FileName);
            if (ViewerWebView.CoreWebView2 != null)
            {
                var payload = new
                {
                    filePath = fileInfo.FullName,
                    fileName = fileInfo.Name,
                    fileSize = fileInfo.Exists ? fileInfo.Length : 0L
                };
                var bridgeMsg = new BridgeMessage<object>("LoadLocalFile", payload);
                ViewerWebView.CoreWebView2.PostWebMessageAsJson(JsonSerializer.Serialize(bridgeMsg));
            }
            else
            {
                MessageBox.Show($"Selected model: {dialog.FileName}\nForwarding path to Ingestion Pipeline.", "JNN Model Ingestion", MessageBoxButton.OK, MessageBoxImage.Information);
            }
        }
    }

    private void OnReloadClicked(object sender, RoutedEventArgs e)
    {
        ViewerWebView.Reload();
    }
}
