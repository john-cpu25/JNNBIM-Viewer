namespace Jnn.Integrations.Aps;

/// <summary>
/// Cloud adapter interface for Autodesk Platform Services (APS) Model Derivative & Viewer SDK.
/// Requires APS Client ID, Secret, and active 2-legged OAuth token.
/// </summary>
public interface IApsViewerAdapter
{
    Task<string> RequestModelTranslationAsync(string urn, string targetFormat = "svf2");
    Task<string> GetManifestStatusAsync(string urn);
    Task<string> GetViewerAccessTokenAsync();
}
