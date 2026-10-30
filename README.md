# CoopIS - Cooperative Management System

Enterprise-grade Cooperative Financial Management & Lending Platform engineered with **ASP.NET Core Web API (.NET 8 Clean Architecture)** and **React 18+ (Vite + TypeScript + Tailwind CSS)**.

---

## 🌟 Key Features

### 👥 Member Registry (`/members`)
- Comprehensive assembly directory (Member Code, Full Name, Contact Details, Date Joined, Status)
- Share capital and good-standing auditing *(Admin only)*

### 📅 Semi-Monthly Cutoff Tracking
- 24 standard calendar cutoffs (15th and end-of-month: `Jan-15` through `Dec-31`)
- Automated cutoff cycles for payroll deduction reconciliation

### 💼 Loan Portfolio & Credit Management (`/loans`)
- Complete loan origination with upfront interest computation and net proceeds release
- Semi-monthly amortization calculations (`CutoffPaymentAmount = PrincipalAmount / CutoffsCount`)
- Multi-status approval lifecycle: `PENDING_APPROVAL` → `APPROVED` → `ACTIVE` → `PAID`
- Accessible by both **Administrator** and **Loan Officer (User)**

### 💰 Contributions & Capital Build-up (`/contributions`)
- Semi-monthly member share capital tracking via payroll deduction, cash, and bank transfer
- Real-time capital build-up accumulation *(Admin only)*

### ⚖️ Depository Bank Reconciliation (`/accounting`)
- Statements audit reconciling cash in bank, withholding taxes, gross bank interest, and net earnings
- Automated variance detection with zero-tolerance balance flags *(Admin only)*

### 📊 Statutory Surplus & Patronage Distribution (`/distribution`)
- Statutory year-end net surplus partitioning:
  - **65% Dividend Pool**: Credited to member share capital ledgers proportional to contribution ratios.
  - **30% Patronage Refund**: Returned to borrowers proportional to active loan utilization.
  - **5% Management Reserve**: Reserved for institutional development and contingencies.

### 🌐 Secure Remote Access (`/settings/users` -> Remote Access)
- Secure, encrypted **ngrok HTTPS tunnel** allowing authorized operators and officers to manage CoopIS from mobile phones or offsite devices without port forwarding or static public IPs.
- Live tunnel management directly within the UI:
  - Auto-detection of system `ngrok` executable.
  - One-click Start/Stop controls.
  - Copyable public HTTPS URL + Instant mobile scan via QR code.
  - Configurable persistent ngrok Authtoken and optional auto-start on application launch.
  - Admin-only access controls (`[Authorize(Roles = "Admin")]`).

---

## 🏗️ Architecture

CoopIS follows **Clean Architecture** with strict layer separation:

```
Domain ← Application ← Infrastructure ← Api
```

- **`src/Domain`** — Pure domain entities (`UserAccount`, `Member`, `CutoffPeriod`, `Contribution`, `Loan`, `LoanRepayment`, `BankReconciliation`, `SurplusDistribution`, `MemberSurplusLedger`), enums, and domain exceptions. Zero external dependencies.
- **`src/Application`** — DTO contracts, service interfaces (`ITokenService`), password hashing abstraction (`IPasswordHasher`). Depends only on Domain.
- **`src/Infrastructure`** — EF Core `AppDbContext`, Npgsql PostgreSQL provider, fluent precision configurations (`decimal(14, 2)`, `decimal(10, 8)`, `decimal(5, 4)`), `Restrict` delete behaviors, and JWT security token service.
- **`src/Api`** — ASP.NET Core Web API, REST controllers, RFC 7807 global exception middleware, Swagger documentation, and dependency injection composition root.
- **`client/web`** — React 18+ Vite + TypeScript + Tailwind CSS with feature-driven architecture (`features/auth`, `features/dashboard`, `features/loans`, `features/members`, etc.).

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
│   │   ├── Controllers/            # Auth, Members, Loans, Contributions, Accounting, Distribution
│   │   ├── Middleware/             # RFC 7807 Global Exception Handler
│   │   ├── Program.cs              # DI, JWT, CORS, Swagger
│   │   └── appsettings*.json
│   ├── Application/                # Business logic layer
│   │   ├── Common/                 # IPasswordHasher
│   │   ├── DTOs/                   # Request/Response contracts
│   │   └── Services/               # ITokenService
│   ├── Domain/                     # Pure domain layer
│   │   ├── Entities/               # 9 Core cooperative financial entities
│   │   ├── Enums/                  # MemberStatus, LoanStatus, PaymentChannel, UserRole
│   │   └── Exceptions/             # DomainException, NotFoundException, ValidationException
│   └── Infrastructure/             # EF Core, PostgreSQL, JWT security
│       ├── Data/                   # AppDbContext, DbInitializer
│       └── Security/               # JwtTokenService, BcryptPasswordHasher
├── client/
│   └── web/                        # React 18 + Vite + TypeScript frontend
│       └── src/
│           ├── components/         # AppLayout, UI primitives
│           ├── context/            # AuthContext (JWT state management)
│           ├── features/           # Feature-based pages (auth, dashboard, loans, ...)
│           ├── routes/             # ProtectedRoute, AppRoutes
│           ├── services/           # Axios api client with JWT interceptor
│           └── types/              # TypeScript models
├── database/
│   └── scripts/                    # 01_init.sql
├── deploy/
│   └── compose/                    # docker-compose.yml, Dockerfiles, nginx.conf
├── dev.ps1                         # Developer start script (API + Frontend)
├── setup.ps1                       # One-time setup & build script
├── CoopIS.sln                      # Visual Studio Solution
└── README.md
```

Interactive API Documentation: **http://localhost:5208/swagger**
