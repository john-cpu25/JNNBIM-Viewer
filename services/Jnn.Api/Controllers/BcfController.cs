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
                Title = "HVAC Duct clashes through Girder B400x700 on Level 02",
                Priority = "Critical",
                Status = "In Progress",
                Discipline = "Mechanical",
                Assignee = "Nguyen Van A",
                DueDate = "2026-10-25",
                CommentsCount = 2
            },
            new
            {
                Id = "ISSUE-002",
                Title = "Fire protection main pipe penetrates Column COL-L1-2C",
                Priority = "Critical",
                Status = "Open",
                Discipline = "Plumbing",
                Assignee = "Tran Minh T",
                DueDate = "2026-10-22",
                CommentsCount = 1
            }
        };
        return Ok(topics);
    }
}
