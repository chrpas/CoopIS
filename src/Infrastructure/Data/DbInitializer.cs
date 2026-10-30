using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Reflection;
using System.Text.Json;
using System.Threading.Tasks;
using BCrypt.Net;
using CoopIS.Domain.Entities;
using CoopIS.Domain.Enums;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace CoopIS.Infrastructure.Data;

public static class DbInitializer
{
    private static readonly string[] MonthNames =
    {
        "Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"
    };

    public static async Task InitializeAsync(AppDbContext context, ILogger logger)
    {
        logger.LogInformation("Ensuring database is created and initialized...");
        await context.Database.EnsureCreatedAsync();

        const int fiscalYear = 2026;

        // 1. Seed Accounts (Admin & User) - Settings & User
        if (!await context.Users.AnyAsync())
        {
            logger.LogInformation("Seeding default authentication accounts...");
            var adminUser = new UserAccount
            {
                Username = "admin",
                Email = "admin@coopis.org",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("Admin123!"),
                Role = UserRole.Admin,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            var standardUser = new UserAccount
            {
                Username = "loanuser",
                Email = "loanuser@coopis.org",
                PasswordHash = BCrypt.Net.BCrypt.HashPassword("User123!"),
                Role = UserRole.User,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };

            context.Users.AddRange(adminUser, standardUser);
            await context.SaveChangesAsync();
            logger.LogInformation("Default Admin and Loan User seeded successfully.");
        }

        // 2. Seed 24 Cutoff Periods for 2026
        if (!await context.CutoffPeriods.AnyAsync(c => c.FiscalYear == fiscalYear))
        {
            logger.LogInformation("Seeding 24 semi-monthly cutoff periods for {FiscalYear}...", fiscalYear);
            var cutoffList = new List<CutoffPeriod>();

            for (int m = 0; m < 12; m++)
            {
                string monthName = MonthNames[m];

                // 1st Cutoff: 15th
                var firstDate = new DateTime(fiscalYear, m + 1, 15, 0, 0, 0, DateTimeKind.Utc);
                cutoffList.Add(new CutoffPeriod
                {
                    CutoffDate = firstDate,
                    Label = $"{monthName}-15",
                    FiscalYear = fiscalYear,
                    IsClosed = false,
                    CreatedAt = DateTime.UtcNow
                });

                // 2nd Cutoff: End of month
                int daysInMonth = DateTime.DaysInMonth(fiscalYear, m + 1);
                var secondDate = new DateTime(fiscalYear, m + 1, daysInMonth, 0, 0, 0, DateTimeKind.Utc);
                cutoffList.Add(new CutoffPeriod
                {
                    CutoffDate = secondDate,
                    Label = $"{monthName}-{daysInMonth}",
                    FiscalYear = fiscalYear,
                    IsClosed = false,
                    CreatedAt = DateTime.UtcNow
                });
            }

            context.CutoffPeriods.AddRange(cutoffList);
            await context.SaveChangesAsync();
            logger.LogInformation("Seeded 24 cutoff periods (Jan-15 through Dec-31).");
        }

        // 3. Check if we need to replace data with spreadsheet data
        var existingMemberCount = await context.Members.CountAsync();
        var hasSampleMembers = await context.Members.AnyAsync(m => m.MemberCode == "MEM-OFFICER-001" || m.Email.Contains("coop.example.com"));

        if (hasSampleMembers || existingMemberCount < 28)
        {
            logger.LogInformation("Clearing old sample transactional & member data while preserving Settings & Users...");

            context.MemberSurplusLedgers.RemoveRange(context.MemberSurplusLedgers);
            context.SurplusDistributions.RemoveRange(context.SurplusDistributions);
            context.BankReconciliations.RemoveRange(context.BankReconciliations);
            context.LoanRepayments.RemoveRange(context.LoanRepayments);
            context.Loans.RemoveRange(context.Loans);
            context.Contributions.RemoveRange(context.Contributions);
            context.Members.RemoveRange(context.Members);
            await context.SaveChangesAsync();

            // Load official spreadsheet data from embedded resource or local json
            var seedData = LoadSpreadsheetSeedData(logger);
            if (seedData == null || seedData.Members.Count == 0)
            {
                logger.LogWarning("No seed data found in coop_2026_data.json.");
                return;
            }

            var cutoffPeriods = await context.CutoffPeriods
                .Where(c => c.FiscalYear == fiscalYear)
                .OrderBy(c => c.CutoffDate)
                .ToListAsync();

            // 4. Seed all 28 Members
            logger.LogInformation("Seeding {Count} cooperative members from COOP-2026-3.xlsx...", seedData.Members.Count);
            var memberEntities = new Dictionary<string, Member>(StringComparer.OrdinalIgnoreCase);

            foreach (var sm in seedData.Members)
            {
                var member = new Member
                {
                    Id = Guid.NewGuid(),
                    MemberCode = sm.MemberCode,
                    FirstName = sm.FirstName,
                    LastName = sm.LastName,
                    Email = sm.Email,
                    Phone = sm.Phone,
                    Status = sm.Status == "ACTIVE" ? MemberStatus.ACTIVE : MemberStatus.INACTIVE,
                    CreatedAt = DateTime.UtcNow,
                    UpdatedAt = DateTime.UtcNow
                };

                memberEntities[sm.FullName] = member;
                context.Members.Add(member);
            }
            await context.SaveChangesAsync();

            // 5. Seed Member Contributions across Cutoff Periods
            logger.LogInformation("Seeding semi-monthly contributions from COOP-2026-3.xlsx...");
            var contributionEntities = new List<Contribution>();

            foreach (var sm in seedData.Members)
            {
                if (!memberEntities.TryGetValue(sm.FullName, out var member)) continue;

                foreach (var sc in sm.Contributions)
                {
                    var cutoffIdx = sc.CutoffNumber - 1;
                    if (cutoffIdx >= 0 && cutoffIdx < cutoffPeriods.Count)
                    {
                        var cutoff = cutoffPeriods[cutoffIdx];
                        contributionEntities.Add(new Contribution
                        {
                            Id = Guid.NewGuid(),
                            MemberId = member.Id,
                            CutoffId = cutoff.Id,
                            Amount = sc.Amount,
                            PaymentChannel = PaymentChannel.PAYROLL_DEDUCTION,
                            CreatedAt = cutoff.CutoffDate
                        });
                    }
                }
            }

            context.Contributions.AddRange(contributionEntities);
            await context.SaveChangesAsync();
            logger.LogInformation("Seeded {Count} contribution records successfully (Total: ₱{Sum:N2}).",
                contributionEntities.Count, contributionEntities.Sum(c => c.Amount));

            // 6. Seed All 64 Loans and Installment Repayments
            logger.LogInformation("Seeding {Count} loans and repayment installments from COOP-2026-3.xlsx...", seedData.Loans.Count);
            var adminUser = await context.Users.FirstOrDefaultAsync(u => u.Role == UserRole.Admin);
            var approverId = adminUser?.Id ?? memberEntities.Values.First().Id;

            var loanEntities = new List<Loan>();
            var repaymentEntities = new List<LoanRepayment>();

            foreach (var sl in seedData.Loans)
            {
                if (!memberEntities.TryGetValue(sl.MemberName, out var member))
                {
                    logger.LogWarning("Loan member '{MemberName}' not found in members directory.", sl.MemberName);
                    continue;
                }

                DateTime origDate = DateTime.TryParse(sl.OriginationDate, out var od)
                    ? DateTime.SpecifyKind(od, DateTimeKind.Utc)
                    : new DateTime(fiscalYear, 1, 15, 0, 0, 0, DateTimeKind.Utc);

                var loanStatus = sl.Balance == 0 ? LoanStatus.PAID : LoanStatus.ACTIVE;
                var interestRate = sl.PrincipalAmount > 0
                    ? Math.Round(sl.InterestEarned / sl.PrincipalAmount, 4)
                    : 0.0500m;
                if (interestRate == 0) interestRate = 0.0500m;

                var loan = new Loan
                {
                    Id = Guid.NewGuid(),
                    LoanReference = sl.LoanReference,
                    MemberId = member.Id,
                    OriginationDate = origDate,
                    PrincipalAmount = sl.PrincipalAmount,
                    InterestRate = interestRate,
                    InterestEarned = sl.InterestEarned,
                    ReleasedAmount = sl.ReleasedAmount > 0 ? sl.ReleasedAmount : (sl.PrincipalAmount - sl.InterestEarned),
                    TermMonths = sl.TermMonths > 0 ? sl.TermMonths : 6,
                    CutoffsCount = sl.CutoffsCount > 0 ? sl.CutoffsCount : 12,
                    CutoffPaymentAmount = sl.CutoffPaymentAmount,
                    Status = loanStatus,
                    ApprovedBy = approverId,
                    Notes = !string.IsNullOrWhiteSpace(sl.Notes) ? sl.Notes : "Multi-Purpose Loan",
                    CreatedAt = origDate
                };

                loanEntities.Add(loan);

                // Add installment repayments
                foreach (var sr in sl.Repayments)
                {
                    var cutoffIdx = sr.CutoffNumber - 1;
                    if (cutoffIdx >= 0 && cutoffIdx < cutoffPeriods.Count)
                    {
                        var cutoff = cutoffPeriods[cutoffIdx];
                        repaymentEntities.Add(new LoanRepayment
                        {
                            Id = Guid.NewGuid(),
                            LoanId = loan.Id,
                            CutoffId = cutoff.Id,
                            PrincipalPaid = sr.Amount,
                            LatePenaltyPaid = 0.00m,
                            PaymentDate = cutoff.CutoffDate,
                            IsDelayed = false,
                            RecordedAt = cutoff.CutoffDate
                        });
                    }
                }
            }

            context.Loans.AddRange(loanEntities);
            await context.SaveChangesAsync();

            context.LoanRepayments.AddRange(repaymentEntities);
            await context.SaveChangesAsync();

            logger.LogInformation("Seeded {LoanCount} loans (Disbursed: ₱{Disbursed:N2}) and {RepayCount} repayments (Collected: ₱{Collected:N2}).",
                loanEntities.Count, loanEntities.Sum(l => l.PrincipalAmount), repaymentEntities.Count, repaymentEntities.Sum(r => r.PrincipalPaid));

            // 7. Seed Official Bank Reconciliation matching TOTAL FUND
            var firstCutoff = cutoffPeriods.First();
            context.BankReconciliations.Add(new BankReconciliation
            {
                Id = Guid.NewGuid(),
                CutoffId = firstCutoff.Id,
                StatementDate = new DateTime(fiscalYear, 1, 31, 0, 0, 0, DateTimeKind.Utc),
                CashInBank = 576096.76m,
                BankGrossInterest = 14.92m,
                WithholdingTax = 2.99m,
                NetBankInterest = 11.93m,
                ReconciledVariance = 0.00m,
                Notes = "Official reconciliation baseline matching COOP-2026-3 workbook (Cash: ₱576,096.76).",
                CreatedAt = DateTime.UtcNow
            });

            // 8. Seed Surplus Distribution & Member Ledgers
            var surplusDist = new SurplusDistribution
            {
                Id = Guid.NewGuid(),
                FiscalYear = fiscalYear,
                TotalInterestIncome = 163507.75m,
                DividendPool = 106280.04m, // 65%
                PatronagePool = 49052.32m, // 30%
                ManagementPool = 8175.39m,  // 5%
                IsFinalized = false
            };
            context.SurplusDistributions.Add(surplusDist);
            await context.SaveChangesAsync();

            logger.LogInformation("Cooperative spreadsheet data seeded successfully! All 28 members, contributions, and 64 loans loaded.");
        }
    }

    private static SeedDataRoot? LoadSpreadsheetSeedData(ILogger logger)
    {
        string? jsonContent = null;

        // Try embedded resource first
        try
        {
            var assembly = typeof(DbInitializer).Assembly;
            var resourceName = "CoopIS.Infrastructure.Data.coop_2026_data.json";

            using var stream = assembly.GetManifestResourceStream(resourceName);
            if (stream != null)
            {
                using var reader = new StreamReader(stream);
                jsonContent = reader.ReadToEnd();
                logger.LogInformation("Loaded seed data from embedded resource '{ResourceName}'.", resourceName);
            }
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "Failed loading seed data from embedded resource.");
        }

        // Fallback to file search
        if (string.IsNullOrWhiteSpace(jsonContent))
        {
            var candidates = new[]
            {
                Path.Combine(AppContext.BaseDirectory, "Data", "coop_2026_data.json"),
                Path.Combine(AppContext.BaseDirectory, "coop_2026_data.json"),
                Path.Combine(Directory.GetCurrentDirectory(), "src", "Infrastructure", "Data", "coop_2026_data.json"),
                @"C:\Projects\coopis\src\Infrastructure\Data\coop_2026_data.json"
            };

            foreach (var path in candidates)
            {
                if (File.Exists(path))
                {
                    jsonContent = File.ReadAllText(path);
                    logger.LogInformation("Loaded seed data from file '{Path}'.", path);
                    break;
                }
            }
        }

        if (string.IsNullOrWhiteSpace(jsonContent))
        {
            return null;
        }

        var options = new JsonSerializerOptions
        {
            PropertyNameCaseInsensitive = true
        };

        return JsonSerializer.Deserialize<SeedDataRoot>(jsonContent, options);
    }

    private class SeedDataRoot
    {
        public List<SeedMember> Members { get; set; } = new();
        public List<SeedLoan> Loans { get; set; } = new();
    }

    private class SeedMember
    {
        public string MemberCode { get; set; } = "";
        public string FullName { get; set; } = "";
        public string LastName { get; set; } = "";
        public string FirstName { get; set; } = "";
        public string Email { get; set; } = "";
        public string Phone { get; set; } = "";
        public string Status { get; set; } = "ACTIVE";
        public decimal TotalContribution { get; set; }
        public List<SeedContribution> Contributions { get; set; } = new();
    }

    private class SeedContribution
    {
        public int CutoffNumber { get; set; }
        public decimal Amount { get; set; }
    }

    private class SeedLoan
    {
        public string LoanReference { get; set; } = "";
        public string MemberName { get; set; } = "";
        public string OriginationDate { get; set; } = "";
        public decimal PrincipalAmount { get; set; }
        public decimal InterestEarned { get; set; }
        public decimal ReleasedAmount { get; set; }
        public int TermMonths { get; set; }
        public int CutoffsCount { get; set; }
        public decimal CutoffPaymentAmount { get; set; }
        public decimal Balance { get; set; }
        public decimal TotalPaid { get; set; }
        public decimal OtherInterest { get; set; }
        public string Status { get; set; } = "ACTIVE";
        public string Notes { get; set; } = "";
        public List<SeedRepayment> Repayments { get; set; } = new();
    }

    private class SeedRepayment
    {
        public int CutoffNumber { get; set; }
        public decimal Amount { get; set; }
    }
}
