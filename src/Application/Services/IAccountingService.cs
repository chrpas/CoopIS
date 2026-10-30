using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;

namespace CoopIS.Application.Services;

public interface IAccountingService
{
    Task<BalanceSheetDto> GetBalanceSheetAsync(CancellationToken cancellationToken = default);
    Task<FundReconciliationDto> GetFundReconciliationAsync(CancellationToken cancellationToken = default);
    Task<BankReconciliationDto> CreateBankReconciliationAsync(CreateBankReconRequest request, CancellationToken cancellationToken = default);
    Task<IEnumerable<BankReconciliationDto>> GetReconciliationsAsync(CancellationToken cancellationToken = default);
}
