import React, { useState, useEffect } from "react";
import { Link, useLocation, useNavigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import {
  Landmark,
  LayoutDashboard,
  Users,
  Wallet,
  HandCoins,
  Scale,
  PieChart,
  LogOut,
  ShieldCheck,
  UserCheck,
  ChevronRight,
  Sliders,
  PanelLeftClose,
  PanelLeftOpen,
  Menu,
  X,
} from "lucide-react";

export const AppLayout: React.FC = () => {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem("coopis_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  // Close mobile drawer on route change
  useEffect(() => {
    setIsMobileNavOpen(false);
  }, [location.pathname]);

  const toggleSidebar = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("coopis_sidebar_collapsed", String(next));
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const navItems = [
    {
      label: "Dashboard",
      path: "/dashboard",
      icon: LayoutDashboard,
      adminOnly: true,
    },
    {
      label: "Member Registry",
      path: "/members",
      icon: Users,
      adminOnly: false,
    },
    {
      label: "Contributions",
      path: "/contributions",
      icon: Wallet,
      adminOnly: true,
    },
    {
      label: "Loan Management",
      path: "/loans",
      icon: HandCoins,
      adminOnly: false,
    },
    {
      label: "Bank Reconciliation",
      path: "/accounting",
      icon: Scale,
      adminOnly: true,
    },
    {
      label: "Surplus Distribution",
      path: "/distribution",
      icon: PieChart,
      adminOnly: true,
    },
  ];

  const isAdmin = user?.role === "Admin";
  const isSettingsActive = location.pathname.startsWith("/settings");

  return (
    <div className="h-screen overflow-hidden flex bg-slate-50 text-slate-800">
      {/* Mobile Backdrop Overlay */}
      {isMobileNavOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs md:hidden transition-opacity"
          onClick={() => setIsMobileNavOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Mobile Navigation Drawer */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-72 bg-slate-900 text-white flex flex-col justify-between shadow-2xl transition-transform duration-300 ease-in-out md:hidden ${
          isMobileNavOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        aria-label="Mobile Navigation"
      >
        <div className="flex-1 flex flex-col justify-between min-h-0 overflow-y-auto">
          <div>
            {/* Mobile Header Brand & Close Button */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-bold shadow-md shrink-0">
                  <Landmark className="w-5 h-5 text-white" />
                </div>
                <div className="min-w-0">
                  <div className="font-bold tracking-tight text-white flex items-center gap-2">
                    <span>CoopIS</span>
                    <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                      Clean Arch
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 truncate">Cooperative Platform</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsMobileNavOpen(false)}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                aria-label="Close mobile navigation"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mobile Navigation Links */}
            <div className="px-3 py-4">
              <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                System Modules
              </div>
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  const isRestrictedForUser = !isAdmin && item.adminOnly;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      onClick={() => setIsMobileNavOpen(false)}
                      className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-emerald-600 text-white shadow-sm"
                          : isRestrictedForUser
                          ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                          : "text-slate-300 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? "text-white" : "text-slate-400"
                          }`}
                        />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {isRestrictedForUser && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          Admin
                        </span>
                      )}
                      {isActive && (
                        <ChevronRight className="w-3.5 h-3.5 opacity-80 shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* Mobile Admin Navigation */}
          {isAdmin && (
            <div className="px-3 py-3 border-t border-slate-800/80">
              <div className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                Administration
              </div>
              <Link
                to="/settings/users"
                onClick={() => setIsMobileNavOpen(false)}
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isSettingsActive
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Sliders
                    className={`w-4 h-4 shrink-0 ${
                      isSettingsActive ? "text-white" : "text-slate-400"
                    }`}
                  />
                  <span className="truncate">Settings & Users</span>
                </div>
                {isSettingsActive && (
                  <ChevronRight className="w-3.5 h-3.5 opacity-80 shrink-0" />
                )}
              </Link>
            </div>
          )}
        </div>

        {/* Mobile User Panel & Logout */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-semibold text-xs border border-slate-700 shrink-0">
                {user?.username.slice(0, 2).toUpperCase()}
              </div>
              <div className="overflow-hidden">
                <div className="text-xs font-semibold text-white truncate">{user?.username}</div>
                <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              setIsMobileNavOpen(false);
              handleLogout();
            }}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg transition-colors border border-rose-900/40 cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Desktop Sidebar (hidden on mobile, visible on md+) */}
      <aside
        className={`hidden md:flex ${
          isCollapsed ? "w-20" : "w-64"
        } h-screen overflow-hidden bg-slate-900 text-white flex-col justify-between flex-shrink-0 shadow-xl transition-all duration-300 ease-in-out`}
      >
        <div className="flex-1 flex flex-col justify-between min-h-0">
          <div>
            {/* Logo & Brand + Collapse Toggle */}
            <div
              className={`h-16 flex items-center border-b border-slate-800 ${
                isCollapsed ? "justify-center px-2" : "justify-between px-4"
              }`}
            >
              {!isCollapsed && (
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center text-slate-950 font-bold shadow-md shrink-0">
                    <Landmark className="w-5 h-5 text-white" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold tracking-tight text-white flex items-center gap-2">
                      <span>CoopIS</span>
                      <span className="text-[10px] font-semibold tracking-wider uppercase px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Clean Arch
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate">Cooperative Platform</p>
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={toggleSidebar}
                className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
                title={isCollapsed ? "Expand navigation" : "Minimize navigation"}
                aria-label={isCollapsed ? "Expand navigation" : "Minimize navigation"}
              >
                {isCollapsed ? (
                  <PanelLeftOpen className="w-5 h-5 text-emerald-400" />
                ) : (
                  <PanelLeftClose className="w-4 h-4" />
                )}
              </button>
            </div>

            {/* Navigation */}
            <div className="px-3 py-6">
              {!isCollapsed && (
                <div className="px-3 mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  System Modules
                </div>
              )}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location.pathname === item.path;
                  const isRestrictedForUser = !isAdmin && item.adminOnly;

                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      title={isCollapsed ? item.label : undefined}
                      className={`flex items-center ${
                        isCollapsed ? "justify-center px-2 py-3" : "justify-between px-3.5 py-2.5"
                      } rounded-lg text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-emerald-600 text-white shadow-sm"
                          : isRestrictedForUser
                          ? "text-slate-400 hover:text-slate-200 hover:bg-slate-800/50"
                          : "text-slate-300 hover:text-white hover:bg-slate-800"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? "text-white" : "text-slate-400"
                          }`}
                        />
                        {!isCollapsed && <span className="truncate">{item.label}</span>}
                      </div>
                      {!isCollapsed && isRestrictedForUser && (
                        <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                          Admin
                        </span>
                      )}
                      {!isCollapsed && isActive && (
                        <ChevronRight className="w-3.5 h-3.5 opacity-80 shrink-0" />
                      )}
                    </Link>
                  );
                })}
              </nav>
            </div>
          </div>

          {/* System Administration - Positioned at bottom of nav, above the footer panel */}
          {isAdmin && (
            <div className="px-3 py-3 border-t border-slate-800/80">
              {!isCollapsed && (
                <div className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  Administration
                </div>
              )}
              <Link
                to="/settings/users"
                title={isCollapsed ? "Settings & Users" : undefined}
                className={`flex items-center ${
                  isCollapsed ? "justify-center px-2 py-3" : "justify-between px-3.5 py-2.5"
                } rounded-lg text-sm font-medium transition-colors ${
                  isSettingsActive
                    ? "bg-emerald-600 text-white shadow-sm"
                    : "text-slate-300 hover:text-white hover:bg-slate-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Sliders
                    className={`w-4 h-4 shrink-0 ${
                      isSettingsActive ? "text-white" : "text-slate-400"
                    }`}
                  />
                  {!isCollapsed && <span className="truncate">Settings & Users</span>}
                </div>
                {!isCollapsed && isSettingsActive && (
                  <ChevronRight className="w-3.5 h-3.5 opacity-80 shrink-0" />
                )}
              </Link>
            </div>
          )}
        </div>

        {/* User Badge & Logout in Sidebar Footer (Panel) */}
        <div className="p-4 border-t border-slate-800 bg-slate-950/40">
          <div
            className={`flex items-center ${
              isCollapsed ? "justify-center" : "justify-between"
            } mb-3`}
          >
            <div
              className="flex items-center gap-2.5 min-w-0"
              title={isCollapsed ? `${user?.username} (${user?.email})` : undefined}
            >
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 font-semibold text-xs border border-slate-700 shrink-0">
                {user?.username.slice(0, 2).toUpperCase()}
              </div>
              {!isCollapsed && (
                <div className="overflow-hidden">
                  <div className="text-xs font-semibold text-white truncate">{user?.username}</div>
                  <div className="text-[11px] text-slate-400 truncate">{user?.email}</div>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleLogout}
            title={isCollapsed ? "Sign Out" : undefined}
            className={`w-full flex items-center justify-center gap-2 ${
              isCollapsed ? "p-2.5" : "px-3 py-2"
            } text-xs font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/30 rounded-lg transition-colors border border-rose-900/40 cursor-pointer`}
          >
            <LogOut className="w-3.5 h-3.5 shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 h-screen flex flex-col min-w-0 overflow-y-auto">
        {/* Top Navbar */}
        <header className="h-16 shrink-0 bg-white border-b border-slate-200/80 px-4 sm:px-6 lg:px-8 flex items-center justify-between sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            {/* Hamburger Button for Mobile */}
            <button
              type="button"
              onClick={() => setIsMobileNavOpen(true)}
              className="md:hidden p-2 -ml-1 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors shrink-0 cursor-pointer"
              aria-label="Open mobile navigation"
            >
              <Menu className="w-5 h-5" />
            </button>

            <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
              <span className="hidden sm:inline">Cooperative Financial Management System</span>
              <span className="sm:hidden font-bold">CoopIS</span>
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div
              className={`inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-[11px] sm:text-xs font-semibold ${
                isAdmin
                  ? "bg-emerald-100 text-emerald-800 border border-emerald-300"
                  : "bg-amber-100 text-amber-800 border border-amber-300"
              }`}
            >
              {isAdmin ? (
                <>
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="hidden sm:inline">Role: Administrator</span>
                  <span className="sm:hidden">Admin</span>
                </>
              ) : (
                <>
                  <UserCheck className="w-3.5 h-3.5 text-amber-700" />
                  <span className="hidden sm:inline">Role: Loan Officer</span>
                  <span className="sm:hidden">User</span>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};
