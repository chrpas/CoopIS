namespace CoopIS.Domain.Enums;

public enum MemberStatus
{
    ACTIVE,
    INACTIVE,
    SUSPENDED
}

public enum LoanStatus
{
    PENDING_APPROVAL,
    APPROVED,
    ACTIVE,
    PAID,
    DEFAULTED
}

public enum PaymentChannel
{
    PAYROLL_DEDUCTION,
    CASH,
    BANK_TRANSFER
}

public enum UserRole
{
    Admin,
    User
}
