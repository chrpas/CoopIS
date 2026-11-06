# 📊 Wiki: Statutory Surplus & Patronage Distribution (`/distribution`)

The **Statutory Surplus & Patronage Distribution** module automates the year-end apportionment of the cooperative's net operating surplus among member share capital dividends, borrower patronage refunds, and statutory management reserves.

---

## 1. Overview & Business Objectives

- **Primary Goal**: Fairly and transparently distribute net interest income back to member stakeholders in strict accordance with cooperative principles and Philippine statutory guidelines.
- **Key Capabilities**: Live distribution simulation, automated member dividend & patronage ratio computation, prospective weight policy enforcement, and permanent year-end distribution finalization.
- **Role Permissions**: Accessible by all authenticated users; only **Administrator** can execute the permanent **Finalize Distribution** action.

---

## 2. The Three Statutory Pools

All distributable interest income generated during the fiscal year (comprising loan upfront interest, schedule late penalties, and net depository bank interest) is partitioned into three dedicated statutory funds:

```
                          [ Total Distributable Surplus: 100% ]
                                           |
         +---------------------------------+---------------------------------+
         |                                 |                                 |
[ General Dividend Pool: 65% ]   [ Patronage Refund Pool: 30% ]   [ Management Reserve: 5% ]
Proportional to Share Capital    Proportional to Loan Volume      Salaries & Institutional Fund
```

1. **General Dividend Pool (Default 65%)**:
   - Credited to member share capital accounts proportional to their cumulative contribution ratio.
   - Rewards members for capitalizing and financing the cooperative.
2. **Patronage Refund Pool (Default 30%)**:
   - Returned to borrowers proportional to the total volume of loans they borrowed during the fiscal year.
   - Embodies the cooperative principle of returning surplus to those whose patronage generated the interest income.
3. **Management & Operational Reserve (Default 5%)**:
   - Transferred to cooperative reserves for administrative development, staff honoraria, and contingencies.

---

## 3. Mathematical Formulas for Member Allocations

For every registered member, the system computes individual allocations using high-precision 8-decimal ratio scaling:

### A. General Dividend Allocation
$$\text{Contribution Ratio} = \frac{\text{Member Total Contribution}}{\text{Grand Total Contributions across all members}}$$
$$\text{Member Dividend} = \text{Round}\Big(\text{Contribution Ratio} \times \text{General Dividend Pool}, 2\Big)$$

### B. Patronage Refund Allocation
$$\text{Loan Volume Ratio} = \frac{\text{Member Total Borrowing Volume in Fiscal Year}}{\text{Grand Total Loans Borrowed in Fiscal Year}}$$
$$\text{Member Patronage} = \text{Round}\Big(\text{Loan Volume Ratio} \times \text{Patronage Refund Pool}, 2\Big)$$

### C. Total Net Credited Surplus
$$\text{Total Surplus Allocated} = \text{Member Dividend} + \text{Member Patronage}$$
$$\text{Total Ending Member Capital} = \text{Member Total Contribution} + \text{Total Surplus Allocated}$$

---

## 4. Anti-Manipulation Safeguard: Prospective Weight Locking

To protect member equity from administrative tampering:
- Distribution weights (`Dividend %`, `Patronage %`, `Management %`) are governed under **Settings > General & Financial Policy**.
- **Prospective Lock Policy**: Any adjustments to distribution weights made during an active fiscal year **take effect only starting the next fiscal year (`FY + 1`)**.
- The current fiscal year remains strictly locked to its established statutory weights, ensuring no mid-year alteration of member profit-sharing rules.

---

## 5. UI Layout & Metric Overview

The top of `/distribution` provides an executive summary of the simulated distribution:
- **Total Distributable Surplus**: Total income pool available.
- **General Dividend Pool (65%)**: Amount allocated to equity holders.
- **Patronage Refund Pool (30%)**: Amount allocated to borrowers.
- **Management Pool (5%)**: Amount reserved for institutional operations.
- **Active Participating Members**: Count of members receiving dividend and/or patronage payouts.

---

## 6. Step-by-Step Operator Procedures

### A. Simulating a Year-End Surplus Distribution
1. Navigate to `/distribution` from the sidebar.
2. Select the target **Fiscal Year** (defaults to current year, e.g., `2026`).
3. The page dynamically pulls all live loan interest, late penalties, bank interest, and member contributions up to that cutoff.
4. Review the breakdown in the **Member Allocation Ledger** table:
   - **Member**: Code and Name.
   - **Total Capital**: Cumulative share capital.
   - **Contribution %**: Member's equity share ratio.
   - **Dividend (₱)**: Allocated share capital dividend.
   - **Loan Volume (₱)**: Cumulative principal borrowed.
   - **Loan %**: Member's borrowing ratio.
   - **Patronage (₱)**: Allocated patronage refund.
   - **Total Surplus (₱)**: Sum of dividend and patronage.
   - **Ending Capital (₱)**: Projected net share capital credited.

### B. Finalizing the Distribution *(Admin Only)*
At the conclusion of the fiscal year after all 24 cutoffs are closed and depository bank reconciliations are verified:

1. Click the green **Finalize Distribution** button in the header.
2. Review the confirmation summary modal detailing total payouts and member counts.
3. Click **Confirm & Lock Distribution**.
4. The system:
   - Permanently freezes the distribution ledger for that fiscal year.
   - Credits the calculated dividend and patronage directly to each member's permanent capital ledger.
   - Marks the fiscal distribution as `FINALIZED` (read-only audit state).

---

## 7. Frequently Asked Questions (FAQ)

**Q: What happens if a member did not borrow any loans during the year?**  
*A*: The member still receives their full **General Dividend** proportional to their share capital. Their Patronage Refund will simply be ₱0.00.

**Q: What happens if a borrower contributed only minimal share capital?**  
*A*: The member receives a dividend matching their contribution ratio, and a larger **Patronage Refund** reflecting their extensive borrowing activity. Both mechanisms incentivize simultaneous capital buildup and credit utilization.
