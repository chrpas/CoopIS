using System;
using CoopIS.Domain.Enums;

namespace CoopIS.Domain.Entities;

public class Contribution
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid MemberId { get; set; }
    public Guid CutoffId { get; set; }
    public decimal Amount { get; set; }
    public PaymentChannel PaymentChannel { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public Member Member { get; set; } = null!;
    public CutoffPeriod CutoffPeriod { get; set; } = null!;
}
