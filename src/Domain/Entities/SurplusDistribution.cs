using System;
using System.Collections.Generic;

namespace CoopIS.Domain.Entities;

public class SurplusDistribution
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public int FiscalYear { get; set; }
    public decimal TotalInterestIncome { get; set; }
    public decimal DividendPool { get; set; }
    public decimal PatronagePool { get; set; }
    public decimal ManagementPool { get; set; }
    public bool IsFinalized { get; set; } = false;
    public DateTime? FinalizedAt { get; set; }

    // Navigation properties
    public ICollection<MemberSurplusLedger> MemberLedgers { get; set; } = new List<MemberSurplusLedger>();
}
