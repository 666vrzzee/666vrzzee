import React, { useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronDown,
  ClipboardCheck,
  FileSpreadsheet,
  GraduationCap,
  LayoutDashboard,
  LogOut,
  Menu,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ROLE_LABELS, UserRole } from '../types';

interface NavSubItem {
  label: string;
  to: string;
  roles: UserRole[];
}

interface NavItem {
  label: string;
  to?: string;
  icon: React.ReactNode;
  roles: UserRole[];
  children?: NavSubItem[];
}

const NAV_ITEMS: NavItem[] = [
  {
    label: 'Dashboard',
    to: '/app/dashboard',
    icon: <LayoutDashboard className="w-4 h-4 shrink-0" />,
    roles: ['admin', 'guru', 'tenaga_kependidikan'],
  },
  {
    label: 'Absensi Karyawan',
    to: '/app/absensi-karyawan',
    icon: <UserCheck className="w-4 h-4 shrink-0" />,
    roles: ['admin', 'guru', 'tenaga_kependidikan'],
  },
  {
    label: 'Absensi Siswa',
    to: '/app/absensi-siswa',
    icon: <ClipboardCheck className="w-4 h-4 shrink-0" />,
    roles: ['admin', 'guru'],
  },
  {
    label: 'Rekap Absensi',
    icon: <FileSpreadsheet className="w-4 h-4 shrink-0" />,
    roles: ['admin', 'guru'],
    children: [
      {
        label: 'Absensi Karyawan',
        to: '/app/rekap/karyawan',
        roles: ['admin'],
      },
      {
        label: 'Absensi Siswa',
        to: '/app/rekap/siswa',
        roles: ['admin', 'guru'],
      },
    ],
  },
  {
    label: 'Data Siswa',
    to: '/app/data-siswa',
    icon: <GraduationCap className="w-4 h-4 shrink-0" />,
    roles: ['admin'],
  },
  {
    label: 'User Management',
    to: '/app/users',
    icon: <Users className="w-4 h-4 shrink-0" />,
    roles: ['admin'],
  },
];

function getBreadcrumbLabel(pathname: string): string {
  if (pathname.includes('/app/absensi-karyawan')) return 'Absensi Karyawan';
  if (pathname.includes('/app/absensi-siswa')) return 'Absensi Siswa';
  if (pathname.includes('/app/rekap/karyawan')) return 'Rekap Absensi / Absensi Karyawan';
  if (pathname.includes('/app/rekap/siswa')) return 'Rekap Absensi / Absensi Siswa';
  if (pathname.includes('/app/data-siswa')) return 'Data Siswa';
  if (pathname.includes('/app/users')) return 'User Management';
  return 'Dashboard';
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { profile, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [rekapExpanded, setRekapExpanded] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  const role: UserRole = profile?.role || 'tenaga_kependidikan';

  const visibleNavItems = NAV_ITEMS.filter((item) => item.roles.includes(role));

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } finally {
      setLoggingOut(false);
    }
  };

  const sidebarContent = (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Brand header */}
      <div className="h-16 px-5 flex items-center justify-between border-b border-slate-200 shrink-0">
        <Link
          to="/app/dashboard"
          className="text-base font-extrabold tracking-tight text-red-700 whitespace-nowrap"
          onClick={() => setMobileMenuOpen(false)}
        >
          SMK Prima Unggul
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
          aria-label="Tutup menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Menu Utama">
        {visibleNavItems.map((item) => {
          if (item.children) {
            const visibleChildren = item.children.filter((c) => c.roles.includes(role));
            if (visibleChildren.length === 0) return null;
            const isChildActive = visibleChildren.some((c) =>
              location.pathname.startsWith(c.to)
            );

            return (
              <div key={item.label} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setRekapExpanded((prev) => !prev)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                    isChildActive
                      ? 'text-red-800 bg-red-50'
                      : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <span className="flex items-center gap-3 whitespace-nowrap">
                    {item.icon}
                    {item.label}
                  </span>
                  <ChevronDown
                    className={`w-4 h-4 transition-transform ${
                      rekapExpanded ? 'rotate-180' : ''
                    }`}
                  />
                </button>
                {rekapExpanded && (
                  <div className="pl-7 space-y-1">
                    {visibleChildren.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        onClick={() => setMobileMenuOpen(false)}
                        className={({ isActive }) =>
                          `block px-3 py-2 text-sm rounded-lg transition-colors whitespace-nowrap ${
                            isActive
                              ? 'bg-red-700 text-white font-semibold'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-medium'
                          }`
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to!}
              onClick={() => setMobileMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 text-sm rounded-lg transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-red-700 text-white font-semibold'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`
              }
            >
              {item.icon}
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Sidebar Bottom Identity */}
      <div className="p-4 border-t border-slate-200 text-xs text-slate-500">
        <p className="font-semibold text-slate-900 truncate">{profile?.full_name}</p>
        <p className="mt-0.5 truncate">
          {ROLE_LABELS[role]}
          {profile?.jabatan ? ` · ${profile.jabatan}` : ''}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:block w-[260px] shrink-0 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setMobileMenuOpen(false)}
          />
          <aside className="relative w-[260px] max-w-[85vw] h-full z-10">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar with Breadcrumb on Left and Logout Button on Top Right */}
        <header className="sticky top-0 z-30 h-16 bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 flex items-center justify-between gap-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-2 text-slate-600 hover:text-slate-900 rounded-lg border border-slate-200"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex items-center gap-2 text-sm min-w-0">
              <span className="hidden sm:inline text-slate-500 whitespace-nowrap">
                Portal Absensi
              </span>
              <span className="hidden sm:inline text-slate-300" aria-hidden="true">
                /
              </span>
              <span className="font-semibold text-slate-900 truncate">
                {getBreadcrumbLabel(location.pathname)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-5 shrink-0">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold text-slate-900 max-w-[180px] truncate">
                {profile?.full_name}
              </span>
              <span className="text-slate-300" aria-hidden="true">
                ·
              </span>
              <span className="text-red-700 font-semibold whitespace-nowrap">
                {ROLE_LABELS[role]}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-red-700 border border-red-200 bg-red-50/60 rounded-lg hover:bg-red-700 hover:text-white hover:border-red-700 transition-colors whitespace-nowrap shrink-0"
            >
              <LogOut className="w-4 h-4" />
              <span>{loggingOut ? 'Keluar...' : 'Logout'}</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
