using System;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;

namespace CoopIS.Application.Services;

public interface IFinancialPolicyService
{
    Task<FinancialPolicyResponseDto> GetPolicyOverviewAsync(CancellationToken cancellationToken = default);
    Task<LoanPolicySnapshotDto> GetEffectiveLoanPolicyAsync(DateTime asOfUtc, CancellationToken cancellationToken = default);
    Task<DistributionWeightSnapshotDto> GetEffectiveDistributionWeightsAsync(int fiscalYear, CancellationToken cancellationToken = default);
    Task<FinancialPolicyResponseDto> UpdateLoanPolicyAsync(UpdateLoanPolicyRequestDto request, CancellationToken cancellationToken = default);
    Task<FinancialPolicyResponseDto> UpdateDistributionWeightsAsync(UpdateDistributionWeightsRequestDto request, CancellationToken cancellationToken = default);
}

