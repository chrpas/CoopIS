using System;
using System.Collections.Generic;

namespace CoopIS.Domain.Entities;

public class CutoffPeriod
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public DateTime CutoffDate { get; set; }
    public string Label { get; set; } = string.Empty;
    public int FiscalYear { get; set; }
    public bool IsClosed { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<Contribution> Contributions { get; set; } = new List<Contribution>();
    public ICollection<LoanRepayment> LoanRepayments { get; set; } = new List<LoanRepayment>();
    public ICollection<BankReconciliation> BankReconciliations { get; set; } = new List<BankReconciliation>();
}
