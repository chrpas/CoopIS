using System;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
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

public class MemberService : IMemberService
{
    private readonly AppDbContext _context;

    public MemberService(AppDbContext context)
    {
        _context = context;
    }

    public async Task<PagedResult<MemberDto>> GetMembersAsync(
        MemberQueryParams queryParams,
        CancellationToken cancellationToken = default)
    {
        var query = _context.Members.AsNoTracking();

        // 1. Search Query Filter (name, memberCode, email, phone)
        if (!string.IsNullOrWhiteSpace(queryParams.Search))
        {
            var search = queryParams.Search.Trim().ToLower();
            query = query.Where(m =>
                m.MemberCode.ToLower().Contains(search) ||
                m.FirstName.ToLower().Contains(search) ||
                m.LastName.ToLower().Contains(search) ||
                m.Email.ToLower().Contains(search) ||
                (m.Phone != null && m.Phone.ToLower().Contains(search)));
        }

        // 2. Status Filter
        if (queryParams.Status.HasValue)
        {
            query = query.Where(m => m.Status == queryParams.Status.Value);
        }

        // 3. Sorting
        var isDesc = string.Equals(queryParams.SortOrder, "desc", StringComparison.OrdinalIgnoreCase);
        var sortBy = queryParams.SortBy?.Trim().ToLowerInvariant() ?? "lastname";

        query = sortBy switch
        {
            "membercode" => isDesc ? query.OrderByDescending(m => m.MemberCode) : query.OrderBy(m => m.MemberCode),
            "firstname" => isDesc ? query.OrderByDescending(m => m.FirstName).ThenByDescending(m => m.LastName)
                                  : query.OrderBy(m => m.FirstName).ThenBy(m => m.LastName),
            "email" => isDesc ? query.OrderByDescending(m => m.Email) : query.OrderBy(m => m.Email),
            "status" => isDesc ? query.OrderByDescending(m => m.Status) : query.OrderBy(m => m.Status),
            "createdat" => isDesc ? query.OrderByDescending(m => m.CreatedAt) : query.OrderBy(m => m.CreatedAt),
            _ => isDesc ? query.OrderByDescending(m => m.LastName).ThenByDescending(m => m.FirstName)
                        : query.OrderBy(m => m.LastName).ThenBy(m => m.FirstName)
        };

        // 4. Total Count
        var totalCount = await query.CountAsync(cancellationToken);

        // 5. Pagination
        var page = Math.Max(1, queryParams.Page);
        var pageSize = Math.Clamp(queryParams.PageSize, 1, 100);
        var totalPages = totalCount == 0 ? 0 : (int)Math.Ceiling(totalCount / (double)pageSize);

        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(m => new MemberDto(
                m.Id,
                m.MemberCode,
                m.FirstName,
                m.LastName,
                m.Email,
                m.Phone,
                m.Status,
                m.CreatedAt,
                m.UpdatedAt,
                m.Contributions.Sum(c => (decimal?)c.Amount) ?? 0m,
                m.Loans.Count(l => l.Status == LoanStatus.ACTIVE || l.Status == LoanStatus.APPROVED)
            ))
            .ToListAsync(cancellationToken);

        return new PagedResult<MemberDto>(items, totalCount, page, pageSize, totalPages);
    }

    public async Task<MemberDetailDto> GetMemberByIdAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var member = await _context.Members
            .AsNoTracking()
            .Include(m => m.Contributions)
                .ThenInclude(c => c.CutoffPeriod)
            .Include(m => m.Loans)
                .ThenInclude(l => l.Repayments)
            .FirstOrDefaultAsync(m => m.Id == id, cancellationToken);

        if (member == null)
        {
            throw new NotFoundException($"Member with ID '{id}' was not found.");
        }

        // Contributions summary
        var totalShareContributions = member.Contributions.Sum(c => c.Amount);
        var contributionsCount = member.Contributions.Count;
        var lastContributionDate = member.Contributions
            .OrderByDescending(c => c.CreatedAt)
            .Select(c => (DateTime?)c.CreatedAt)
            .FirstOrDefault();

        var contributionItems = member.Contributions
            .OrderByDescending(c => c.CutoffPeriod != null ? c.CutoffPeriod.CutoffDate : c.CreatedAt)
            .Select(c => new MemberContributionItemDto(
                c.Id,
                c.CutoffId,
                c.CutoffPeriod != null ? c.CutoffPeriod.Label : "N/A",
                c.CutoffPeriod != null ? c.CutoffPeriod.CutoffDate : c.CreatedAt,
                c.Amount,
                c.PaymentChannel,
                c.CreatedAt
            ))
            .ToList();

        // Loans summary
        var loanItems = member.Loans
            .OrderByDescending(l => l.OriginationDate)
            .Select(l =>
            {
                var principalPaid = l.Repayments.Sum(r => r.PrincipalPaid);
                var remainingBalance = Math.Max(0m, l.PrincipalAmount - principalPaid);
                return new MemberLoanSummaryDto(
                    l.Id,
                    l.LoanReference,
                    l.OriginationDate,
                    l.PrincipalAmount,
                    l.InterestRate,
                    l.ReleasedAmount,
                    l.CutoffPaymentAmount,
                    l.TermMonths,
                    l.CutoffsCount,
                    l.Status,
                    principalPaid,
                    remainingBalance,
                    l.CreatedAt
                );
            })
            .ToList();

        var activeLoans = loanItems.Where(l => l.Status == LoanStatus.ACTIVE || l.Status == LoanStatus.APPROVED).ToList();
        var totalActiveLoanBalance = activeLoans.Sum(l => l.RemainingBalance);
        var activeLoansCount = activeLoans.Count;

        return new MemberDetailDto(
            member.Id,
            member.MemberCode,
            member.FirstName,
            member.LastName,
            member.Email,
            member.Phone,
            member.Status,
            member.CreatedAt,
            member.UpdatedAt,
            totalShareContributions,
            contributionsCount,
            lastContributionDate,
            contributionItems,
            totalActiveLoanBalance,
            activeLoansCount,
            loanItems
        );
    }

    public async Task<MemberDto> CreateMemberAsync(
        CreateMemberRequest request,
        CancellationToken cancellationToken = default)
    {
        // 1. Validation
        if (string.IsNullOrWhiteSpace(request.FirstName))
            throw new ValidationException("First name is required.");

        if (string.IsNullOrWhiteSpace(request.LastName))
            throw new ValidationException("Last name is required.");

        if (string.IsNullOrWhiteSpace(request.Email))
            throw new ValidationException("Email address is required.");

        var emailNormalized = request.Email.Trim().ToLowerInvariant();
        if (!Regex.IsMatch(emailNormalized, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
            throw new ValidationException("Invalid email address format.");

        // Unique Email Check
        var emailExists = await _context.Members
            .AnyAsync(m => m.Email.ToLower() == emailNormalized, cancellationToken);
        if (emailExists)
            throw new ValidationException($"A member with email '{request.Email}' already exists.");

        // Member Code Resolution & Unique Check
        string memberCode;
        if (string.IsNullOrWhiteSpace(request.MemberCode))
        {
            memberCode = await GenerateMemberCodeAsync(cancellationToken);
        }
        else
        {
            memberCode = request.MemberCode.Trim().ToUpperInvariant();
            var codeExists = await _context.Members
                .AnyAsync(m => m.MemberCode.ToUpper() == memberCode, cancellationToken);
            if (codeExists)
                throw new ValidationException($"A member with Member Code '{request.MemberCode}' already exists.");
        }

        var member = new Member
        {
            Id = Guid.NewGuid(),
            MemberCode = memberCode,
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            Email = emailNormalized,
            Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            Status = request.Status,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        _context.Members.Add(member);
        await _context.SaveChangesAsync(cancellationToken);

        return new MemberDto(
            member.Id,
            member.MemberCode,
            member.FirstName,
            member.LastName,
            member.Email,
            member.Phone,
            member.Status,
            member.CreatedAt,
            member.UpdatedAt,
            0m,
            0
        );
    }

    public async Task<MemberDto> UpdateMemberAsync(
        Guid id,
        UpdateMemberRequest request,
        CancellationToken cancellationToken = default)
    {
        var member = await _context.Members
            .FirstOrDefaultAsync(m => m.Id == id, cancellationToken);

        if (member == null)
            throw new NotFoundException($"Member with ID '{id}' was not found.");

        if (string.IsNullOrWhiteSpace(request.FirstName))
            throw new ValidationException("First name is required.");

        if (string.IsNullOrWhiteSpace(request.LastName))
            throw new ValidationException("Last name is required.");

        if (string.IsNullOrWhiteSpace(request.Email))
            throw new ValidationException("Email address is required.");

        var emailNormalized = request.Email.Trim().ToLowerInvariant();
        if (!Regex.IsMatch(emailNormalized, @"^[^@\s]+@[^@\s]+\.[^@\s]+$"))
            throw new ValidationException("Invalid email address format.");

        // Unique Email Check (excluding current member)
        var emailExists = await _context.Members
            .AnyAsync(m => m.Id != id && m.Email.ToLower() == emailNormalized, cancellationToken);
        if (emailExists)
            throw new ValidationException($"Another member with email '{request.Email}' already exists.");

        // If status changed to INACTIVE or SUSPENDED, check for active loans
        if (request.Status != MemberStatus.ACTIVE && member.Status == MemberStatus.ACTIVE)
        {
            var hasActiveLoans = await _context.Loans
                .AnyAsync(l => l.MemberId == id && (l.Status == LoanStatus.ACTIVE || l.Status == LoanStatus.APPROVED || l.Status == LoanStatus.PENDING_APPROVAL), cancellationToken);

            if (hasActiveLoans)
            {
                throw new DomainException($"Cannot set member status to '{request.Status}' because the member has active or pending loans.");
            }
        }

        member.FirstName = request.FirstName.Trim();
        member.LastName = request.LastName.Trim();
        member.Email = emailNormalized;
        member.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        member.Status = request.Status;
        member.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        var totalContributions = await _context.Contributions
            .Where(c => c.MemberId == id)
            .SumAsync(c => (decimal?)c.Amount, cancellationToken) ?? 0m;

        var activeLoansCount = await _context.Loans
            .CountAsync(l => l.MemberId == id && (l.Status == LoanStatus.ACTIVE || l.Status == LoanStatus.APPROVED), cancellationToken);

        return new MemberDto(
            member.Id,
            member.MemberCode,
            member.FirstName,
            member.LastName,
            member.Email,
            member.Phone,
            member.Status,
            member.CreatedAt,
            member.UpdatedAt,
            totalContributions,
            activeLoansCount
        );
    }

    public async Task<MemberDto> UpdateMemberStatusAsync(
        Guid id,
        UpdateMemberStatusRequest request,
        CancellationToken cancellationToken = default)
    {
        var member = await _context.Members
            .FirstOrDefaultAsync(m => m.Id == id, cancellationToken);

        if (member == null)
            throw new NotFoundException($"Member with ID '{id}' was not found.");

        if (request.Status != MemberStatus.ACTIVE)
        {
            var hasActiveLoans = await _context.Loans
                .AnyAsync(l => l.MemberId == id && (l.Status == LoanStatus.ACTIVE || l.Status == LoanStatus.APPROVED || l.Status == LoanStatus.PENDING_APPROVAL), cancellationToken);

            if (hasActiveLoans)
            {
                throw new DomainException($"Cannot set member '{member.MemberCode}' status to '{request.Status}' because they currently have active or pending loans.");
            }
        }

        member.Status = request.Status;
        member.UpdatedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync(cancellationToken);

        var totalContributions = await _context.Contributions
            .Where(c => c.MemberId == id)
            .SumAsync(c => (decimal?)c.Amount, cancellationToken) ?? 0m;

        var activeLoansCount = await _context.Loans
            .CountAsync(l => l.MemberId == id && (l.Status == LoanStatus.ACTIVE || l.Status == LoanStatus.APPROVED), cancellationToken);

        return new MemberDto(
            member.Id,
            member.MemberCode,
            member.FirstName,
            member.LastName,
            member.Email,
            member.Phone,
            member.Status,
            member.CreatedAt,
            member.UpdatedAt,
            totalContributions,
            activeLoansCount
        );
    }

    public async Task DeleteOrSuspendMemberAsync(Guid id, CancellationToken cancellationToken = default)
    {
        var member = await _context.Members
            .Include(m => m.Loans)
            .Include(m => m.Contributions)
            .FirstOrDefaultAsync(m => m.Id == id, cancellationToken);

        if (member == null)
            throw new NotFoundException($"Member with ID '{id}' was not found.");

        // 1. Restrict if active loans exist
        var hasActiveLoans = member.Loans.Any(l =>
            l.Status == LoanStatus.ACTIVE ||
            l.Status == LoanStatus.APPROVED ||
            l.Status == LoanStatus.PENDING_APPROVAL);

        if (hasActiveLoans)
        {
            throw new DomainException($"Cannot delete or suspend member '{member.MemberCode}' because active or pending loans exist. All loan obligations must be settled first.");
        }

        // 2. If share contributions or loan records exist, soft-delete/suspend
        var hasContributions = member.Contributions.Any();
        var hasPastLoans = member.Loans.Any();

        if (hasContributions || hasPastLoans)
        {
            member.Status = MemberStatus.SUSPENDED;
            member.UpdatedAt = DateTime.UtcNow;
            await _context.SaveChangesAsync(cancellationToken);
            return;
        }

        // 3. Otherwise, if no financial history exists at all, safe to delete record
        _context.Members.Remove(member);
        await _context.SaveChangesAsync(cancellationToken);
    }

    private async Task<string> GenerateMemberCodeAsync(CancellationToken cancellationToken)
    {
        var year = DateTime.UtcNow.Year;
        var prefix = $"MEM-{year}-";

        var existingCodes = await _context.Members
            .AsNoTracking()
            .Where(m => m.MemberCode.StartsWith(prefix))
            .Select(m => m.MemberCode)
            .ToListAsync(cancellationToken);

        int maxSeq = 0;
        foreach (var code in existingCodes)
        {
            var parts = code.Split('-');
            if (parts.Length >= 3 && int.TryParse(parts[2], out var seq))
            {
                if (seq > maxSeq) maxSeq = seq;
            }
        }

        var nextSeq = maxSeq + 1;
        var newCode = $"{prefix}{nextSeq:D3}";

        while (await _context.Members.AnyAsync(m => m.MemberCode == newCode, cancellationToken))
        {
            nextSeq++;
            newCode = $"{prefix}{nextSeq:D3}";
        }

        return newCode;
    }
}
