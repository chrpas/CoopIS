using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;

namespace CoopIS.Application.Services;

public interface IContributionService
{
    Task<IEnumerable<CutoffMemberContributionDto>> GetCutoffContributionsAsync(Guid cutoffId, CancellationToken cancellationToken = default);
    Task<BatchContributionResultDto> BatchUpsertContributionsAsync(IEnumerable<ContributionItemDto> items, CancellationToken cancellationToken = default);
    Task<ContributionSummaryDto> GetSummaryAsync(CancellationToken cancellationToken = default);
}
