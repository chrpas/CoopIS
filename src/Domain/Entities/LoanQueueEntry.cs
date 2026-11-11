using System;
using CoopIS.Domain.Enums;

namespace CoopIS.Domain.Entities;

public class LoanQueueEntry
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int QueueNumber { get; set; }
    public Guid MemberId { get; set; }
    public decimal DesiredPrincipal { get; set; }
    public int TermMonths { get; set; }
    public int CutoffsCount { get; set; }
    public decimal EstimatedCutoffPayment { get; set; }
    public string Purpose { get; set; } = string.Empty;
    public LoanQueueStatus Status { get; set; } = LoanQueueStatus.Queued;
    public DateTime RequestedAt { get; set; } = DateTime.UtcNow;
    public DateTime? ReadyAt { get; set; }
    public Guid? CoMakerMemberId { get; set; }
    public Guid? DisbursedLoanId { get; set; }
    public DateTime? DisbursedAt { get; set; }
    public string? AdminNotes { get; set; }

    // Navigation properties
    public Member Member { get; set; } = null!;
    public Member? CoMakerMember { get; set; }
    public Loan? DisbursedLoan { get; set; }
}

