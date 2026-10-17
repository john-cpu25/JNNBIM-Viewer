using Microsoft.AspNetCore.Mvc;

namespace Jnn.Api.Controllers;

[ApiController]
[Route("api/v1/[controller]")]
public class BcfController : ControllerBase
{
    [HttpGet("topics")]
    public IActionResult GetTopics([FromQuery] string? projectId)
    {
        var topics = new[]
        {
            new
            {
                Id = "ISSUE-001",
                Title = "Transverse Beam P2-BMY-T2-2-1 rebar clashes with Longitudinal Girder at Grid 2-B (Tầng 2)",
                Priority = "Critical",
                Status = "In Progress",
                Discipline = "Structural",
                Assignee = "Nguyen Van A",
                DueDate = "2026-10-25",
                CommentsCount = 2
            },
            new
            {
                Id = "ISSUE-002",
                Title = "Beam-Column joint congestion at COL-L1-2C and P2-BMX-T1-2-C (Tầng 1, Grid 3-C)",
                Priority = "Critical",
                Status = "Open",
                Discipline = "Structural",
                Assignee = "Tran Minh T",
                DueDate = "2026-10-22",
                CommentsCount = 1
            }
        };
        return Ok(topics);
    }
}
