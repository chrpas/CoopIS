using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;

namespace CoopIS.Application.Services;

public interface ILoanQueueService
{
    Task<LoanQueueEntryDto> ApplyAsync(Guid memberId, ApplyLoanQueueRequest request, CancellationToken cancellationToken = default);
    Task<List<LoanQueueEntryDto>> GetQueueAsync(CancellationToken cancellationToken = default);
    Task<MyQueueStatusDto> GetMyQueueStatusAsync(Guid memberId, CancellationToken cancellationToken = default);
    Task<LoanResponseDto> DisburseQueueEntryAsync(Guid queueId, Guid? adminMemberId = null, Guid? selectedBankAccountId = null, CancellationToken cancellationToken = default);
    Task<LoanQueueEntryDto> UpdateStatusAsync(Guid queueId, UpdateQueueStatusRequest request, CancellationToken cancellationToken = default);
}

