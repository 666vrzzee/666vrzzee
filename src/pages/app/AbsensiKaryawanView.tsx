import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  LogIn,
  LogOut,
} from 'lucide-react';
import { apiFetch } from '../../lib/supabase';
import {
  formatTanggalID,
  formatWaktuID,
  getStatusTextClass,
  getTodayJakarta,
} from '../../lib/format';
import { EmployeeAttendance } from '../../types';

export default function AbsensiKaryawanView() {
  const todayDefault = getTodayJakarta();
  const [selectedMonth, setSelectedMonth] = useState(todayDefault.slice(0, 7));
  const [todayDate, setTodayDate] = useState(todayDefault);
  const [todayRecord, setTodayRecord] = useState<EmployeeAttendance | null>(null);
  const [history, setHistory] = useState<EmployeeAttendance[]>([]);

  const [statusChoice, setStatusChoice] = useState<'Hadir' | 'Izin' | 'Sakit'>('Hadir');
  const [catatan, setCatatan] = useState('');

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<{
        today: string;
        todayRecord: EmployeeAttendance | null;
        history: EmployeeAttendance[];
      }>(`/api/attendance/employee/me?month=${encodeURIComponent(selectedMonth)}`);
      setTodayDate(res.today);
      setTodayRecord(res.todayRecord);
      setHistory(res.history);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data absensi karyawan.');
    } finally {
      setLoading(false);
    }
  }, [selectedMonth]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handleCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setFeedback('');

    try {
      await apiFetch('/api/attendance/employee/check-in', {
        method: 'POST',
        body: JSON.stringify({ status: statusChoice, catatan }),
      });
      setCatatan('');
      setFeedback(
        statusChoice === 'Hadir'
          ? 'Absen masuk berhasil dicatat.'
          : `Pengajuan ${statusChoice} berhasil disimpan.`
      );
      await fetchAttendance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan absensi.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCheckOut = async () => {
    setSubmitting(true);
    setError('');
    setFeedback('');

    try {
      await apiFetch('/api/attendance/employee/check-out', {
        method: 'POST',
      });
      setFeedback('Absen pulang berhasil dicatat.');
      await fetchAttendance();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mencatat absen pulang.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Absensi Karyawan</h1>
        <p className="text-sm text-slate-600 mt-1">
          Catat kehadiran mandiri harian Anda (Administrator, Guru, dan Tenaga Kependidikan).
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-xl border border-red-200 bg-red-50 text-red-800 text-sm flex items-start gap-2.5">
          <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm flex items-start gap-2.5">
          <CheckCircle2 className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Today's Self Attendance Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-5 border-b border-slate-200">
          <div>
            <p className="text-xs font-semibold text-red-700">Presensi Harian</p>
            <h2 className="text-lg font-bold text-slate-900 mt-0.5">
              Tanggal: {formatTanggalID(todayDate)}
            </h2>
          </div>
          {todayRecord && (
            <span
              className={`inline-block px-3 py-1 text-xs font-semibold border rounded ${getStatusTextClass(
                todayRecord.status
              )}`}
            >
              Status: {todayRecord.status}
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-10 flex items-center justify-center text-slate-500 text-sm gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Memuat status absensi hari ini...
          </div>
        ) : !todayRecord ? (
          <form onSubmit={handleCheckIn} className="pt-5 space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-2">
                Pilih Status Kehadiran
              </label>
              <div className="inline-flex p-1 bg-slate-100 rounded-lg gap-1">
                {(['Hadir', 'Izin', 'Sakit'] as const).map((st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setStatusChoice(st)}
                    className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors whitespace-nowrap ${
                      statusChoice === st
                        ? 'bg-red-700 text-white'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Catatan {statusChoice === 'Hadir' ? '(Opsional)' : '(Alasan Izin / Sakit)'}
              </label>
              <input
                type="text"
                value={catatan}
                onChange={(e) => setCatatan(e.target.value)}
                required={statusChoice !== 'Hadir'}
                placeholder={
                  statusChoice === 'Hadir'
                    ? 'Contoh: Piket gerbang pagi / tugas luar'
                    : 'Tuliskan keterangan singkat...'
                }
                className="w-full max-w-xl px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-red-700 rounded-lg hover:bg-red-800 disabled:opacity-50 transition-colors"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {statusChoice === 'Hadir'
                ? 'Catat Absen Masuk Sekarang'
                : `Simpan Status ${statusChoice}`}
            </button>
          </form>
        ) : (
          <div className="pt-5 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-slate-500">Jam Masuk</p>
                <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {formatWaktuID(todayRecord.check_in)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Jam Pulang</p>
                <p className="text-xl font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {formatWaktuID(todayRecord.check_out)}
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-slate-500">Catatan</p>
                <p className="text-sm text-slate-800 mt-1">
                  {todayRecord.catatan || 'Tidak ada catatan'}
                </p>
              </div>
            </div>

            {todayRecord.status === 'Hadir' && !todayRecord.check_out ? (
              <button
                type="button"
                onClick={handleCheckOut}
                disabled={submitting}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors whitespace-nowrap shrink-0"
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
                Catat Absen Pulang
              </button>
            ) : (
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-emerald-700">
                <Clock className="w-4 h-4" />
                Presensi hari ini telah selesai
              </div>
            )}
          </div>
        )}
      </div>

      {/* Personal Attendance History Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-base font-bold text-slate-900">Riwayat Absensi Pribadi</h2>
          <div className="flex items-center gap-2">
            <label htmlFor="filter-month" className="text-xs font-medium text-slate-600">
              Bulan:
            </label>
            <input
              id="filter-month"
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Tanggal</th>
                <th className="px-4 py-3">Jam Masuk</th>
                <th className="px-4 py-3">Jam Pulang</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-6 py-3">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Memuat riwayat absensi...
                  </td>
                </tr>
              ) : history.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                    Belum ada riwayat absensi pada bulan terpilih.
                  </td>
                </tr>
              ) : (
                history.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/80">
                    <td className="px-6 py-3.5 font-medium text-slate-900 tabular-nums whitespace-nowrap">
                      {formatTanggalID(item.tanggal)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-700 tabular-nums">
                      {formatWaktuID(item.check_in)}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-slate-700 tabular-nums">
                      {formatWaktuID(item.check_out)}
                    </td>
                    <td className="px-4 py-3.5">
                      <span
                        className={`inline-block px-2 py-0.5 text-xs font-semibold border rounded ${getStatusTextClass(
                          item.status
                        )}`}
                      >
                        {item.status}
                      </span>
                    </td>
                    <td className="px-6 py-3.5 text-slate-600">{item.catatan || '—'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
