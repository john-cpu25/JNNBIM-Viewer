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
                Name = "Test 01 — Structural Framing vs HVAC Ducts",
                CategoryA = "IfcBeam",
                CategoryB = "IfcDuct",
                Tolerance = 10.0f,
                ClashType = "Hard Clash",
                UnresolvedCount = 4
            }
        };
        return Ok(tests);
    }

    [HttpGet("results")]
    public IActionResult GetResults([FromQuery] string testId)
    {
        var results = new[]
        {
            new ClashResultDto("CL-001", "Active", "Critical", "BM-X-L2-2-2", "MEP-DUCT-01", 42.5f, "Grid 2-B", "Nguyen Van A"),
            new ClashResultDto("CL-002", "New", "Critical", "COL-L1-2C", "MEP-PIPE-02", 58.0f, "Grid 3-C", "Tran Minh T"),
            new ClashResultDto("CL-003", "Reviewed", "Major", "SLAB-L2", "MEP-DUCT-01", 18.0f, "Grid 2-B", "Le Hoang K"),
            new ClashResultDto("CL-004", "Resolved", "Minor", "FTG-1A", "MEP-PIPE-02", 0.0f, "Grid 1-A", "Pham Vu N")
        };
        return Ok(results);
    }
}
