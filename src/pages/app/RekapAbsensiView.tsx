import { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { AlertCircle, Download, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../lib/supabase';
import {
  downloadCsv,
  formatTanggalID,
  formatWaktuID,
  getStatusTextClass,
  getTodayJakarta,
} from '../../lib/format';
import {
  ATTENDANCE_STATUSES,
  EmployeeAttendance,
  JURUSAN_LIST,
  ROLE_LABELS,
  StudentAttendance,
} from '../../types';

export default function RekapAbsensiView() {
  const { type } = useParams<{ type: string }>();
  const { profile } = useAuth();

  const reportType: 'karyawan' | 'siswa' = type === 'karyawan' ? 'karyawan' : 'siswa';
  const today = getTodayJakarta();

  const [startDate, setStartDate] = useState(`${today.slice(0, 7)}-01`);
  const [endDate, setEndDate] = useState(today);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [subFilter, setSubFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [empRecords, setEmpRecords] = useState<EmployeeAttendance[]>([]);
  const [studRecords, setStudRecords] = useState<StudentAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchReport = useCallback(async () => {
    if (!profile) return;
    if (profile.role === 'tenaga_kependidikan') return;
    if (reportType === 'karyawan' && profile.role !== 'admin') return;

    setLoading(true);
    try {
      const qs = `startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
      if (reportType === 'karyawan') {
        const res = await apiFetch<{ records: EmployeeAttendance[] }>(
          `/api/rekap/karyawan?${qs}`
        );
        setEmpRecords(res.records);
      } else {
        const res = await apiFetch<{ records: StudentAttendance[] }>(`/api/rekap/siswa?${qs}`);
        setStudRecords(res.records);
      }
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat rekap absensi.');
    } finally {
      setLoading(false);
    }
  }, [profile, reportType, startDate, endDate]);

  useEffect(() => {
    setSubFilter('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
    fetchReport();
  }, [fetchReport]);

  const filteredEmployeeRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return empRecords.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (subFilter !== 'ALL' && r.profile?.role !== subFilter) return false;
      if (q) {
        const nameMatch = r.profile?.full_name?.toLowerCase().includes(q);
        const nipMatch = r.profile?.nip?.toLowerCase().includes(q);
        const emailMatch = r.profile?.email?.toLowerCase().includes(q);
        if (!nameMatch && !nipMatch && !emailMatch) return false;
      }
      return true;
    });
  }, [empRecords, statusFilter, subFilter, searchQuery]);

  const filteredStudentRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return studRecords.filter((r) => {
      if (statusFilter !== 'ALL' && r.status !== statusFilter) return false;
      if (subFilter !== 'ALL' && r.student?.jurusan !== subFilter) return false;
      if (q) {
        const nameMatch = r.student?.nama?.toLowerCase().includes(q);
        const nisMatch = r.student?.nis?.toLowerCase().includes(q);
        const kelasMatch = r.student?.kelas?.toLowerCase().includes(q);
        if (!nameMatch && !nisMatch && !kelasMatch) return false;
      }
      return true;
    });
  }, [studRecords, statusFilter, subFilter, searchQuery]);

  const summary = useMemo(() => {
    const list = reportType === 'karyawan' ? filteredEmployeeRows : filteredStudentRows;
    const total = list.length;
    const hadir = list.filter((r) => r.status === 'Hadir').length;
    const izin = list.filter((r) => r.status === 'Izin').length;
    const sakit = list.filter((r) => r.status === 'Sakit').length;
    const alpha = list.filter((r) => r.status === 'Alpha').length;
    const rate = total > 0 ? Math.round((hadir / total) * 100) : 0;
    return { total, hadir, izin, sakit, alpha, rate };
  }, [reportType, filteredEmployeeRows, filteredStudentRows]);

  if (profile?.role === 'tenaga_kependidikan') {
    return <Navigate to="/app/dashboard" replace />;
  }
  if (reportType === 'karyawan' && profile?.role !== 'admin') {
    return <Navigate to="/app/rekap/siswa" replace />;
  }

  const handleExportCsv = () => {
    if (reportType === 'karyawan') {
      downloadCsv(
        `rekap-absensi-karyawan-${startDate}-${endDate}.csv`,
        ['Tanggal', 'Nama Karyawan', 'NIP', 'Role', 'Jam Masuk', 'Jam Pulang', 'Status', 'Catatan'],
        filteredEmployeeRows.map((r) => [
          r.tanggal,
          r.profile?.full_name || '-',
          r.profile?.nip || '-',
          r.profile?.role ? ROLE_LABELS[r.profile.role] : '-',
          formatWaktuID(r.check_in),
          formatWaktuID(r.check_out),
          r.status,
          r.catatan || '',
        ])
      );
    } else {
      downloadCsv(
        `rekap-absensi-siswa-${startDate}-${endDate}.csv`,
        ['Tanggal', 'NIS', 'Nama Siswa', 'Kelas', 'Jurusan', 'Status', 'Dicatat Oleh', 'Catatan'],
        filteredStudentRows.map((r) => [
          r.tanggal,
          r.student?.nis || '-',
          r.student?.nama || '-',
          r.student?.kelas || '-',
          r.student?.jurusan || '-',
          r.status,
          r.recorder?.full_name || '-',
          r.catatan || '',
        ])
      );
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            {reportType === 'karyawan' ? 'Rekap Absensi Karyawan' : 'Rekap Absensi Siswa'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            {reportType === 'karyawan'
              ? 'Laporan kehadiran seluruh Administrator, Guru, dan Tenaga Kependidikan.'
              : 'Laporan kehadiran seluruh peserta didik SMK Prima Unggul.'}
          </p>
        </div>

        <button
          type="button"
          onClick={handleExportCsv}
          disabled={summary.total === 0}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-700 rounded-lg hover:bg-red-800 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
        >
          <Download className="w-4 h-4" />
          Unduh CSV
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Summary Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 bg-white border border-slate-200 rounded-xl divide-y sm:divide-y-0 sm:divide-x divide-slate-200">
        <div className="p-4">
          <p className="text-xs text-slate-500">Total Catatan</p>
          <p className="text-xl font-bold text-slate-900 tabular-nums mt-1">{summary.total}</p>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500">Hadir</p>
          <p className="text-xl font-bold text-emerald-700 tabular-nums mt-1">{summary.hadir}</p>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500">Izin</p>
          <p className="text-xl font-bold text-amber-700 tabular-nums mt-1">{summary.izin}</p>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500">Sakit</p>
          <p className="text-xl font-bold text-sky-700 tabular-nums mt-1">{summary.sakit}</p>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500">Alpha</p>
          <p className="text-xl font-bold text-red-700 tabular-nums mt-1">{summary.alpha}</p>
        </div>
        <div className="p-4">
          <p className="text-xs text-slate-500">Tingkat Kehadiran</p>
          <p className="text-xl font-bold text-slate-900 tabular-nums mt-1">{summary.rate}%</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Dari Tanggal</label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-700"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Sampai Tanggal</label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-700"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">
            {reportType === 'karyawan' ? 'Role' : 'Jurusan'}
          </label>
          <select
            value={subFilter}
            onChange={(e) => setSubFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-red-700"
          >
            <option value="ALL">
              {reportType === 'karyawan' ? 'Semua Role' : 'Semua Jurusan'}
            </option>
            {reportType === 'karyawan'
              ? (['admin', 'guru', 'tenaga_kependidikan'] as const).map((r) => (
                  <option key={r} value={r}>
                    {ROLE_LABELS[r]}
                  </option>
                ))
              : JURUSAN_LIST.map((j) => (
                  <option key={j.code} value={j.code}>
                    {j.code} — {j.name}
                  </option>
                ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Status</label>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:border-red-700"
          >
            <option value="ALL">Semua Status</option>
            {ATTENDANCE_STATUSES.map((st) => (
              <option key={st} value={st}>
                {st}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Pencarian</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={reportType === 'karyawan' ? 'Nama / NIP...' : 'Nama / NIS / Kelas...'}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:border-red-700"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          {reportType === 'karyawan' ? (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-4 py-3">Nama Karyawan</th>
                  <th className="px-4 py-3">Role</th>
                  <th className="px-4 py-3">Jam Masuk</th>
                  <th className="px-4 py-3">Jam Pulang</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-5 py-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                      Memuat rekap absensi karyawan...
                    </td>
                  </tr>
                ) : filteredEmployeeRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                      Tidak ada catatan absensi karyawan pada rentang filter ini.
                    </td>
                  </tr>
                ) : (
                  filteredEmployeeRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3 font-medium text-slate-900 tabular-nums whitespace-nowrap">
                        {formatTanggalID(row.tanggal)}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-slate-900">
                          {row.profile?.full_name || '-'}
                        </p>
                        <p className="text-xs text-slate-500 font-mono">
                          {row.profile?.nip || row.profile?.email}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                        {row.profile?.role ? ROLE_LABELS[row.profile.role] : '-'}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 tabular-nums">
                        {formatWaktuID(row.check_in)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 tabular-nums">
                        {formatWaktuID(row.check_out)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-semibold border rounded ${getStatusTextClass(
                            row.status
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{row.catatan || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
                <tr>
                  <th className="px-5 py-3">Tanggal</th>
                  <th className="px-4 py-3">NIS</th>
                  <th className="px-4 py-3">Nama Siswa</th>
                  <th className="px-4 py-3">Kelas / Jurusan</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Dicatat Oleh</th>
                  <th className="px-5 py-3">Catatan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                      Memuat rekap absensi siswa...
                    </td>
                  </tr>
                ) : filteredStudentRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-5 py-10 text-center text-slate-500">
                      Tidak ada catatan absensi siswa pada rentang filter ini.
                    </td>
                  </tr>
                ) : (
                  filteredStudentRows.map((row) => (
                    <tr key={row.id} className="hover:bg-slate-50/80">
                      <td className="px-5 py-3 font-medium text-slate-900 tabular-nums whitespace-nowrap">
                        {formatTanggalID(row.tanggal)}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {row.student?.nis || '-'}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {row.student?.nama || '-'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {row.student?.kelas || '-'} ·{' '}
                        <span className="font-mono text-xs">{row.student?.jurusan || '-'}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-block px-2 py-0.5 text-xs font-semibold border rounded ${getStatusTextClass(
                            row.status
                          )}`}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">
                        {row.recorder?.full_name || '—'}
                      </td>
                      <td className="px-5 py-3 text-slate-600">{row.catatan || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
