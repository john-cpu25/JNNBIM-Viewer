namespace Jnn.Integrations.Revit;

/// <summary>
/// Clean-room integration contract for Autodesk Revit structural geometry export.
/// Targets Revit 2024 (.NET Framework 4.8), Revit 2025-2026 (.NET 8), and Revit 2027 (.NET 10).
/// NOTE: Full implementation requires Autodesk Revit SDK installed on host machine.
/// </summary>
public interface IRevitExporterBridge
{
    string TargetRevitVersion { get; }
    bool IsRevitInstalled();
    Task<string> ExportActiveViewToJnnBundleAsync(string outputPath, bool exportReinforcement);
}
