using System;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;

namespace CoopIS.Application.Services;

public interface IDistributionService
{
    Task<DistributionPreviewDto> GetPreviewAsync(int fiscalYear, CancellationToken cancellationToken = default);
    Task<DistributionPreviewDto> FinalizeDistributionAsync(int fiscalYear, CancellationToken cancellationToken = default);
    Task<MemberStatementOfAccountDto> GetMemberStatementOfAccountAsync(Guid memberId, int fiscalYear, CancellationToken cancellationToken = default);
}
