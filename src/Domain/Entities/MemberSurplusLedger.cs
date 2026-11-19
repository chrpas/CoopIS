using System;
using CoopIS.Domain.Enums;

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
    public CarryoverMode CarryoverMode { get; set; } = CarryoverMode.None;
    public bool CarryoverCapital { get; set; } = false;
    public bool CarryoverDividend { get; set; } = false;
    public bool CarryoverPatronage { get; set; } = false;
    public decimal CarriedOverAmount { get; set; } = 0.00m;
    public decimal NetCashPayout { get; set; } = 0.00m;

    // Navigation properties
    public SurplusDistribution SurplusDistribution { get; set; } = null!;
    public Member Member { get; set; } = null!;
}
