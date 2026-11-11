using System;
using System.Collections.Generic;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;

namespace CoopIS.Application.Services;

public interface IBankAccountService
{
    Task<List<BankAccountDto>> GetAllAccountsAsync(CancellationToken cancellationToken = default);
    Task<BankAccountDto?> GetAccountByIdAsync(Guid id, CancellationToken cancellationToken = default);
    Task<BankAccountDto> CreateAccountAsync(CreateBankAccountRequest request, CancellationToken cancellationToken = default);
    Task<BankAccountDto> AdjustBalanceAsync(Guid id, AdjustBankBalanceRequest request, string adjustedBy, CancellationToken cancellationToken = default);
    Task<bool> DeleteAccountAsync(Guid id, CancellationToken cancellationToken = default);
    Task<decimal> GetTotalAvailableLiquidCashAsync(CancellationToken cancellationToken = default);
    Task<LiquiditySummaryDto> GetLiquiditySummaryAsync(CancellationToken cancellationToken = default);
}

