using System;

namespace CoopIS.Domain.Entities;

public class LoanRepayment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid LoanId { get; set; }
    public Guid CutoffId { get; set; }
    public decimal PrincipalPaid { get; set; } = 0.00m;
    public decimal LatePenaltyPaid { get; set; } = 0.00m;
    public DateTime? PaymentDate { get; set; }
    public bool IsDelayed { get; set; } = false;
    public string? Notes { get; set; }
    public DateTime RecordedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Loan Loan { get; set; } = null!;
    public CutoffPeriod CutoffPeriod { get; set; } = null!;
}
