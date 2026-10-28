using System;

namespace CoopIS.Domain.Entities;

public class BankReconciliation
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid? CutoffId { get; set; }
    public DateTime StatementDate { get; set; }
    public decimal CashInBank { get; set; }
    public decimal BankGrossInterest { get; set; } = 0.00m;
    public decimal WithholdingTax { get; set; } = 0.00m;
    public decimal NetBankInterest { get; set; } = 0.00m;
    public decimal ReconciledVariance { get; set; } = 0.00m;
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public CutoffPeriod? CutoffPeriod { get; set; }
}
