# 📚 CoopIS Knowledge Base & Operations Wiki

Welcome to the official **CoopIS Operations Wiki**. This knowledge base contains complete operational, financial, and architectural guides for all core modules of the **Cooperative Management System**.

---

## 🧭 Table of Contents

| Chapter | Module Route | Summary | Target Audience |
|---|---|---|---|
| [**1. Executive Dashboard**](01-dashboard.md) | `/dashboard` | Solvency KPIs, member portal, live loan queue tracker & quick actions | Board, Auditors, Admin, Members |
| [**2. Member Assembly & Registry**](02-members.md) | `/members` | Member KYC, onboarding directory, profile drawers & status controls | Admin, Membership Committee |
| [**3. Capital Contributions**](03-contributions.md) | `/contributions` | 24-cutoff build-up, 5-day grace periods, late penalties & statement drawers | Cashier, Accountant, Admin |
| [**4. Credit Management & Loans**](04-loans.md) | `/loans` | Loan origination, FIFO priority queue, 7-tier matrix, 14-day grace & repayments | Credit Officers, Treasurers, Admin |
| [**5. General Ledger & Bank Recon**](05-accounting.md) | `/accounting` | Statement of Financial Position, bank accounts, 20% liquid reserve cushion & recon | Bookkeeper, Auditor, Admin |
| [**6. Surplus & Patronage Distribution**](06-distribution.md) | `/distribution` | Statutory surplus partitioning (65/30/5), member dividend & patronage refund formulas | General Assembly, Board, Admin |

---

## 🏛️ System Architecture Principles

1. **Clean Architecture Separation**:
   - `Domain`: Enterprise business rules, entity models, and domain exceptions.
   - `Application`: Use-case services, DTO contracts, and financial calculations.
   - `Infrastructure`: PostgreSQL persistence via EF Core, BCrypt security, and ngrok tunneling.
   - `Api`: ASP.NET Core controllers, rate limiting, and JWT bearer authentication.
   - `Client (Web)`: React 18+ Single Page Application with TypeScript, Tailwind CSS, and Vite.

2. **Zero-Tolerance Financial Invariants**:
   - $\text{Total Assets} \equiv \text{Total Liabilities} + \text{Total Member Equity}$
   - $\text{Reconciliation Variance} = \text{Book Balance} - \text{Depository Statement Balance}$ (Target: $\le \text{₱0.01}$)
   - Cent-balancing on final amortization installments prevents fractional penny drift.

3. **Role-Based Access Control (RBAC)**:
   - **Administrator**: Unrestricted access across all operational, accounting, settings, and distribution modules.
   - **Loan Officer (User)**: Dedicated operational access to Member Directories, Contributions, and Loan Portfolios; accounting and bank reconciliation are strictly restricted.

---

## 🚀 Quick Reference Commands

- **Developer Start Script**:
  ```powershell
  .\dev.ps1
  ```
- **Stop All Dev Processes**:
  ```powershell
  .\stop-dev.ps1
  ```
- **API Swagger Documentation**:
  `http://localhost:5208/swagger`

