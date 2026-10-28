using System;
using System.Collections.Generic;
using System.Threading.Tasks;
using CoopIS.Domain.Entities;
using CoopIS.Infrastructure.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace CoopIS.Api.Controllers;

[Authorize]
[ApiController]
[Route("api/members")]
public class MembersController : ControllerBase
{
    private readonly AppDbContext _context;

    public MembersController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Member>>> GetMembers()
    {
        var members = await _context.Members
            .AsNoTracking()
            .OrderBy(m => m.LastName)
            .ThenBy(m => m.FirstName)
            .ToListAsync();

        return Ok(members);
    }

    [HttpGet("{id:guid}")]
    public async Task<ActionResult<Member>> GetMember(Guid id)
    {
        var member = await _context.Members.FindAsync(id);
        if (member == null)
        {
            return NotFound(new { message = "Member not found." });
        }
        return Ok(member);
    }
}
