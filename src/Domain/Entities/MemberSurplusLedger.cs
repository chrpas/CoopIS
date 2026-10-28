using System;

namespace CoopIS.Domain.Entities;

public class MemberSurplusLedger
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid DistributionId { get; set; }
    public Guid MemberId { get; set; }
    public decimal TotalContribution { get; set; }
    public decimal ContributionRatio { get; set; }
    public decimal DividendEarned { get; set; }
    public decimal TotalLoansBorrowed { get; set; }
    public decimal LoanRatio { get; set; }
    public decimal PatronageEarned { get; set; }
    public decimal NetSavingsCredited { get; set; }

    // Navigation properties
    public SurplusDistribution SurplusDistribution { get; set; } = null!;
    public Member Member { get; set; } = null!;
}
