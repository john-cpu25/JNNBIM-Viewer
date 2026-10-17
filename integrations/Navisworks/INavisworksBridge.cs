namespace Jnn.Integrations.Navisworks;

/// <summary>
/// Clean-room integration contract for Autodesk Navisworks Manage coordination export.
/// NOTE: Full implementation requires Autodesk Navisworks API/SDK on host.
/// </summary>
public interface INavisworksBridge
{
    bool IsNavisworksAvailable();
    Task<string> ExportClashTestsAsync(string nwdPath, string outputXml);
}
