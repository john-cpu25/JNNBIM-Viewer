using Microsoft.AspNetCore.Mvc;
using Jnn.Contracts;

namespace Jnn.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class ProjectsController : ControllerBase
{
    [HttpGet]
    public IActionResult GetProjects()
    {
        var projects = new[]
        {
            new
            {
                Id = "PROJ-METROPOLE-01",
                Name = "Metropole Tower B",
                Organization = "JNN Structural Engineering",
                ActiveRevision = "Rev 04",
                LastModified = DateTime.UtcNow.ToString("o")
            }
        };
        return Ok(projects);
    }

    [HttpGet("{projectId}/models")]
    public IActionResult GetModels(string projectId)
    {
        var models = new[]
        {
            new
            {
                Id = "MOD-METROPOLE-STR-001",
                Name = "Metropole Tower B — Structural Coordination Model",
                Revision = "Rev 04",
                Format = "IFC4",
                ElementCount = 82,
                Size = "48.5 MB",
                Status = "Ready"
            }
        };
        return Ok(models);
    }
}
