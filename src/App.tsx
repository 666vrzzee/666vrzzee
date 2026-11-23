import React from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import AppShell from './components/AppShell';
import DashboardView from './pages/app/DashboardView';
import AbsensiKaryawanView from './pages/app/AbsensiKaryawanView';
import AbsensiSiswaView from './pages/app/AbsensiSiswaView';
import RekapAbsensiView from './pages/app/RekapAbsensiView';
import DataSiswaView from './pages/app/DataSiswaView';
import UserManagementView from './pages/app/UserManagementView';
import { UserRole } from './types';

function ProtectedAppRoute({
  children,
  allowedRoles,
}: {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
}) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-sm font-medium text-slate-600">
          <Loader2 className="w-5 h-5 animate-spin text-red-700" />
          Memuat sesi aplikasi...
        </div>
      </div>
    );
  }

  if (!user || !profile) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return <Navigate to="/app/dashboard" replace />;
  }

  return <AppShell>{children}</AppShell>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />

          <Route path="/app" element={<Navigate to="/app/dashboard" replace />} />
          <Route
            path="/app/dashboard"
            element={
              <ProtectedAppRoute>
                <DashboardView />
              </ProtectedAppRoute>
            }
          />
          <Route
            path="/app/absensi-karyawan"
            element={
              <ProtectedAppRoute>
                <AbsensiKaryawanView />
              </ProtectedAppRoute>
            }
          />
          <Route
            path="/app/absensi-siswa"
            element={
              <ProtectedAppRoute allowedRoles={['admin', 'guru']}>
                <AbsensiSiswaView />
              </ProtectedAppRoute>
            }
          />
          <Route
            path="/app/rekap/:type"
            element={
              <ProtectedAppRoute allowedRoles={['admin', 'guru']}>
                <RekapAbsensiView />
              </ProtectedAppRoute>
            }
          />
          <Route
            path="/app/data-siswa"
            element={
              <ProtectedAppRoute allowedRoles={['admin']}>
                <DataSiswaView />
              </ProtectedAppRoute>
            }
          />
          <Route
            path="/app/users"
            element={
              <ProtectedAppRoute allowedRoles={['admin']}>
                <UserManagementView />
              </ProtectedAppRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
