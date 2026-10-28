import { Landmark, Users, CalendarCheck2, Wallet, HandCoins, Scale, PieChart } from "lucide-react";

export default function Home() {
  const modules = [
    {
      title: "Member Registry",
      desc: "Comprehensive member records, status management, and share capital tracking.",
      icon: Users,
    },
    {
      title: "Semi-Monthly Cutoffs",
      desc: "24 standard fiscal cutoffs (15th & end-of-month) for automated payroll integration.",
      icon: CalendarCheck2,
    },
    {
      title: "Contribution & Savings",
      desc: "Capital build-up, payroll deduction reconciliation, and compound unique cutoff allocations.",
      icon: Wallet,
    },
    {
      title: "Loan Portfolio",
      desc: "Amortization, disbursement tracking, approval workflows, and repayment schedules.",
      icon: HandCoins,
    },
    {
      title: "Bank Reconciliation",
      desc: "Cash in bank auditing, withholding tax tracking, and automated variance analysis.",
      icon: Scale,
    },
    {
      title: "Surplus Distribution",
      desc: "Statutory net interest distribution: 65% Dividend, 30% Patronage, and 5% Management Pool.",
      icon: PieChart,
    },
  ];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900 flex flex-col justify-between">
      <header className="border-b bg-white/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm">
              <Landmark className="h-6 w-6" />
            </div>
            <div>
              <span className="font-bold text-xl tracking-tight text-slate-900">CoopIS</span>
              <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                Foundation Ready
              </span>
            </div>
          </div>
          <div className="text-sm text-slate-500 font-medium">Cooperative Management Platform</div>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 flex-1">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-slate-900 mb-4">
            Next-Gen Financial Architecture for Cooperatives
          </h1>
          <p className="text-lg text-slate-600">
            Engineered with Next.js 14 App Router, TypeScript, Prisma ORM, and PostgreSQL. Strict camelCase database schemas, high-precision financial Decimal (14, 2) arithmetic, and automated cutoff workflows.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {modules.map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.title}
                className="bg-white border border-slate-200/80 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="h-12 w-12 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center mb-4">
                  <Icon className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-2">{m.title}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{m.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      <footer className="border-t bg-white py-6 text-center text-xs text-slate-500">
        Cooperative Management Web Application &bull; Prisma &bull; PostgreSQL &bull; TypeScript &bull; Tailwind CSS
      </footer>
    </main>
  );
}
