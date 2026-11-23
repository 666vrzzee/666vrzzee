import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

function cleanEnvValue(raw: string | undefined): string {
  if (!raw) return '';
  return raw.trim().replace(/^["']+|["']+$/g, '').trim();
}

function normalizeSupabaseUrl(raw: string | undefined): string {
  let value = cleanEnvValue(raw);
  if (!value) return '';
  if (
    value.includes('your-project-id') ||
    value.startsWith('MY_') ||
    value.includes('your-supabase')
  ) {
    return '';
  }
  if (!/^https?:\/\//i.test(value) && value.includes('.supabase.')) {
    value = `https://${value}`;
  }
  try {
    const parsed = new URL(value);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return '';
    }
    return parsed.origin;
  } catch {
    return '';
  }
}

function isRealSecret(value: string): boolean {
  return Boolean(
    value &&
      !value.startsWith('your-') &&
      !value.startsWith('MY_') &&
      !value.includes('your-supabase')
  );
}

const SUPABASE_URL = normalizeSupabaseUrl(
  process.env.SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL
);
const SUPABASE_ANON_KEY = cleanEnvValue(
  process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
const SUPABASE_SERVICE_ROLE_KEY = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);

let supabaseAdmin: SupabaseClient | null = null;
if (
  SUPABASE_URL &&
  isRealSecret(SUPABASE_ANON_KEY) &&
  isRealSecret(SUPABASE_SERVICE_ROLE_KEY)
) {
  try {
    supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  } catch (err) {
    console.warn('Supabase initialization skipped due to invalid configuration:', err);
    supabaseAdmin = null;
  }
}

const isSupabaseAdminConfigured = Boolean(supabaseAdmin);
const isPublicConfigAvailable = Boolean(SUPABASE_URL && isRealSecret(SUPABASE_ANON_KEY));

function getJakartaDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

interface AuthenticatedRequest extends Request {
  authUser?: {
    id: string;
    email: string;
    role: 'admin' | 'guru' | 'tenaga_kependidikan';
    full_name: string;
    nip: string;
    jabatan: string;
  };
}

function requireSupabase(_req: Request, res: Response, next: NextFunction) {
  if (!supabaseAdmin) {
    res.status(503).json({
      error:
        'Supabase belum dikonfigurasi pada server. Pastikan SUPABASE_URL, SUPABASE_ANON_KEY, dan SUPABASE_SERVICE_ROLE_KEY sudah diisi dengan benar pada Environment Variables.',
      code: 'SUPABASE_NOT_CONFIGURED',
    });
    return;
  }
  next();
}

async function ensureUserProfile(authUser: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
}) {
  if (!supabaseAdmin) throw new Error('Supabase tidak tersedia');

  const { data: existingProfile, error: fetchErr } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', authUser.id)
    .maybeSingle();

  if (fetchErr) {
    throw fetchErr;
  }

  if (existingProfile) {
    return existingProfile;
  }

  const { count, error: countErr } = await supabaseAdmin
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    throw countErr;
  }

  const metaRole = String(authUser.user_metadata?.role || '');
  let assignedRole: 'admin' | 'guru' | 'tenaga_kependidikan' = 'tenaga_kependidikan';

  if ((count ?? 0) === 0) {
    assignedRole = 'admin';
  } else if (metaRole === 'admin' || metaRole === 'guru' || metaRole === 'tenaga_kependidikan') {
    assignedRole = metaRole;
  }

  const email = authUser.email || '';
  const fullName =
    String(authUser.user_metadata?.full_name || '').trim() ||
    email.split('@')[0] ||
    'Pengguna';

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('profiles')
    .insert({
      id: authUser.id,
      email,
      full_name: fullName,
      role: assignedRole,
      nip: String(authUser.user_metadata?.nip || ''),
      jabatan: String(authUser.user_metadata?.jabatan || ''),
    })
    .select('*')
    .single();

  if (insertErr) {
    throw insertErr;
  }

  await supabaseAdmin.auth.admin.updateUserById(authUser.id, {
    user_metadata: {
      ...authUser.user_metadata,
      full_name: fullName,
      role: assignedRole,
    },
  });

  return inserted;
}

async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!supabaseAdmin) {
    res.status(503).json({
      error:
        'Supabase Admin belum dikonfigurasi pada server. Pastikan SUPABASE_SERVICE_ROLE_KEY sudah diisi pada Environment Variables.',
      code: 'SUPABASE_NOT_CONFIGURED',
    });
    return;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sesi otentikasi tidak ditemukan. Silakan login kembali.' });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const { data, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: 'Token sesi tidak valid atau sudah kedaluwarsa.' });
      return;
    }

    const profile = await ensureUserProfile(data.user);
    req.authUser = {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      full_name: profile.full_name,
      nip: profile.nip || '',
      jabatan: profile.jabatan || '',
    };
    next();
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Gagal memverifikasi otentikasi.';
    res.status(500).json({ error: message });
  }
}

function requireRole(...allowedRoles: Array<'admin' | 'guru' | 'tenaga_kependidikan'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser || !allowedRoles.includes(req.authUser.role)) {
      res.status(403).json({ error: 'Anda tidak memiliki izin akses untuk fitur ini.' });
      return;
    }
    next();
  };
}

export function createApiApp(): express.Express {
  const app = express();
  app.use(express.json({ limit: '2mb' }));

  app.get('/api/config', (_req, res) => {
    res.json({
      configured: isSupabaseAdminConfigured,
      publicConfigured: isPublicConfigAvailable,
      supabaseUrl: isPublicConfigAvailable ? SUPABASE_URL : '',
      supabaseAnonKey: isPublicConfigAvailable ? SUPABASE_ANON_KEY : '',
    });
  });

  app.get('/api/auth/first-user-status', requireSupabase, async (_req, res) => {
    try {
      const { data: listData, error: listErr } = await supabaseAdmin!.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });
      if (listErr) throw listErr;
      const hasUsers = (listData?.users?.length ?? 0) > 0;
      res.json({ hasUsers });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memeriksa status pengguna.',
      });
    }
  });

  app.post('/api/auth/register', requireSupabase, async (req, res) => {
    const { email, password, full_name, nip, jabatan } = req.body as {
      email?: string;
      password?: string;
      full_name?: string;
      nip?: string;
      jabatan?: string;
    };

    if (!email || !password || !full_name) {
      res.status(400).json({ error: 'Nama lengkap, email, dan kata sandi wajib diisi.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
      return;
    }

    try {
      const { data: existingUsers, error: listErr } = await supabaseAdmin!.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });
      if (listErr) throw listErr;

      const isFirstUser = (existingUsers?.users?.length ?? 0) === 0;
      const assignedRole: 'admin' | 'tenaga_kependidikan' = isFirstUser
        ? 'admin'
        : 'tenaga_kependidikan';

      const { data: created, error: createErr } = await supabaseAdmin!.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim(),
          role: assignedRole,
          nip: (nip || '').trim(),
          jabatan: (jabatan || '').trim(),
        },
      });

      if (createErr || !created.user) {
        res.status(400).json({ error: createErr?.message || 'Gagal membuat akun di Supabase.' });
        return;
      }

      const profile = await ensureUserProfile({
        id: created.user.id,
        email: created.user.email,
        user_metadata: {
          full_name: full_name.trim(),
          role: assignedRole,
          nip: (nip || '').trim(),
          jabatan: (jabatan || '').trim(),
        },
      });

      res.status(201).json({
        user: profile,
        isFirstAdmin: isFirstUser,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal mendaftarkan pengguna.',
      });
    }
  });

  app.post('/api/auth/sync-profile', authenticate, async (req: AuthenticatedRequest, res) => {
    res.json({ profile: req.authUser });
  });

  app.get('/api/auth/me', authenticate, async (req: AuthenticatedRequest, res) => {
    res.json({ profile: req.authUser });
  });

  app.get('/api/dashboard', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const today = getJakartaDateString();
      const user = req.authUser!;

      const { data: myTodayAttendance } = await supabaseAdmin!
        .from('employee_attendance')
        .select('*')
        .eq('user_id', user.id)
        .eq('tanggal', today)
        .maybeSingle();

      const monthPrefix = today.slice(0, 7);
      const { data: myMonthRecords } = await supabaseAdmin!
        .from('employee_attendance')
        .select('*')
        .eq('user_id', user.id)
        .gte('tanggal', `${monthPrefix}-01`)
        .lte('tanggal', `${monthPrefix}-31`)
        .order('tanggal', { ascending: false });

      let totalStudents = 0;
      let totalUsers = 0;
      const todayStudentSummary = { Hadir: 0, Izin: 0, Sakit: 0, Alpha: 0, totalRecorded: 0 };
      const todayEmployeeSummary = { Hadir: 0, Izin: 0, Sakit: 0, Alpha: 0, totalRecorded: 0 };
      let recentStudentAttendance: unknown[] = [];
      let recentEmployeeAttendance: unknown[] = [];

      if (user.role === 'admin' || user.role === 'guru') {
        const { count: studentCount } = await supabaseAdmin!
          .from('students')
          .select('*', { count: 'exact', head: true });
        totalStudents = studentCount ?? 0;

        const { data: studentAttToday } = await supabaseAdmin!
          .from('student_attendance')
          .select('status')
          .eq('tanggal', today);

        if (studentAttToday) {
          for (const row of studentAttToday) {
            if (row.status in todayStudentSummary) {
              todayStudentSummary[row.status as 'Hadir' | 'Izin' | 'Sakit' | 'Alpha'] += 1;
            }
          }
          todayStudentSummary.totalRecorded = studentAttToday.length;
        }

        const { data: recentStud } = await supabaseAdmin!
          .from('student_attendance')
          .select('*, student:students(id, nis, nama, kelas, jurusan)')
          .order('created_at', { ascending: false })
          .limit(8);
        recentStudentAttendance = recentStud || [];
      }

      if (user.role === 'admin') {
        const { count: userCount } = await supabaseAdmin!
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        totalUsers = userCount ?? 0;

        const { data: empAttToday } = await supabaseAdmin!
          .from('employee_attendance')
          .select('status')
          .eq('tanggal', today);

        if (empAttToday) {
          for (const row of empAttToday) {
            if (row.status in todayEmployeeSummary) {
              todayEmployeeSummary[row.status as 'Hadir' | 'Izin' | 'Sakit' | 'Alpha'] += 1;
            }
          }
          todayEmployeeSummary.totalRecorded = empAttToday.length;
        }

        const { data: recentEmp } = await supabaseAdmin!
          .from('employee_attendance')
          .select('*, profile:profiles(id, full_name, email, role, nip, jabatan)')
          .order('created_at', { ascending: false })
          .limit(8);
        recentEmployeeAttendance = recentEmp || [];
      }

      res.json({
        today,
        myTodayAttendance: myTodayAttendance || null,
        myMonthRecords: myMonthRecords || [],
        totalStudents,
        totalUsers,
        todayStudentSummary,
        todayEmployeeSummary,
        recentStudentAttendance,
        recentEmployeeAttendance,
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memuat ringkasan dashboard.',
      });
    }
  });

  app.get('/api/attendance/employee/me', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const today = getJakartaDateString();
      const month = String(req.query.month || today.slice(0, 7));

      const { data: todayRecord, error: todayErr } = await supabaseAdmin!
        .from('employee_attendance')
        .select('*')
        .eq('user_id', req.authUser!.id)
        .eq('tanggal', today)
        .maybeSingle();

      if (todayErr) throw todayErr;

      const { data: history, error: histErr } = await supabaseAdmin!
        .from('employee_attendance')
        .select('*')
        .eq('user_id', req.authUser!.id)
        .gte('tanggal', `${month}-01`)
        .lte('tanggal', `${month}-31`)
        .order('tanggal', { ascending: false });

      if (histErr) throw histErr;

      res.json({
        today,
        todayRecord: todayRecord || null,
        history: history || [],
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal mengambil data absensi karyawan.',
      });
    }
  });

  app.post('/api/attendance/employee/check-in', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const today = getJakartaDateString();
      const nowIso = new Date().toISOString();
      const { status = 'Hadir', catatan = '' } = req.body as {
        status?: 'Hadir' | 'Izin' | 'Sakit';
        catatan?: string;
      };

      if (!['Hadir', 'Izin', 'Sakit'].includes(status)) {
        res.status(400).json({ error: 'Status absensi mandiri harus Hadir, Izin, atau Sakit.' });
        return;
      }

      const { data: existing } = await supabaseAdmin!
        .from('employee_attendance')
        .select('*')
        .eq('user_id', req.authUser!.id)
        .eq('tanggal', today)
        .maybeSingle();

      if (existing) {
        res.status(400).json({ error: 'Anda sudah melakukan pencatatan absensi untuk hari ini.' });
        return;
      }

      const { data, error } = await supabaseAdmin!
        .from('employee_attendance')
        .insert({
          user_id: req.authUser!.id,
          tanggal: today,
          check_in: status === 'Hadir' ? nowIso : null,
          status,
          catatan: catatan.trim(),
        })
        .select('*')
        .single();

      if (error) throw error;
      res.status(201).json({ record: data });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal menyimpan absen masuk.',
      });
    }
  });

  app.post('/api/attendance/employee/check-out', authenticate, async (req: AuthenticatedRequest, res) => {
    try {
      const today = getJakartaDateString();
      const nowIso = new Date().toISOString();

      const { data: existing, error: findErr } = await supabaseAdmin!
        .from('employee_attendance')
        .select('*')
        .eq('user_id', req.authUser!.id)
        .eq('tanggal', today)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!existing) {
        res.status(400).json({ error: 'Anda belum melakukan absen masuk hari ini.' });
        return;
      }
      if (existing.status !== 'Hadir') {
        res.status(400).json({ error: 'Absen pulang hanya berlaku untuk status Hadir.' });
        return;
      }
      if (existing.check_out) {
        res.status(400).json({ error: 'Anda sudah melakukan absen pulang hari ini.' });
        return;
      }

      const { data, error } = await supabaseAdmin!
        .from('employee_attendance')
        .update({ check_out: nowIso, updated_at: nowIso })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw error;
      res.json({ record: data });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal menyimpan absen pulang.',
      });
    }
  });

  async function resolveClassId(kelasName: string, majorCode: string): Promise<string | null> {
    const cleanName = kelasName.trim();
    const { data: existing } = await supabaseAdmin!
      .from('classes')
      .select('id')
      .ilike('name', cleanName)
      .maybeSingle();

    if (existing?.id) return existing.id;

    const upper = cleanName.toUpperCase();
    const tingkat = upper.startsWith('XII') ? 'XII' : upper.startsWith('XI') ? 'XI' : 'X';

    const { data: created, error: createErr } = await supabaseAdmin!
      .from('classes')
      .upsert(
        { name: cleanName, tingkat, major_code: majorCode },
        { onConflict: 'name' }
      )
      .select('id')
      .single();

    if (createErr) return null;
    return created?.id || null;
  }

  app.get('/api/majors', authenticate, async (_req, res) => {
    try {
      const { data, error } = await supabaseAdmin!
        .from('majors')
        .select('*')
        .order('code', { ascending: true });
      if (error) throw error;
      res.json({ majors: data || [] });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memuat data jurusan.',
      });
    }
  });

  app.get('/api/classes', authenticate, requireRole('admin', 'guru'), async (_req, res) => {
    try {
      const { data, error } = await supabaseAdmin!
        .from('classes')
        .select('*, major:majors(code, name, rumpun), wali_kelas:profiles(id, full_name)')
        .order('name', { ascending: true });
      if (error) throw error;
      res.json({ classes: data || [] });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memuat data kelas.',
      });
    }
  });

  app.get('/api/students', authenticate, requireRole('admin', 'guru'), async (_req, res) => {
    try {
      const { data, error } = await supabaseAdmin!
        .from('students')
        .select('*, class_info:classes(id, name, tingkat, major_code), major:majors(code, name, rumpun)')
        .order('kelas', { ascending: true })
        .order('nama', { ascending: true });

      if (error) throw error;
      res.json({ students: data || [] });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memuat data siswa.',
      });
    }
  });

  app.post('/api/students', authenticate, requireRole('admin'), async (req, res) => {
    const { nis, nama, kelas, jurusan } = req.body as {
      nis?: string;
      nama?: string;
      kelas?: string;
      jurusan?: string;
    };

    if (!nis || !nama || !kelas || !jurusan) {
      res.status(400).json({ error: 'NIS, Nama, Kelas, dan Jurusan wajib diisi.' });
      return;
    }

    try {
      const classId = await resolveClassId(kelas, jurusan.trim());
      const { data, error } = await supabaseAdmin!
        .from('students')
        .insert({
          nis: nis.trim(),
          nama: nama.trim(),
          class_id: classId,
          kelas: kelas.trim(),
          jurusan: jurusan.trim(),
        })
        .select('*')
        .single();

      if (error) {
        if (error.code === '23505') {
          res.status(400).json({ error: 'NIS siswa sudah terdaftar.' });
          return;
        }
        throw error;
      }

      res.status(201).json({ student: data });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal menambahkan siswa.',
      });
    }
  });

  app.put('/api/students/:id', authenticate, requireRole('admin'), async (req, res) => {
    const { id } = req.params;
    const { nis, nama, kelas, jurusan } = req.body as {
      nis?: string;
      nama?: string;
      kelas?: string;
      jurusan?: string;
    };

    if (!nis || !nama || !kelas || !jurusan) {
      res.status(400).json({ error: 'NIS, Nama, Kelas, dan Jurusan wajib diisi.' });
      return;
    }

    try {
      const classId = await resolveClassId(kelas, jurusan.trim());
      const { data, error } = await supabaseAdmin!
        .from('students')
        .update({
          nis: nis.trim(),
          nama: nama.trim(),
          class_id: classId,
          kelas: kelas.trim(),
          jurusan: jurusan.trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (error) throw error;
      res.json({ student: data });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memperbarui data siswa.',
      });
    }
  });

  app.delete('/api/students/:id', authenticate, requireRole('admin'), async (req, res) => {
    const { id } = req.params;
    try {
      const { error } = await supabaseAdmin!.from('students').delete().eq('id', id);
      if (error) throw error;
      res.json({ success: true });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal menghapus data siswa.',
      });
    }
  });

  app.get('/api/attendance/student', authenticate, requireRole('admin', 'guru'), async (req, res) => {
    try {
      const tanggal = String(req.query.tanggal || getJakartaDateString());
      const { data: students, error: studErr } = await supabaseAdmin!
        .from('students')
        .select('*')
        .order('kelas', { ascending: true })
        .order('nama', { ascending: true });

      if (studErr) throw studErr;

      const { data: attendanceRows, error: attErr } = await supabaseAdmin!
        .from('student_attendance')
        .select('*')
        .eq('tanggal', tanggal);

      if (attErr) throw attErr;

      res.json({
        tanggal,
        students: students || [],
        records: attendanceRows || [],
      });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memuat data absensi siswa.',
      });
    }
  });

  app.post('/api/attendance/student/batch', authenticate, requireRole('admin', 'guru'), async (req: AuthenticatedRequest, res) => {
    const { tanggal, items } = req.body as {
      tanggal?: string;
      items?: Array<{
        student_id: string;
        status: 'Hadir' | 'Izin' | 'Sakit' | 'Alpha';
        catatan?: string;
      }>;
    };

    if (!tanggal || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Tanggal dan daftar absensi siswa wajib diisi.' });
      return;
    }

    try {
      const nowIso = new Date().toISOString();
      const payload = items.map((item) => ({
        student_id: item.student_id,
        recorded_by: req.authUser!.id,
        tanggal,
        status: item.status,
        catatan: (item.catatan || '').trim(),
        updated_at: nowIso,
      }));

      const { data, error } = await supabaseAdmin!
        .from('student_attendance')
        .upsert(payload, { onConflict: 'student_id,tanggal' })
        .select('*');

      if (error) throw error;
      res.json({ savedCount: data?.length ?? payload.length, records: data || [] });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal menyimpan absensi siswa.',
      });
    }
  });

  app.get('/api/rekap/karyawan', authenticate, requireRole('admin'), async (req, res) => {
    try {
      const today = getJakartaDateString();
      const startDate = String(req.query.startDate || `${today.slice(0, 7)}-01`);
      const endDate = String(req.query.endDate || today);

      const { data, error } = await supabaseAdmin!
        .from('employee_attendance')
        .select('*, profile:profiles(id, full_name, email, role, nip, jabatan)')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false });

      if (error) throw error;
      res.json({ records: data || [] });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memuat rekap absensi karyawan.',
      });
    }
  });

  app.get('/api/rekap/siswa', authenticate, requireRole('admin', 'guru'), async (req, res) => {
    try {
      const today = getJakartaDateString();
      const startDate = String(req.query.startDate || `${today.slice(0, 7)}-01`);
      const endDate = String(req.query.endDate || today);

      const { data, error } = await supabaseAdmin!
        .from('student_attendance')
        .select(
          '*, student:students(id, nis, nama, kelas, jurusan), recorder:profiles(id, full_name, role)'
        )
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false });

      if (error) throw error;
      res.json({ records: data || [] });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memuat rekap absensi siswa.',
      });
    }
  });

  app.get('/api/users', authenticate, requireRole('admin'), async (_req, res) => {
    try {
      const { data: authUsersData, error: authErr } = await supabaseAdmin!.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (authErr) throw authErr;

      for (const au of authUsersData.users) {
        await ensureUserProfile(au);
      }

      const { data: profiles, error: profErr } = await supabaseAdmin!
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

      if (profErr) throw profErr;

      res.json({ users: profiles || [] });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memuat daftar user.',
      });
    }
  });

  app.post('/api/users', authenticate, requireRole('admin'), async (req, res) => {
    const { email, password, full_name, role, nip, jabatan } = req.body as {
      email?: string;
      password?: string;
      full_name?: string;
      role?: 'admin' | 'guru' | 'tenaga_kependidikan';
      nip?: string;
      jabatan?: string;
    };

    if (!email || !password || !full_name || !role) {
      res.status(400).json({ error: 'Nama lengkap, email, password, dan role wajib diisi.' });
      return;
    }

    if (!['admin', 'guru', 'tenaga_kependidikan'].includes(role)) {
      res.status(400).json({ error: 'Role tidak valid.' });
      return;
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
      return;
    }

    try {
      const { data: created, error: createErr } = await supabaseAdmin!.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim(),
          role,
          nip: (nip || '').trim(),
          jabatan: (jabatan || '').trim(),
        },
      });

      if (createErr || !created.user) {
        res.status(400).json({ error: createErr?.message || 'Gagal membuat user di Supabase Auth.' });
        return;
      }

      const { data: profile, error: upsertErr } = await supabaseAdmin!
        .from('profiles')
        .upsert(
          {
            id: created.user.id,
            email: email.trim().toLowerCase(),
            full_name: full_name.trim(),
            role,
            nip: (nip || '').trim(),
            jabatan: (jabatan || '').trim(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select('*')
        .single();

      if (upsertErr) throw upsertErr;
      res.status(201).json({ user: profile });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal menambahkan user baru.',
      });
    }
  });

  app.put('/api/users/:id', authenticate, requireRole('admin'), async (req, res) => {
    const { id } = req.params;
    const { email, password, full_name, role, nip, jabatan } = req.body as {
      email?: string;
      password?: string;
      full_name?: string;
      role?: 'admin' | 'guru' | 'tenaga_kependidikan';
      nip?: string;
      jabatan?: string;
    };

    if (!email || !full_name || !role) {
      res.status(400).json({ error: 'Nama lengkap, email, dan role wajib diisi.' });
      return;
    }

    if (!['admin', 'guru', 'tenaga_kependidikan'].includes(role)) {
      res.status(400).json({ error: 'Role tidak valid.' });
      return;
    }

    try {
      const authUpdatePayload: {
        email: string;
        email_confirm: boolean;
        password?: string;
        user_metadata: Record<string, string>;
      } = {
        email: email.trim().toLowerCase(),
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim(),
          role,
          nip: (nip || '').trim(),
          jabatan: (jabatan || '').trim(),
        },
      };

      if (password && password.trim().length > 0) {
        if (password.trim().length < 6) {
          res.status(400).json({ error: 'Kata sandi baru minimal 6 karakter.' });
          return;
        }
        authUpdatePayload.password = password.trim();
      }

      const { error: authUpdateErr } = await supabaseAdmin!.auth.admin.updateUserById(
        id,
        authUpdatePayload
      );
      if (authUpdateErr) {
        res.status(400).json({ error: authUpdateErr.message });
        return;
      }

      const { data: updatedProfile, error: profErr } = await supabaseAdmin!
        .from('profiles')
        .update({
          email: email.trim().toLowerCase(),
          full_name: full_name.trim(),
          role,
          nip: (nip || '').trim(),
          jabatan: (jabatan || '').trim(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .select('*')
        .single();

      if (profErr) throw profErr;
      res.json({ user: updatedProfile });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal memperbarui data user.',
      });
    }
  });

  app.delete('/api/users/:id', authenticate, requireRole('admin'), async (req: AuthenticatedRequest, res) => {
    const { id } = req.params;

    if (id === req.authUser!.id) {
      res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.' });
      return;
    }

    try {
      const { error: deleteAuthErr } = await supabaseAdmin!.auth.admin.deleteUser(id, false);
      if (deleteAuthErr) {
        res.status(400).json({ error: deleteAuthErr.message });
        return;
      }

      await supabaseAdmin!.from('profiles').delete().eq('id', id);

      res.json({ success: true, hardDeletedId: id });
    } catch (err) {
      res.status(500).json({
        error: err instanceof Error ? err.message : 'Gagal menghapus permanen user dari Supabase Auth.',
      });
    }
  });

  return app;
}
