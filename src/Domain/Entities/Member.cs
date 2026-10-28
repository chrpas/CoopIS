using System;
using System.Collections.Generic;
using CoopIS.Domain.Enums;

namespace CoopIS.Domain.Entities;

public class Member
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string MemberCode { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? Phone { get; set; }
    public MemberStatus Status { get; set; } = MemberStatus.ACTIVE;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Navigation properties
    public ICollection<Contribution> Contributions { get; set; } = new List<Contribution>();
    public ICollection<Loan> Loans { get; set; } = new List<Loan>();
    public ICollection<Loan> ApprovedLoans { get; set; } = new List<Loan>();
    public ICollection<MemberSurplusLedger> SurplusLedgers { get; set; } = new List<MemberSurplusLedger>();
}
