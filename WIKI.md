# 📖 CoopIS Operations & Financial Reference Wiki

Comprehensive operating manual, financial formula specification, and administrative guide for **CoopIS (Cooperative Management System)** at [https://github.com/chrpas/CoopIS](https://github.com/chrpas/CoopIS).

---

## 📑 Table of Contents
1. [Executive Dashboard & Member Portal (`/dashboard`)](#1-executive-dashboard--member-portal-dashboard)
2. [Member Assembly & Registry (`/members`)](#2-member-assembly--registry-members)
3. [Capital Contributions & Share Build-up (`/contributions`)](#3-capital-contributions--share-build-up-contributions)
4. [Credit Management, Loan Portfolios & FIFO Queue (`/loans`)](#4-credit-management-loan-portfolios--fifo-queue-loans)
5. [General Ledger, Bank Reconciliation & Accounts (`/accounting`)](#5-general-ledger-bank-reconciliation--accounts-accounting)
6. [Statutory Surplus & Patronage Distribution (`/distribution`)](#6-statutory-surplus--patronage-distribution-distribution)

---

## 1. Executive Dashboard & Member Portal (`/dashboard`)

The **Dashboard** adapts based on authenticated user roles:
- **Executive View (Admin & Officers)**: Central solvency indicators, capital build-up vs. release velocity, credit portfolio health, and operational quick actions.
- **Member Self-Service View (Members)**: Personal share capital, active loan balance, next cutoff repayment due, **"Need Financial Assistance? Apply for a Loan"** action panel, and the real-time **Loan Queue Tracker** card.

### Key Metrics
- **Active Members**: Count of verified members in good standing (`Status == 'ACTIVE'`).
- **Total Loan Portfolio**: Cumulative principal value of active, issued, and amortizing credit facilities.
- **Interest Earned**: Recognized upfront interest fees feeding the gross surplus pool.
- **Collected Repayments**: Total cash repayments remitted back into the cooperative treasury.

### Operational Features
- **Visual Analytics**: Interactive area and bar charts tracking monthly member capital accumulation against loan disbursement velocity.
- **Credit Pipeline Status**: Visual breakdown of loans categorized into `ACTIVE`, `APPROVED`, and `PAID`.
- **Quick Action Hub**: Direct shortcuts to onboard members, post cutoff contributions, issue new credit facilities, and reconcile monthly bank statements.

---

## 2. Member Assembly & Registry (`/members`)

The **Member Registry** is the master directory of all cooperative stakeholders.

### Core Data Structure
- **Member Code**: System-generated identifier (e.g. `MEM-2026-001`), immutable and unique.
- **Contact & Profile**: Legal full name, email address, telephone contact, and date joined.
- **Account Status**: `ACTIVE` (Good standing; authorized to borrow and receive dividends) or `INACTIVE` (Dormant or resigned).

### User Experience
- **Contact & Profile Drawer**: Sliding drawer containing detailed contact details, membership history, and direct links to the member's share capital and loan ledgers.
- **Search & Filter Bar**: Instant multi-attribute filtering across Member Code, Name, and Email.
- **Standardized Pagination**: Configurable tables displaying **10, 20, 30, 40, or 50** records per page (defaults to 20).

---

## 3. Capital Contributions & Share Build-up (`/contributions`)

The **Capital Contributions** module tracks member equity across the 24 annual semi-monthly fiscal cutoffs.

### 24 Semi-Monthly Cutoff Calendar
- **Mid-Month Cutoff**: Due on the **15th** of each month (`Jan-15` through `Dec-15`).
- **End-of-Month Cutoff**: Due on the **last day** of each month (`Jan-31` through `Dec-31`).

### Grace Period & Late Penalty Mechanics
- **5-Day Contribution Grace Period**: Remittances made within 5 calendar days of the cutoff date incur no penalty.
- **Late Penalty Imposition**: Remittances submitted on Day 6 onwards incur the statutory **Late Penalty Charge Rate** (e.g., 5%):
  $$\text{Late Penalty} = \text{Contribution Amount} \times \text{Late Penalty Rate \%}$$
- All collected penalties are added to the cooperative gross surplus pool.

### Visual 24-Cutoff Matrix (`MemberDetailsDrawer`)
- 🟢 **Emerald**: Remitted on time.
- 🟡 **Amber**: Remitted within 5-day grace or late with penalty settled.
- 🔴 **Rose**: Missed / Overdue post-grace cutoff without remittance.
- ⚪ **Slate**: Upcoming future cutoff.

### Safeguards
- **Uncontributed Cutoff Filter**: The **Record Contribution** dropdown shows *only* cutoffs where the member has not yet remitted, preventing duplicate payments while allowing retroactive payment of past closed cutoffs.

---

## 4. Credit Management, Loan Portfolios & FIFO Queue (`/loans`)

The **Credit Management** module controls loan origination, interest computation, net disbursement, amortization scheduling, installment collection, delinquency penalties, and the beginning-of-year **FIFO Loan Priority Queue**.

### Mathematical Formulas
1. **Upfront Interest & Net Proceeds**:
   $$\text{Upfront Interest} = \text{Principal} \times \left(\frac{\text{Interest Rate \%}}{100}\right)$$
   $$\text{Net Proceeds Released} = \text{Principal} - \text{Upfront Interest}$$
2. **Semi-Monthly Amortization**:
   $$\text{Installment Principal} = \text{Round}\left(\frac{\text{Principal}}{\text{Cutoffs Count}}, 2\right)$$
   *Note*: The final installment absorbs any fractional cent rounding difference to guarantee 100% exact balance zeroing.
3. **14-Day Loan Grace Period & Late Penalties**:
   - Borrowers have **14 calendar days** post-cutoff before penalties apply.
   - On Day 15 post-cutoff, unpaid balances incur:
     $$\text{Late Penalty} = \text{Unpaid Balance} \times \text{Late Penalty Rate \%}$$

### The 7-Tier Cooperative Loan Matrix
| Tier | Principal Range (₱) | Term | Cutoffs | Amortization / Cutoff | Upfront Int. (5%) |
|---|---|---|---|---|---|
| **Tier 1** | ₱1,000 – ₱5,000 | 2 Months | 4 Cutoffs | $\text{Principal} / 4$ | ₱50 – ₱250 |
| **Tier 2** | ₱5,001 – ₱15,000 | 3 Months | 6 Cutoffs | $\text{Principal} / 6$ | ₱250.05 – ₱750 |
| **Tier 3** | ₱15,001 – ₱25,000 | 4 Months | 8 Cutoffs | $\text{Principal} / 8$ | ₱750.05 – ₱1,250 |
| **Tier 4** | ₱25,001 – ₱35,000 | 5 Months | 10 Cutoffs | $\text{Principal} / 10$ | ₱1,250.05 – ₱1,750 |
| **Tier 5** | ₱35,001 – ₱50,000 | 6 Months | 12 Cutoffs | $\text{Principal} / 12$ | ₱1,750.05 – ₱2,500 |
| **Tier 6** | ₱50,001 – ₱70,000 | 7 Months | 14 Cutoffs | $\text{Principal} / 14$ | ₱2,500.05 – ₱3,500 |
| **Tier 7** | ₱70,001 – ₱80,000 | 8 Months | 16 Cutoffs | $\text{Principal} / 16$ | ₱3,500.05 – ₱4,000 |

### FIFO Loan Priority Queue (`/loans/queue` or tab in `/loans`)
- **Liquidity Safeguard**: Computes aggregate primary bank balances minus a **20% statutory liquid reserve cushion**.
- **Sequential FIFO Order**: Requests are submitted by members or loan officers, assigned an immutable sequential `QueueNumber`, and processed in strict order.
- **Atomic Disbursement & Fund**: Admin verifies available liquid reserves, deducts net cash from the primary `BankAccount`, originates the formal `Loan`, and transitions status to `Disbursed`.
- **Operational Table Filter**: Defaults to **"Active Queue"** (`Queued`, `UnderReview`, `ReadyForFunding`); completed loans automatically clear from the active queue into the **"Disbursed"** history tab upon funding.

### Expandable Portfolio UI
- **Borrower Row**: Summary metrics per borrower (Active Principal, Repayment Progress %, Remaining Balance, Semi-Monthly Due, and Total Late Penalties).
- **Sub-Rows**: Nested table listing all loans (Reference, Principal, Net Release, Progress, Status, and Actions).
- **Amortization Modal**: Full schedule table showing installment amounts, paid amounts, remaining balance, and individual installment **Record Payment** buttons.

### Automated Safeguards
- **Duplicate Payment Protection**: Paid installment rows automatically hide their payment button and are protected on the backend.
- **Schedule-Driven `PAID` Transition**: A loan transitions to `PAID` automatically when all scheduled installments are settled; manual "Mark Paid" buttons are eliminated to prevent premature status changes.
- **Prospective Policy Lock**: Interest rates, grace periods, and late penalty rates are permanently locked at loan origination.

---

## 5. General Ledger, Bank Reconciliation & Accounts (`/accounting`)

The **Accounting & Bank Reconciliation** module maintains the Statement of Financial Position, reconciles physical bank balances against internal book balances, and manages institutional depository accounts. *(Admin Only)*

### Institutional Bank Account Management (`/accounting/bank-accounts`)
- **Depository Directory**: Manage bank accounts (e.g., Land Bank of the Philippines) with account numbers, current balances, and primary account designations.
- **20% Statutory Reserve Cushion**:
  $$\text{Available Liquid Cash} = \text{Primary Bank Balance} - (\text{Primary Bank Balance} \times 0.20)$$
  Protects cooperative liquidity by guaranteeing that credit disbursements cannot exceed available funds after the safety cushion.
- **Reconciliation & Adjustments**: Adjust physical balances to match certified bank slips with audit logging.
- **Security & RBAC**: Restricted strictly to the **Admin** role; attempts by non-admins return `403 Forbidden`.

### Core Equations
1. **Depository True Book Cash Balance**:
   $$\text{Book Balance} = \text{Contributions} + \text{Loan Receipts} + \text{Net Bank Interest} - \text{Loan Disbursements}$$
   Where $\text{Loan Receipts} = \text{Principal Repayments} + \text{Schedule Late Penalties}$.
2. **Reconciliation Variance**:
   $$\text{Variance} = \text{Book Balance} - \text{Actual Depository Statement Cash}$$
   - Variance $\le \text{₱0.01}$: Books in balance (Green `Reconciled` indicator).
   - Variance $> \text{₱0.01}$: Discrepancy highlighted in red alert card.
3. **Balance Sheet Equation**:
   $$\text{Total Assets} \equiv \text{Total Liabilities} + \text{Total Member Equity}$$
   - **Assets**: Cash in Bank + Accounts Receivable (Active Loans).
   - **Liabilities**: Salaries & Honoraria Payable (Management Reserve, default 5%).
   - **Member Equity**: Common Share Capital + Net Retained Surplus (Dividends 65% + Patronage 30%).

### Monthly Bank Reconciliation Workflow
1. Click **+ Post Bank Reconciliation**.
2. Select Cutoff Period (guarded against duplicate reconciliation).
3. Enter official **Statement Date** and **Cash in Bank** (or use the *Use Book Balance* helper).
4. Enter **Gross Bank Interest**; system automatically calculates standard 20% **Withholding Tax** and **Net Bank Interest**.
5. Save entry — cash and interest immediately sync into the Statement of Financial Position.

---

## 6. Statutory Surplus & Patronage Distribution (`/distribution`)

The **Statutory Surplus Distribution** module automates the year-end distribution of net interest earnings to members.

### The Three Statutory Pools
1. **General Dividend Pool (Default 65%)**:
   - Distributed to all members proportional to their cumulative share capital.
   $$\text{Member Dividend} = \left(\frac{\text{Member Total Contribution}}{\text{Grand Total Contributions}}\right) \times \text{Dividend Pool}$$
2. **Patronage Refund Pool (Default 30%)**:
   - Distributed to borrowers proportional to their total borrowing volume during the fiscal year.
   $$\text{Member Patronage} = \left(\frac{\text{Member Loan Volume}}{\text{Grand Total Loan Volume}}\right) \times \text{Patronage Pool}$$
3. **Management & Operational Reserve (Default 5%)**:
   - Retained for administrative operations, staff honoraria, and contingency reserves.

### Anti-Tampering Safeguard
- Changes to distribution pool percentages made during the fiscal year apply strictly to **future fiscal years (`FY + 1`)**, preventing mid-year manipulation of current member earnings.
- When all 24 cutoffs are closed and reconciled, the Administrator clicks **Finalize Distribution**, which permanently credits dividends and patronage to each member's capital account.

---

## 🔗 Quick Links
- Detailed Individual Wiki Chapters: [`/docs/wiki/`](docs/wiki/README.md)
- Development Start Script: `dev.ps1`
- Repository: [https://github.com/chrpas/CoopIS](https://github.com/chrpas/CoopIS)

