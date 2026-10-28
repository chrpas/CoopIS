using System;
using System.Collections.Generic;
using System.Linq;
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

        // 1. Seed Accounts (Admin & User)
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
        const int fiscalYear = 2026;
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

        // 3. Seed Sample Members
        if (!await context.Members.AnyAsync())
        {
            logger.LogInformation("Seeding sample cooperative members...");
            var member1 = new Member
            {
                MemberCode = "MEM-2026-001",
                FirstName = "Maria",
                LastName = "Santos",
                Email = "maria.santos@coop.example.com",
                Phone = "+639171234567",
                Status = MemberStatus.ACTIVE,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            var member2 = new Member
            {
                MemberCode = "MEM-2026-002",
                FirstName = "Juan",
                LastName = "Dela Cruz",
                Email = "juan.delacruz@coop.example.com",
                Phone = "+639182345678",
                Status = MemberStatus.ACTIVE,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            var memberApprover = new Member
            {
                MemberCode = "MEM-OFFICER-001",
                FirstName = "Elena",
                LastName = "Ramos",
                Email = "elena.ramos@coop.example.com",
                Phone = "+639193456789",
                Status = MemberStatus.ACTIVE,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            context.Members.AddRange(member1, member2, memberApprover);
            await context.SaveChangesAsync();

            // 4. Seed Baseline Transactions
            var firstCutoff = await context.CutoffPeriods.OrderBy(c => c.CutoffDate).FirstAsync();

            context.Contributions.AddRange(
                new Contribution
                {
                    MemberId = member1.Id,
                    CutoffId = firstCutoff.Id,
                    Amount = 2500.00m,
                    PaymentChannel = PaymentChannel.PAYROLL_DEDUCTION,
                    CreatedAt = DateTime.UtcNow
                },
                new Contribution
                {
                    MemberId = member2.Id,
                    CutoffId = firstCutoff.Id,
                    Amount = 1500.00m,
                    PaymentChannel = PaymentChannel.PAYROLL_DEDUCTION,
                    CreatedAt = DateTime.UtcNow
                }
            );

            var sampleLoan = new Loan
            {
                LoanReference = "LN-2026-001",
                MemberId = member1.Id,
                OriginationDate = new DateTime(fiscalYear, 1, 15, 0, 0, 0, DateTimeKind.Utc),
                PrincipalAmount = 50000.00m,
                InterestRate = 0.0500m,
                InterestEarned = 2500.00m,
                ReleasedAmount = 47500.00m,
                TermMonths = 6,
                CutoffsCount = 12,
                CutoffPaymentAmount = 4375.00m,
                Status = LoanStatus.ACTIVE,
                ApprovedBy = memberApprover.Id,
                Notes = "Standard Multi-Purpose Loan approved for educational assistance.",
                CreatedAt = DateTime.UtcNow
            };

            context.Loans.Add(sampleLoan);
            await context.SaveChangesAsync();

            context.LoanRepayments.Add(new LoanRepayment
            {
                LoanId = sampleLoan.Id,
                CutoffId = firstCutoff.Id,
                PrincipalPaid = 4375.00m,
                LatePenaltyPaid = 0.00m,
                RecordedAt = DateTime.UtcNow
            });

            context.BankReconciliations.Add(new BankReconciliation
            {
                CutoffId = firstCutoff.Id,
                StatementDate = new DateTime(fiscalYear, 1, 15, 0, 0, 0, DateTimeKind.Utc),
                CashInBank = 1250000.00m,
                BankGrossInterest = 1250.00m,
                WithholdingTax = 250.00m,
                NetBankInterest = 1000.00m,
                ReconciledVariance = 0.00m,
                Notes = "Opening fiscal cycle reconciliation completed without variance.",
                CreatedAt = DateTime.UtcNow
            });

            var surplusDist = new SurplusDistribution
            {
                FiscalYear = fiscalYear,
                TotalInterestIncome = 100000.00m,
                DividendPool = 65000.00m,
                PatronagePool = 30000.00m,
                ManagementPool = 5000.00m,
                IsFinalized = false
            };
            context.SurplusDistributions.Add(surplusDist);
            await context.SaveChangesAsync();

            context.MemberSurplusLedgers.Add(new MemberSurplusLedger
            {
                DistributionId = surplusDist.Id,
                MemberId = member1.Id,
                TotalContribution = 60000.00m,
                ContributionRatio = 0.60000000m,
                DividendEarned = 39000.00m,
                TotalLoansBorrowed = 50000.00m,
                LoanRatio = 1.00000000m,
                PatronageEarned = 30000.00m,
                NetSavingsCredited = 69000.00m
            });

            await context.SaveChangesAsync();
            logger.LogInformation("Sample transactions and surplus ledgers initialized successfully.");
        }
    }
}
