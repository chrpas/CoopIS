using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CoopIS.Api.Controllers;

[Authorize(Roles = "Admin,User")]
[ApiController]
[Route("api/settings/financial-policy")]
public class FinancialPolicyController : ControllerBase
{
    private readonly IFinancialPolicyService _financialPolicyService;

    public FinancialPolicyController(IFinancialPolicyService financialPolicyService)
    {
        _financialPolicyService = financialPolicyService;
    }

    [HttpGet]
    public async Task<ActionResult<FinancialPolicyResponseDto>> GetFinancialPolicy(CancellationToken cancellationToken)
    {
        var policy = await _financialPolicyService.GetPolicyOverviewAsync(cancellationToken);
        return Ok(policy);
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("loan")]
    public async Task<ActionResult<FinancialPolicyResponseDto>> UpdateLoanPolicy(
        [FromBody] UpdateLoanPolicyRequestDto request,
        CancellationToken cancellationToken)
    {
        var updated = await _financialPolicyService.UpdateLoanPolicyAsync(request, cancellationToken);
        return Ok(updated);
    }

    [Authorize(Roles = "Admin")]
    [HttpPut("distribution")]
    public async Task<ActionResult<FinancialPolicyResponseDto>> UpdateDistributionWeights(
        [FromBody] UpdateDistributionWeightsRequestDto request,
        CancellationToken cancellationToken)
    {
        var updated = await _financialPolicyService.UpdateDistributionWeightsAsync(request, cancellationToken);
        return Ok(updated);
    }
}

