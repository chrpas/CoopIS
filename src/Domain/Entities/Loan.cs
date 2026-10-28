using System;
using System.Collections.Generic;
using CoopIS.Domain.Enums;

namespace CoopIS.Domain.Entities;

public class Loan
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string LoanReference { get; set; } = string.Empty;
    public Guid MemberId { get; set; }
    public DateTime OriginationDate { get; set; }
    public decimal PrincipalAmount { get; set; }
    public decimal InterestRate { get; set; } = 0.0500m;
    public decimal InterestEarned { get; set; }
    public decimal ReleasedAmount { get; set; }
    public int TermMonths { get; set; }
    public int CutoffsCount { get; set; }
    public decimal CutoffPaymentAmount { get; set; }
    public LoanStatus Status { get; set; } = LoanStatus.PENDING_APPROVAL;
    public Guid? ApprovedBy { get; set; }
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Member Member { get; set; } = null!;
    public Member? Approver { get; set; }
    public ICollection<LoanRepayment> Repayments { get; set; } = new List<LoanRepayment>();
}
