using Microsoft.AspNetCore.Mvc;
using Jnn.Contracts;

namespace Jnn.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class ClashController : ControllerBase
{
    [HttpGet("tests")]
    public IActionResult GetTests([FromQuery] string? projectId)
    {
        var tests = new[]
        {
            new
            {
                Id = "TEST-001",
                Name = "Test 01 — Structural Framing vs Columns & Slabs (Project2)",
                CategoryA = "IfcBeam",
                CategoryB = "IfcColumn",
                Tolerance = 10.0f,
                ClashType = "Hard Clash",
                UnresolvedCount = 3
            }
        };
        return Ok(tests);
    }

    [HttpGet("results")]
    public IActionResult GetResults([FromQuery] string testId)
    {
        var results = new[]
        {
            new ClashResultDto("CL-001", "Active", "Critical", "BM-X-L2-2-2", "P2-BMY-T2-2-1", 42.5f, "Grid 2-B", "Nguyen Van A"),
            new ClashResultDto("CL-002", "New", "Critical", "COL-L1-2C", "P2-BMX-T1-2-C", 58.0f, "Grid 3-C", "Tran Minh T"),
            new ClashResultDto("CL-003", "Reviewed", "Major", "P2-SLAB-T3-CTR-FRONT", "P2-STAIR-FLIGHT-1", 18.0f, "Grid 4-B", "Le Hoang K"),
            new ClashResultDto("CL-004", "Resolved", "Minor", "P2-FTG-1A", "P2-GB-X-1-A", 0.0f, "Grid 1-A", "Pham Vu N")
        };
        return Ok(results);
    }
}
