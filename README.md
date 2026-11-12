# CoopIS - Cooperative Management System

Enterprise-grade Cooperative Financial Management & Lending Platform engineered with **ASP.NET Core Web API (.NET 8 Clean Architecture)** and **React 18+ (Vite + TypeScript + Tailwind CSS)**.

---

## 📖 Official Operations Wiki & Knowledge Base

For complete operational walkthroughs, mathematical formulas, role permissions, and accounting principles across all functional modules, see:
- 📑 [**CoopIS Operations & Financial Reference Wiki (`WIKI.md`)**](WIKI.md)
- 📚 [**Modular Wiki Documentation Hub (`/docs/wiki/`)**](docs/wiki/README.md)
  - [Chapter 1: Executive Dashboard (`/dashboard`)](docs/wiki/01-dashboard.md)
  - [Chapter 2: Member Assembly & Registry (`/members`)](docs/wiki/02-members.md)
  - [Chapter 3: Capital Contributions & Share Build-up (`/contributions`)](docs/wiki/03-contributions.md)
  - [Chapter 4: Credit Management & Loan Portfolios (`/loans`)](docs/wiki/04-loans.md)
  - [Chapter 5: General Ledger & Depository Bank Reconciliation (`/accounting`)](docs/wiki/05-accounting.md)
  - [Chapter 6: Statutory Surplus & Patronage Distribution (`/distribution`)](docs/wiki/06-distribution.md)

---

## 🌟 Key Features

### 🧭 Navigation & Table UX
- **Collapsible Non-Scrollable Sidebar**: Fixed-height (`h-screen overflow-hidden`) left navigation menu that collapses sideways into a compact icon-only rail (`w-20`) with hover tooltips.
- **Standardized Table Pagination**: Every table across the platform defaults to **20 rows per page** with a selector for **10, 20, 30, 40, or 50** rows per page via the shared `TablePagination` component.

### 👥 Member Registry (`/members`)
- Comprehensive assembly directory (Member Code, Full Name, Contact Details, Date Joined, Status).
- Dedicated **Contact & Account Profile Drawer** (`mode="profile"`) for viewing member contact details and administrative account status controls *(Admin only)*.

### 📅 Semi-Monthly Cutoff Tracking & Schedule Generator (`/settings/users` → General & Financial Policy)
- 24 standard semi-monthly calendar cutoffs (15th and end-of-month: `Jan-15` through `Dec-31`).
- **Reusable Fiscal Year Schedule Generator** located in **Site Settings**, allowing administrators to generate or inspect 24-cutoff schedules for any target fiscal year.

### 💼 Loan Portfolio & Credit Management (`/loans`)
- **FIFO Loan Priority Queue System (`/loans/queue` or tab in `/loans`)**:
  - Transparent First-In, First-Out queue addressing early-year liquidity constraints where loan demands exceed immediate cash balances.
  - **7-Tier Progressive Loan Matrix**: Configured across amounts from ₱1,000 to ₱80,000 (2 to 8 months; 4 to 16 cutoffs) with standardized 5% upfront interest deduction.
  - **Available Liquidity Verification**: Live liquidity banner computing unallocated primary bank reserves minus a 20% statutory cushion before approving release.
  - **Atomic Disbursal & Funding**: Deducts principal from the primary institutional bank account, generates a formal amortized loan with semi-monthly schedules, and transitions queue status to `Disbursed`.
  - **Active Operational Filter**: Defaults to `Active Queue` (`Queued`, `UnderReview`, `ReadyForFunding`); funded loans automatically clear upon disbursement into the permanent `Disbursed` audit archive.
- **Member Self-Service Queue Tracker (`/dashboard`)**:
  - Dedicated **Need Financial Assistance? Apply for a Loan** application action on the member portal.
  - Real-time **Loan Queue Tracker Card** displaying current queue position (e.g., `Position #1 · Next in line for bank fund release` or `X ahead in line`), estimated funding cutoff, and live status badge.
- **Expandable Distinct Borrower Rows**:
  - Displays one distinct row per borrower (with filter toggles for **Borrowers with Active Loans** vs. **All Borrowers**).
  - Summarizes borrower-level metrics: **Loan Accounts Badge** (Active / Paid), **Active Principal**, **Repayment Progress**, **Total Active Balance**, **Semi-Monthly Due**, and **Total Late Penalties** (computed across all schedule entries of all loans).
- **Nested Loan Portfolio Sub-Rows**:
  - Expanding a borrower row reveals their complete loan portfolio (Active, Pending Approval, Approved, and Paid loans) with columns for **Reference**, **Principal**, **Upfront Int.**, **Net Release**, **Amortizations**, **Remaining Bal.**, **Late Penalties**, **Status**, and **Actions**.
- **Unified Payment History & Amortization Schedule Modal**:
  - Clicking **Payment History** on any loan opens the `AmortizationScheduleModal` with a **Refresh Books** action in the header.
  - **Live Summary Metrics**: Real-time cards displaying **Total Principal**, **Remaining Balance** (with percentage repaid & progress bar), and **Total Late Penalties** (`paid + accrued` breakdown).
  - **Installment Amortization Table**: Tracks every scheduled cutoff with installment #, cutoff label & date, scheduled amount (2-decimal cent precision), paid amount, remaining balance, late penalty, and status badges (`Paid`, `Overdue`, `Upcoming`).
  - **Duplicate-Payment Safeguard**: Once a schedule installment is `Paid`, its **Record Payment** button is automatically removed (and guarded on the backend) to prevent accidental duplicate entries.
- **Automatic Schedule-Driven `PAID` Transition**:
  - Removed the manual `Mark Paid` button to prevent accidental clicks.
  - A loan is considered **`PAID`** if and only if **all** of its scheduled cutoff installments are paid in full; if any scheduled cutoff date remains unpaid, the loan status stays **`ACTIVE`**.
- **14-Day Loan Grace Period & Prospective Policy Lock**:
  - **Loan Grace Period**: **14 calendar days** post-cutoff due date (`cutoffDate + 14 days`) before the **Late Penalty Charge Rate** is imposed on unpaid installment balances.
  - **Prospective Rate Locking**: Each loan locks in the interest rate, grace period, and late penalty charge rate effective at the time of its origination.
- Accessible by both **Administrator** and **Loan Officer (User)**.

### 💰 Contributions & Capital Build-up (`/contributions`)
- **Uncontributed Cutoff Period Dropdown in `[Record Contribution]`**:
  - Inside the **Record Contribution** modal, an **Assign to Cutoff Period** dropdown dynamically lists **only** the cutoff periods where the selected member has not contributed yet.
  - Supports recording late remittances for **already-closed cutoff periods** where a member was unable to contribute prior to cutoff lock, while protecting already-contributed records on closed cutoffs.
- **Share Capital Statement & 24-Cutoff Indicator Drawer (`MemberDetailsDrawer`)**:
  - **Visual 24-Cutoff Period Contribution Indicator Grid (`C01`–`C24`)**: Color-coded grid showing at a glance which cutoff periods the member has **Contributed** (emerald), **Contributed Late / In Grace Window** (amber), **Delayed / Overdue** (rose), or **Upcoming** (slate).
  - **5-Day Contribution Grace Period & Late Penalty Assessment**: Members have **5 calendar days** after each cutoff date before the shared **Late Penalty Charge Rate** (same rate as loans) is imposed on delayed contributions.
  - Includes filter tabs (`All`, `Contributed`, `Delayed / Penalty`) and a **Late Penalties** summary card.

### ⚖️ Depository Bank Reconciliation & Accounts (`/accounting`)
- **Institutional Bank Account Management (`/accounting/bank-accounts`)**:
  - Depository accounts directory (Bank Name, Account Number, Account Name, Balance, Primary status, Last Reconciled At).
  - **20% Statutory Reserve Cushion**: Enforces a non-negotiable 20% liquid reserve cushion on primary accounts, safeguarding liquidity prior to loan disbursement releases.
  - Action modals for registering new bank accounts and audit-reconciling physical balances with reason logging.
  - Strict RBAC: **Admin Only** via `[Authorize(Roles = "Admin")]`; hidden from sidebar for `User` and `Member` roles.
- **Monthly Bank Statement Reconciliation**:
  - Statements audit reconciling physical cash in bank, withholding taxes, gross bank interest, and net earnings.
  - Automated variance detection with zero-tolerance balance flags *(Admin only)*.

### 📊 Statutory Surplus & Patronage Distribution (`/distribution`)
- Statutory year-end net surplus partitioning:
  - **General Dividend Pool** (default **65%**): Credited to member share capital ledgers proportional to contribution ratios.
  - **Patronage Refund Pool** (default **30%**): Returned to borrowers proportional to loan utilization.
  - **Management Reserve** (default **5%**): Reserved for institutional development and contingencies.

### ⚙️ Site Settings: General & Financial Policy (`/settings/users`)
- **Inflation-Ready Loan & Penalty Policies (Prospective Only)**:
  - Configurable **Loan Cutoff Grace Period** (default `14` days), **Contribution Cutoff Grace Period** (default `5` days), **Late Penalty Charge Rate** (`%`), and **Standard Loan Interest Rate** (`% Flat`).
  - Updates apply strictly to **future loans and future penalties**; existing loans and prior penalties remain locked at their historical rates.
- **Future Fiscal Year Surplus Distribution Weights**:
  - Configurable weights for **General Dividend**, **Patronage Refund**, and **Management Reserve** (must sum to `100%`).
  - Any weight adjustments made during an active fiscal year take effect only starting the **next non-current fiscal year (`FY + 1`)**, preventing mid-year manipulation of the current year's surplus distribution.
- **Secure Remote Access (ngrok HTTPS Tunnel)**:
  - Live tunnel management directly within the UI with one-click Start/Stop controls, copyable public HTTPS URL, QR code scanner for mobile devices, and persistent authtoken configuration *(Admin only)*.

---

## 🏗️ Architecture

CoopIS follows **Clean Architecture** with strict layer separation:

```
Domain ← Application ← Infrastructure ← Api
```

- **`src/Domain`** — Pure domain entities (`UserAccount`, `Member`, `CutoffPeriod`, `Contribution`, `Loan`, `LoanRepayment`, `BankAccount`, `LoanQueueEntry`, `BankReconciliation`, `SurplusDistribution`, `MemberSurplusLedger`, `AppSetting`), enums (`LoanQueueStatus`, `MemberStatus`, `PaymentChannel`), and domain exceptions. Zero external dependencies.
- **`src/Application`** — DTO contracts, service interfaces (`ITokenService`, `IFinancialPolicyService`, `IMemberService`, `IContributionService`, `IAccountingService`, `IDistributionService`, `IBankAccountService`, `ILoanQueueService`), password hashing abstraction (`IPasswordHasher`). Depends only on Domain.
- **`src/Infrastructure`** — EF Core `AppDbContext`, Npgsql PostgreSQL & SQLite providers, fluent precision configurations (`decimal(14, 2)`, `decimal(10, 8)`, `decimal(5, 4)`), `Restrict` delete behaviors, financial policy snapshot persistence (`FinancialPolicyService`), bank reserve cushion computation (`BankAccountService`), FIFO queue transaction processing (`LoanQueueService`), and JWT security token service.
- **`src/Api`** — ASP.NET Core Web API, REST controllers (`Auth`, `Members`, `Loans`, `LoanQueue`, `BankAccounts`, `Contributions`, `CutoffPeriods`, `Accounting`, `Distribution`, `FinancialPolicy`, `Users`, `Ngrok`), RFC 7807 global exception middleware, Swagger documentation, and dependency injection composition root.
- **`client/web`** — React 18+ Vite + TypeScript + Tailwind CSS with feature-driven architecture (`features/auth`, `features/dashboard`, `features/loans`, `features/members`, `features/contributions`, `features/accounting`, `features/distribution`, `features/settings`) and reusable UI primitives (`TablePagination`, `AppLayout`, `Toast`, `LoanQueueTrackerCard`, `MemberLoanApplicationModal`, `LoanQueueWorkspace`, `BankAccountsPage`).

---

## 🚀 Quick Start (Development)

### One-Command Start:
```powershell
.\dev.ps1
```
This script will:
1. Start the .NET Web API at `http://localhost:5208`
2. Start the Vite React client at `http://localhost:5173`
3. Launch your default browser directly to the CoopIS portal.

### Demo Credentials

| Role | Username | Password | Default Landing | Permitted Access |
|---|---|---|---|---|
| **Administrator** | `admin` | `Admin123!` | `/dashboard` | Full system access across all 6 modules |
| **Loan Officer** | `loanuser` | `User123!` | `/loans` | Loan portfolio management only (403 on other modules) |

### 🌐 Enabling Remote Access (ngrok)

1. Log in as **Administrator** (`admin` / `Admin123!`).
2. Navigate to **Settings & Users** (`/settings/users`) and select the **Remote Access (ngrok)** tab.
3. Paste your free **ngrok Authtoken** (from [dashboard.ngrok.com](https://dashboard.ngrok.com/get-started/your-authtoken)) and click **Save Configuration**.
4. Click **Start Remote Access**. The application will launch an encrypted tunnel and display your live public URL (e.g. `https://xxxx-xx-xx-xx.ngrok-free.app`).
5. Click **Scan with Phone** to open a QR code for mobile testing, or copy and share the link with authorized personnel.

---

## 📁 Project Structure

```
coopis/
├── src/
│   ├── Api/                        # ASP.NET Core Web API
│   │   ├── Controllers/            # Auth, Members, Loans, Contributions, CutoffPeriods, Accounting, Distribution, FinancialPolicy, Users, Ngrok
│   │   ├── Middleware/             # RFC 7807 Global Exception Handler
│   │   ├── Program.cs              # DI, JWT, CORS, Swagger
│   │   └── appsettings*.json
│   ├── Application/                # Business logic layer
│   │   ├── Common/                 # IPasswordHasher
│   │   ├── DTOs/                   # Request/Response contracts (incl. FinancialPolicyDtos)
│   │   └── Services/               # ITokenService, IFinancialPolicyService, etc.
│   ├── Domain/                     # Pure domain layer
│   │   ├── Entities/               # Core cooperative financial & settings entities
│   │   ├── Enums/                  # MemberStatus, LoanStatus, PaymentChannel, UserRole
│   │   └── Exceptions/             # DomainException, NotFoundException, ValidationException
│   └── Infrastructure/             # EF Core, PostgreSQL, JWT security
│       ├── Data/                   # AppDbContext, DbInitializer, coop_2026_data.json
│       ├── Services/               # FinancialPolicyService, ContributionService, DistributionService, etc.
│       └── Security/               # JwtTokenService, BcryptPasswordHasher
├── client/
│   └── web/                        # React 18 + Vite + TypeScript frontend
│       └── src/
│           ├── components/         # Collapsible AppLayout, TablePagination, UI primitives
│           ├── context/            # AuthContext (JWT state management)
│           ├── features/           # Feature-based pages (auth, dashboard, loans, members, contributions, accounting, distribution, settings)
│           ├── routes/             # ProtectedRoute, AppRoutes
│           ├── services/           # Axios api client with JWT interceptor
│           └── types/              # TypeScript models
├── database/
│   └── scripts/                    # 01_init.sql
├── deploy/
│   └── compose/                    # docker-compose.yml, Dockerfiles, nginx.conf
├── run-local.bat                   # One-click local launcher (PostgreSQL + API + Vite)
├── dev.ps1                         # Developer start script (Postgres check + API + Frontend)
├── stop-dev.ps1                    # Developer stop script (terminates API & Frontend processes)
├── setup.ps1                       # One-time setup & build script
├── CoopIS.sln                      # Visual Studio Solution
└── README.md
```

Interactive API Documentation: **http://localhost:5208/swagger**
