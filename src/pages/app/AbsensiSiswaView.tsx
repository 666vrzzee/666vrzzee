import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  Save,
  Search,
  CheckCheck,
} from 'lucide-react';
import { apiFetch } from '../../lib/supabase';
import { getTodayJakarta } from '../../lib/format';
import {
  ATTENDANCE_STATUSES,
  AttendanceStatus,
  JURUSAN_LIST,
  Student,
  StudentAttendance,
} from '../../types';
import { useAuth } from '../../context/AuthContext';

export default function AbsensiSiswaView() {
  const { profile } = useAuth();
  const [tanggal, setTanggal] = useState(getTodayJakarta());
  const [students, setStudents] = useState<Student[]>([]);
  const [statusMap, setStatusMap] = useState<Record<string, AttendanceStatus>>({});
  const [noteMap, setNoteMap] = useState<Record<string, string>>({});

  const [filterJurusan, setFilterJurusan] = useState<string>('ALL');
  const [filterKelas, setFilterKelas] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setFeedback('');
    try {
      const res = await apiFetch<{
        tanggal: string;
        students: Student[];
        records: StudentAttendance[];
      }>(`/api/attendance/student?tanggal=${encodeURIComponent(tanggal)}`);

      setStudents(res.students);

      const nextStatus: Record<string, AttendanceStatus> = {};
      const nextNote: Record<string, string> = {};
      const existingByStudent = new Map<string, StudentAttendance>();

      for (const rec of res.records) {
        existingByStudent.set(rec.student_id, rec);
      }

      for (const s of res.students) {
        const existing = existingByStudent.get(s.id);
        nextStatus[s.id] = existing ? existing.status : 'Hadir';
        nextNote[s.id] = existing ? existing.catatan || '' : '';
      }

      setStatusMap(nextStatus);
      setNoteMap(nextNote);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data absensi siswa.');
    } finally {
      setLoading(false);
    }
  }, [tanggal]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const classOptions = useMemo(() => {
    const set = new Set<string>();
    for (const s of students) {
      if (filterJurusan === 'ALL' || s.jurusan === filterJurusan) {
        set.add(s.kelas);
      }
    }
    return Array.from(set).sort();
  }, [students, filterJurusan]);

  const filteredStudents = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return students.filter((s) => {
      if (filterJurusan !== 'ALL' && s.jurusan !== filterJurusan) return false;
      if (filterKelas !== 'ALL' && s.kelas !== filterKelas) return false;
      if (q && !s.nama.toLowerCase().includes(q) && !s.nis.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [students, filterJurusan, filterKelas, searchQuery]);

  const markAllHadir = () => {
    setStatusMap((prev) => {
      const updated = { ...prev };
      for (const s of filteredStudents) {
        updated[s.id] = 'Hadir';
      }
      return updated;
    });
  };

  const handleSave = async () => {
    if (filteredStudents.length === 0) return;
    setSaving(true);
    setError('');
    setFeedback('');

    try {
      const items = filteredStudents.map((s) => ({
        student_id: s.id,
        status: statusMap[s.id] || 'Hadir',
        catatan: noteMap[s.id] || '',
      }));

      const res = await apiFetch<{ savedCount: number }>('/api/attendance/student/batch', {
        method: 'POST',
        body: JSON.stringify({ tanggal, items }),
      });

      setFeedback(`Berhasil menyimpan absensi untuk ${res.savedCount} siswa.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan absensi siswa.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Absensi Siswa</h1>
          <p className="text-sm text-slate-600 mt-1">
            Catat kehadiran siswa per kelas dan tanggal untuk SMK Prima Unggul.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={markAllHadir}
            disabled={loading || filteredStudents.length === 0}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:border-red-700 hover:text-red-700 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            <CheckCheck className="w-4 h-4" />
            Tandai Semua Hadir
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || filteredStudents.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-700 rounded-lg hover:bg-red-800 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Simpan Absensi
          </button>
        </div>
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

      {/* Filters */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Tanggal</label>
          <input
            type="date"
            value={tanggal}
            onChange={(e) => setTanggal(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Jurusan</label>
          <select
            value={filterJurusan}
            onChange={(e) => {
              setFilterJurusan(e.target.value);
              setFilterKelas('ALL');
            }}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
          >
            <option value="ALL">Semua Jurusan</option>
            {JURUSAN_LIST.map((j) => (
              <option key={j.code} value={j.code}>
                {j.code} — {j.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Kelas</label>
          <select
            value={filterKelas}
            onChange={(e) => setFilterKelas(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
          >
            <option value="ALL">Semua Kelas</option>
            {classOptions.map((cls) => (
              <option key={cls} value={cls}>
                {cls}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Cari NIS / Nama</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari siswa..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
            />
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-600 border-b border-slate-200">
              <tr>
                <th className="px-5 py-3">NIS</th>
                <th className="px-4 py-3">Nama Siswa</th>
                <th className="px-4 py-3">Kelas</th>
                <th className="px-4 py-3">Status Kehadiran</th>
                <th className="px-5 py-3">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    Memuat daftar siswa...
                  </td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-10 text-center text-slate-500">
                    {students.length === 0 ? (
                      <div className="space-y-2">
                        <p>Belum ada data siswa yang terdaftar di database.</p>
                        {profile?.role === 'admin' && (
                          <Link
                            to="/app/data-siswa"
                            className="inline-block text-sm font-semibold text-red-700 hover:underline"
                          >
                            Tambahkan Data Siswa di menu Data Siswa
                          </Link>
                        )}
                      </div>
                    ) : (
                      'Tidak ada siswa yang sesuai filter.'
                    )}
                  </td>
                </tr>
              ) : (
                filteredStudents.map((s) => {
                  const currentStatus = statusMap[s.id] || 'Hadir';
                  return (
                    <tr key={s.id} className="hover:bg-slate-50/70">
                      <td className="px-5 py-3 font-mono text-xs text-slate-700 tabular-nums whitespace-nowrap">
                        {s.nis}
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-900">{s.nama}</td>
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {s.kelas} · <span className="font-mono text-xs">{s.jurusan}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="inline-flex p-0.5 bg-slate-100 rounded-lg gap-0.5">
                          {ATTENDANCE_STATUSES.map((st) => {
                            const active = currentStatus === st;
                            const activeStyle =
                              st === 'Hadir'
                                ? 'bg-emerald-600 text-white'
                                : st === 'Izin'
                                ? 'bg-amber-600 text-white'
                                : st === 'Sakit'
                                ? 'bg-sky-600 text-white'
                                : 'bg-red-700 text-white';

                            return (
                              <button
                                key={st}
                                type="button"
                                onClick={() =>
                                  setStatusMap((prev) => ({ ...prev, [s.id]: st }))
                                }
                                className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                                  active
                                    ? activeStyle
                                    : 'text-slate-600 hover:text-slate-900'
                                }`}
                              >
                                {st}
                              </button>
                            );
                          })}
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <input
                          type="text"
                          value={noteMap[s.id] || ''}
                          onChange={(e) =>
                            setNoteMap((prev) => ({ ...prev, [s.id]: e.target.value }))
                          }
                          placeholder="Catatan opsional..."
                          className="w-full min-w-[160px] px-2.5 py-1.5 text-xs border border-slate-200 rounded-md focus:outline-none focus:border-red-700"
                        />
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
