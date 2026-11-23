import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCheck,
  CheckCircle2,
  Clock,
  GraduationCap,
  Users,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/supabase';
import { formatTanggalID, formatWaktuID, getStatusTextClass } from '../../lib/format';
import {
  EmployeeAttendance,
  ROLE_LABELS,
  StudentAttendance,
} from '../../types';

interface DashboardData {
  today: string;
  myTodayAttendance: EmployeeAttendance | null;
  myMonthRecords: EmployeeAttendance[];
  totalStudents: number;
  totalUsers: number;
  todayStudentSummary: {
    Hadir: number;
    Izin: number;
    Sakit: number;
    Alpha: number;
    totalRecorded: number;
  };
  todayEmployeeSummary: {
    Hadir: number;
    Izin: number;
    Sakit: number;
    Alpha: number;
    totalRecorded: number;
  };
  recentStudentAttendance: StudentAttendance[];
  recentEmployeeAttendance: EmployeeAttendance[];
}

export default function DashboardView() {
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [clock, setClock] = useState('');

  useEffect(() => {
    const updateClock = () => {
      setClock(
        new Intl.DateTimeFormat('id-ID', {
          timeZone: 'Asia/Jakarta',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        }).format(new Date())
      );
    };
    updateClock();
    const id = setInterval(updateClock, 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<DashboardData>('/api/dashboard')
      .then((res) => {
        if (active) {
          setData(res);
          setError('');
        }
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Gagal memuat dashboard.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const role = profile?.role || 'tenaga_kependidikan';
  const myHadirCount =
    data?.myMonthRecords.filter((r) => r.status === 'Hadir').length ?? 0;

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <p className="text-xs font-semibold text-red-700 mb-1">
            {ROLE_LABELS[role]} · SMK Prima Unggul
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Selamat Datang, {profile?.full_name}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Ringkasan kehadiran hari ini, {data ? formatTanggalID(data.today) : 'Memuat...'}.
          </p>
        </div>

        <div className="flex items-center gap-6 shrink-0 border-t md:border-t-0 pt-4 md:pt-0 border-slate-200">
          <div>
            <p className="text-xs text-slate-500">Waktu Server (WIB)</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900">
              {clock || '--:--:--'}
            </p>
          </div>
          <Link
            to="/app/absensi-karyawan"
            className="inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-700 rounded-lg hover:bg-red-800 transition-colors whitespace-nowrap shrink-0"
          >
            <Clock className="w-4 h-4" />
            Absensi Mandiri
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Strip */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((idx) => (
            <div
              key={idx}
              className="h-28 bg-white border border-slate-200 rounded-xl animate-pulse p-5"
            />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Personal Status Today */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Status Absen Anda Hari Ini</span>
              <CalendarCheck className="w-4 h-4 text-red-700" />
            </div>
            <div className="mt-3">
              {data?.myTodayAttendance ? (
                <div>
                  <p className="text-xl font-bold text-slate-900">
                    {data.myTodayAttendance.status}
                  </p>
                  <p className="text-xs text-slate-500 mt-1 tabular-nums">
                    Masuk {formatWaktuID(data.myTodayAttendance.check_in)} · Pulang{' '}
                    {formatWaktuID(data.myTodayAttendance.check_out)}
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-xl font-bold text-red-700">Belum Absen</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Silakan catat kehadiran hari ini
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Personal Monthly Attendance */}
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
            <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
              <span>Kehadiran Anda Bulan Ini</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-3">
              <p className="text-2xl font-bold text-slate-900 tabular-nums">
                {myHadirCount} Hari
              </p>
              <p className="text-xs text-slate-500 mt-1 tabular-nums">
                Total catatan bulan berjalan: {data?.myMonthRecords.length ?? 0}
              </p>
            </div>
          </div>

          {/* Card 3: Student stats for Guru/Admin OR Quick guideline for Tendik */}
          {(role === 'admin' || role === 'guru') && (
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Absensi Siswa Hari Ini</span>
                <GraduationCap className="w-4 h-4 text-red-700" />
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-slate-900 tabular-nums">
                  {data?.todayStudentSummary.Hadir ?? 0} Hadir
                </p>
                <p className="text-xs text-slate-500 mt-1 tabular-nums">
                  {data?.todayStudentSummary.totalRecorded ?? 0} dari {data?.totalStudents ?? 0}{' '}
                  siswa tercatat
                </p>
              </div>
            </div>
          )}

          {/* Card 4: Admin Users & Employees OR Guru quick action */}
          {role === 'admin' ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Karyawan Hadir Hari Ini</span>
                <Users className="w-4 h-4 text-red-700" />
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-slate-900 tabular-nums">
                  {data?.todayEmployeeSummary.Hadir ?? 0} / {data?.totalUsers ?? 0}
                </p>
                <p className="text-xs text-slate-500 mt-1 tabular-nums">
                  Total akun terdaftar: {data?.totalUsers ?? 0} karyawan
                </p>
              </div>
            </div>
          ) : role === 'guru' ? (
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Total Siswa Terdaftar</span>
                <Users className="w-4 h-4 text-slate-400" />
              </div>
              <div className="mt-3">
                <p className="text-2xl font-bold text-slate-900 tabular-nums">
                  {data?.totalStudents ?? 0} Siswa
                </p>
                <Link
                  to="/app/absensi-siswa"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 hover:underline mt-1"
                >
                  Isi Absensi Siswa <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between sm:col-span-2">
              <div className="text-slate-500 text-xs font-medium">Panduan Tenaga Kependidikan</div>
              <p className="text-sm text-slate-700 mt-2 leading-relaxed">
                Lakukan absen masuk di pagi hari dan absen pulang saat jam kerja berakhir melalui
                menu <strong>Absensi Karyawan</strong>.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Recent Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Personal Recent History */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Riwayat Absensi Anda</h2>
            <Link
              to="/app/absensi-karyawan"
              className="text-xs font-semibold text-red-700 hover:underline whitespace-nowrap"
            >
              Lihat Semua
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-4 py-3">Masuk</th>
                  <th className="px-4 py-3">Pulang</th>
                  <th className="px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {!data || data.myMonthRecords.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-5 py-8 text-center text-slate-500 text-sm">
                      Belum ada catatan absensi pada bulan ini.
                    </td>
                  </tr>
                ) : (
                  data.myMonthRecords.slice(0, 6).map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3 font-medium text-slate-900 tabular-nums whitespace-nowrap">
                        {formatTanggalID(row.tanggal)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 tabular-nums">
                        {formatWaktuID(row.check_in)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-600 tabular-nums">
                        {formatWaktuID(row.check_out)}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-semibold border rounded ${getStatusTextClass(
                            row.status
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Role-specific second table */}
        {(role === 'admin' || role === 'guru') && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-base font-bold text-slate-900">
                {role === 'admin' ? 'Absensi Karyawan Terbaru' : 'Absensi Siswa Terbaru'}
              </h2>
              <Link
                to={role === 'admin' ? '/app/rekap/karyawan' : '/app/rekap/siswa'}
                className="text-xs font-semibold text-red-700 hover:underline whitespace-nowrap"
              >
                Buka Rekap
              </Link>
            </div>
            <div className="overflow-x-auto">
              {role === 'admin' ? (
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3">Nama</th>
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3">Masuk</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {!data || data.recentEmployeeAttendance.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-slate-500 text-sm">
                          Belum ada catatan absensi karyawan.
                        </td>
                      </tr>
                    ) : (
                      data.recentEmployeeAttendance.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/80">
                          <td className="px-5 py-3">
                            <p className="font-medium text-slate-900 truncate max-w-[160px]">
                              {row.profile?.full_name || 'Karyawan'}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                            {formatTanggalID(row.tanggal)}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-slate-600 tabular-nums">
                            {formatWaktuID(row.check_in)}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-block px-2 py-0.5 text-xs font-semibold border rounded ${getStatusTextClass(
                                row.status
                              )}`}
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              ) : (
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                    <tr>
                      <th className="px-5 py-3">Siswa</th>
                      <th className="px-4 py-3">Kelas</th>
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-5 py-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {!data || data.recentStudentAttendance.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-5 py-8 text-center text-slate-500 text-sm">
                          Belum ada catatan absensi siswa.
                        </td>
                      </tr>
                    ) : (
                      data.recentStudentAttendance.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50/80">
                          <td className="px-5 py-3 font-medium text-slate-900 truncate max-w-[160px]">
                            {row.student?.nama || '-'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 whitespace-nowrap">
                            {row.student?.kelas || '-'}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                            {formatTanggalID(row.tanggal)}
                          </td>
                          <td className="px-5 py-3">
                            <span
                              className={`inline-block px-2 py-0.5 text-xs font-semibold border rounded ${getStatusTextClass(
                                row.status
                              )}`}
                            >
                              {row.status}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
