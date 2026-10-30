using CoopIS.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace CoopIS.Infrastructure.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options)
    {
    }

    public DbSet<UserAccount> Users => Set<UserAccount>();
    public DbSet<Member> Members => Set<Member>();
    public DbSet<CutoffPeriod> CutoffPeriods => Set<CutoffPeriod>();
    public DbSet<Contribution> Contributions => Set<Contribution>();
    public DbSet<Loan> Loans => Set<Loan>();
    public DbSet<LoanRepayment> LoanRepayments => Set<LoanRepayment>();
    public DbSet<BankReconciliation> BankReconciliations => Set<BankReconciliation>();
    public DbSet<SurplusDistribution> SurplusDistributions => Set<SurplusDistribution>();
    public DbSet<MemberSurplusLedger> MemberSurplusLedgers => Set<MemberSurplusLedger>();
    public DbSet<AppSetting> AppSettings => Set<AppSetting>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // 1. UserAccount
        modelBuilder.Entity<UserAccount>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.Username).IsUnique();
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.Role).HasConversion<string>();
        });

        // 2. Member
        modelBuilder.Entity<Member>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.MemberCode).IsUnique();
            entity.HasIndex(e => e.Email).IsUnique();
            entity.Property(e => e.Status).HasConversion<string>();
        });

        // 3. CutoffPeriod
        modelBuilder.Entity<CutoffPeriod>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.CutoffDate).IsUnique();
        });

        // 4. Contribution
        modelBuilder.Entity<Contribution>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.MemberId, e.CutoffId }).IsUnique();
            entity.Property(e => e.Amount).HasPrecision(14, 2);
            entity.Property(e => e.PaymentChannel).HasConversion<string>();

            entity.HasOne(e => e.Member)
                .WithMany(m => m.Contributions)
                .HasForeignKey(e => e.MemberId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.CutoffPeriod)
                .WithMany(c => c.Contributions)
                .HasForeignKey(e => e.CutoffId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 5. Loan
        modelBuilder.Entity<Loan>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.LoanReference).IsUnique();
            entity.Property(e => e.PrincipalAmount).HasPrecision(14, 2);
            entity.Property(e => e.InterestRate).HasPrecision(5, 4);
            entity.Property(e => e.InterestEarned).HasPrecision(14, 2);
            entity.Property(e => e.ReleasedAmount).HasPrecision(14, 2);
            entity.Property(e => e.CutoffPaymentAmount).HasPrecision(14, 2);
            entity.Property(e => e.Status).HasConversion<string>();

            entity.HasOne(e => e.Member)
                .WithMany(m => m.Loans)
                .HasForeignKey(e => e.MemberId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Approver)
                .WithMany(m => m.ApprovedLoans)
                .HasForeignKey(e => e.ApprovedBy)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 6. LoanRepayment
        modelBuilder.Entity<LoanRepayment>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.LoanId, e.CutoffId }).IsUnique();
            entity.Property(e => e.PrincipalPaid).HasPrecision(14, 2);
            entity.Property(e => e.LatePenaltyPaid).HasPrecision(14, 2);

            entity.HasOne(e => e.Loan)
                .WithMany(l => l.Repayments)
                .HasForeignKey(e => e.LoanId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.CutoffPeriod)
                .WithMany(c => c.LoanRepayments)
                .HasForeignKey(e => e.CutoffId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 7. BankReconciliation
        modelBuilder.Entity<BankReconciliation>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.CashInBank).HasPrecision(14, 2);
            entity.Property(e => e.BankGrossInterest).HasPrecision(14, 2);
            entity.Property(e => e.WithholdingTax).HasPrecision(14, 2);
            entity.Property(e => e.NetBankInterest).HasPrecision(14, 2);
            entity.Property(e => e.ReconciledVariance).HasPrecision(14, 2);

            entity.HasOne(e => e.CutoffPeriod)
                .WithMany(c => c.BankReconciliations)
                .HasForeignKey(e => e.CutoffId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 8. SurplusDistribution
        modelBuilder.Entity<SurplusDistribution>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => e.FiscalYear).IsUnique();
            entity.Property(e => e.TotalInterestIncome).HasPrecision(14, 2);
            entity.Property(e => e.DividendPool).HasPrecision(14, 2);
            entity.Property(e => e.PatronagePool).HasPrecision(14, 2);
            entity.Property(e => e.ManagementPool).HasPrecision(14, 2);
        });

        // 9. MemberSurplusLedger
        modelBuilder.Entity<MemberSurplusLedger>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.HasIndex(e => new { e.DistributionId, e.MemberId }).IsUnique();
            entity.Property(e => e.TotalContribution).HasPrecision(14, 2);
            entity.Property(e => e.ContributionRatio).HasPrecision(10, 8);
            entity.Property(e => e.DividendEarned).HasPrecision(14, 2);
            entity.Property(e => e.TotalLoansBorrowed).HasPrecision(14, 2);
            entity.Property(e => e.LoanRatio).HasPrecision(10, 8);
            entity.Property(e => e.PatronageEarned).HasPrecision(14, 2);
            entity.Property(e => e.NetSavingsCredited).HasPrecision(14, 2);

            entity.HasOne(e => e.SurplusDistribution)
                .WithMany(s => s.MemberLedgers)
                .HasForeignKey(e => e.DistributionId)
                .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(e => e.Member)
                .WithMany(m => m.SurplusLedgers)
                .HasForeignKey(e => e.MemberId)
                .OnDelete(DeleteBehavior.Restrict);
        });

        // 10. AppSetting
        modelBuilder.Entity<AppSetting>(entity =>
        {
            entity.HasKey(e => e.Key);
            entity.Property(e => e.Key).HasMaxLength(128);
        });
    }
}
