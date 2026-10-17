using Microsoft.AspNetCore.Mvc;
using Jnn.Contracts;

namespace Jnn.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class QuantityController : ControllerBase
{
    [HttpGet("summary")]
    public IActionResult GetSummary([FromQuery] string? modelId)
    {
        var summary = new[]
        {
            new QuantitySummaryDto("Foundation", "IfcFooting", 34.83f, 63.36f, 9),
            new QuantitySummaryDto("Level 01", "IfcColumn", 15.55f, 126.72f, 16),
            new QuantitySummaryDto("Level 01", "IfcBeam", 33.48f, 198.40f, 32),
            new QuantitySummaryDto("Level 02", "IfcColumn", 15.55f, 126.72f, 16),
            new QuantitySummaryDto("Level 02", "IfcBeam", 33.48f, 198.40f, 32),
            new QuantitySummaryDto("Level 02", "IfcSlab", 61.20f, 324.00f, 1),
            new QuantitySummaryDto("Core Wall", "IfcWall", 38.88f, 259.20f, 6)
        };
        return Ok(summary);
    }
}
