using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using CoopIS.Application.DTOs;
using CoopIS.Application.Services;
using CoopIS.Domain.Entities;
using CoopIS.Domain.Enums;
using CoopIS.Domain.Exceptions;
using CoopIS.Infrastructure.Data;
using Microsoft.EntityFrameworkCore;

namespace CoopIS.Infrastructure.Services;

public class ContributionService : IContributionService
{
    private readonly AppDbContext _context;

    public ContributionService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<IEnumerable<CutoffMemberContributionDto>> GetCutoffContributionsAsync(
        Guid cutoffId,
        CancellationToken cancellationToken = default)
    {
        var cutoff = await _context.CutoffPeriods
            .AsNoTracking()
            .FirstOrDefaultAsync(c => c.Id == cutoffId, cancellationToken);

        if (cutoff == null)
        {
            throw new NotFoundException($"Cutoff period with ID '{cutoffId}' was not found.");
        }

        var members = await _context.Members
            .AsNoTracking()
            .OrderBy(m => m.MemberCode)
            .ToListAsync(cancellationToken);

        var existingContributions = await _context.Contributions
            .AsNoTracking()
            .Where(c => c.CutoffId == cutoffId)
            .ToDictionaryAsync(c => c.MemberId, cancellationToken);

        var result = new List<CutoffMemberContributionDto>(members.Count);

        foreach (var member in members)
        {
            if (existingContributions.TryGetValue(member.Id, out var contribution))
            {
                result.Add(new CutoffMemberContributionDto(
                    member.Id,
                    member.MemberCode,
                    $"{member.FirstName} {member.LastName}",
                    member.Email,
                    member.Status,
                    cutoff.Id,
                    cutoff.Label,
                    contribution.Id,
                    contribution.Amount,
                    contribution.PaymentChannel,
                    contribution.CreatedAt
                ));
            }
            else
            {
                result.Add(new CutoffMemberContributionDto(
                    member.Id,
                    member.MemberCode,
                    $"{member.FirstName} {member.LastName}",
                    member.Email,
                    member.Status,
                    cutoff.Id,
                    cutoff.Label,
                    null,
                    0.00m,
                    PaymentChannel.PAYROLL_DEDUCTION,
                    null
                ));
            }
        }

        return result;
    }

    public async Task<BatchContributionResultDto> BatchUpsertContributionsAsync(
        IEnumerable<ContributionItemDto> items,
        CancellationToken cancellationToken = default)
    {
        var itemList = items?.ToList() ?? new List<ContributionItemDto>();

        if (itemList.Count == 0)
        {
            return new BatchContributionResultDto(0, 0, 0, 0m, "No contribution items were submitted.");
        }

        // Financial Validation: Ensure negative amounts are rejected
        var negativeItem = itemList.FirstOrDefault(i => i.Amount < 0);
        if (negativeItem != null)
        {
            throw new ValidationException(
                $"Negative contribution amount ({negativeItem.Amount:C}) is strictly prohibited for member ID '{negativeItem.MemberId}'.");
        }

        // Consolidate duplicates in the batch itself: last entry takes precedence
        var consolidatedItems = itemList
            .GroupBy(i => new { i.MemberId, i.CutoffId })
            .Select(g => g.Last())
            .ToList();

        // Verify all referenced cutoffs exist
        var cutoffIds = consolidatedItems.Select(i => i.CutoffId).Distinct().ToList();
        var existingCutoffs = await _context.CutoffPeriods
            .Where(c => cutoffIds.Contains(c.Id))
            .Select(c => c.Id)
            .ToListAsync(cancellationToken);

        var missingCutoff = cutoffIds.Except(existingCutoffs).FirstOrDefault();
        if (missingCutoff != Guid.Empty)
        {
            throw new NotFoundException($"Cutoff period with ID '{missingCutoff}' was not found.");
        }

        // Verify all referenced members exist
        var memberIds = consolidatedItems.Select(i => i.MemberId).Distinct().ToList();
        var existingMemberIds = await _context.Members
            .Where(m => memberIds.Contains(m.Id))
            .Select(m => m.Id)
            .ToListAsync(cancellationToken);

        var missingMember = memberIds.Except(existingMemberIds).FirstOrDefault();
        if (missingMember != Guid.Empty)
        {
            throw new NotFoundException($"Member with ID '{missingMember}' was not found.");
        }

        // Load existing contribution records for these (MemberId, CutoffId) pairs
        var existingRecords = await _context.Contributions
            .Where(c => cutoffIds.Contains(c.CutoffId) && memberIds.Contains(c.MemberId))
            .ToListAsync(cancellationToken);

        int createdCount = 0;
        int updatedCount = 0;

        // Transactional execution
        bool supportsTransactions = !_context.Database.IsInMemory();

        if (supportsTransactions)
        {
            await using var transaction = await _context.Database.BeginTransactionAsync(cancellationToken);
            try
            {
                UpsertEntities(consolidatedItems, existingRecords, ref createdCount, ref updatedCount);
                await _context.SaveChangesAsync(cancellationToken);
                await transaction.CommitAsync(cancellationToken);
            }
            catch
            {
                await transaction.RollbackAsync(cancellationToken);
                throw;
            }
        }
        else
        {
            UpsertEntities(consolidatedItems, existingRecords, ref createdCount, ref updatedCount);
            await _context.SaveChangesAsync(cancellationToken);
        }

        decimal totalAmount = consolidatedItems.Sum(i => i.Amount);

        return new BatchContributionResultDto(
            consolidatedItems.Count,
            createdCount,
            updatedCount,
            totalAmount,
            $"Batch processed successfully: {createdCount} inserted, {updatedCount} updated. Total: ₱{totalAmount:N2}."
        );
    }

    private void UpsertEntities(
        List<ContributionItemDto> items,
        List<Contribution> existingRecords,
        ref int createdCount,
        ref int updatedCount)
    {
        foreach (var item in items)
        {
            var match = existingRecords.FirstOrDefault(c =>
                c.MemberId == item.MemberId && c.CutoffId == item.CutoffId);

            if (match != null)
            {
                match.Amount = item.Amount;
                match.PaymentChannel = item.PaymentChannel;
                updatedCount++;
            }
            else
            {
                var newEntity = new Contribution
                {
                    Id = Guid.NewGuid(),
                    MemberId = item.MemberId,
                    CutoffId = item.CutoffId,
                    Amount = item.Amount,
                    PaymentChannel = item.PaymentChannel,
                    CreatedAt = DateTime.UtcNow
                };
                _context.Contributions.Add(newEntity);
                existingRecords.Add(newEntity); // in case subsequent duplicate in collection
                createdCount++;
            }
        }
    }

    public async Task<ContributionSummaryDto> GetSummaryAsync(CancellationToken cancellationToken = default)
    {
        var grandTotal = await _context.Contributions
            .SumAsync(c => (decimal?)c.Amount, cancellationToken) ?? 0m;

        var totalMembers = await _context.Members.CountAsync(cancellationToken);

        var activeContributingCount = await _context.Contributions
            .Where(c => c.Amount > 0 && c.Member.Status == MemberStatus.ACTIVE)
            .Select(c => c.MemberId)
            .Distinct()
            .CountAsync(cancellationToken);

        var memberSummaries = await _context.Members
            .AsNoTracking()
            .OrderBy(m => m.MemberCode)
            .Select(m => new MemberContributionSummaryDto(
                m.Id,
                m.MemberCode,
                $"{m.FirstName} {m.LastName}",
                m.Contributions.Sum(c => (decimal?)c.Amount) ?? 0m,
                m.Contributions.Count,
                m.Contributions.OrderByDescending(c => c.CreatedAt).Select(c => (DateTime?)c.CreatedAt).FirstOrDefault()
            ))
            .ToListAsync(cancellationToken);

        decimal averageContribution = totalMembers > 0 ? Math.Round(grandTotal / totalMembers, 2) : 0m;

        return new ContributionSummaryDto(
            grandTotal,
            activeContributingCount,
            totalMembers,
            averageContribution,
            memberSummaries
        );
    }
}
