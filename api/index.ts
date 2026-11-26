import type { IncomingMessage, ServerResponse } from 'http';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type UserRole = 'admin' | 'guru' | 'tenaga_kependidikan';

interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  full_name: string;
  nip: string;
  jabatan: string;
}

class HttpError extends Error {
  statusCode: number;
  code?: string;

  constructor(statusCode: number, message: string, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

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
  const dashboardMatch = value.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dashboardMatch?.[1]) {
    value = `https://${dashboardMatch[1]}.supabase.co`;
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

function getSupabaseEnv() {
  const url = normalizeSupabaseUrl(
    process.env.SUPABASE_URL ||
      process.env.VITE_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL
  );
  const anonKey = cleanEnvValue(
    process.env.SUPABASE_ANON_KEY ||
      process.env.VITE_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
  const serviceRoleKey = cleanEnvValue(process.env.SUPABASE_SERVICE_ROLE_KEY);
  return { url, anonKey, serviceRoleKey };
}

let cachedAdmin: SupabaseClient | null = null;
let cachedEnvSignature = '';

function getSupabaseAdmin(): {
  admin: SupabaseClient | null;
  url: string;
  anonKey: string;
  publicAvailable: boolean;
  hasServiceRoleKey: boolean;
} {
  const { url, anonKey, serviceRoleKey } = getSupabaseEnv();
  const publicAvailable = Boolean(url && isRealSecret(anonKey));
  const hasServiceRoleKey = isRealSecret(serviceRoleKey);
  const signature = `${url}|${serviceRoleKey}`;

  if (cachedAdmin && cachedEnvSignature === signature) {
    return { admin: cachedAdmin, url, anonKey, publicAvailable, hasServiceRoleKey };
  }

  if (url && hasServiceRoleKey) {
    try {
      cachedAdmin = createClient(url, serviceRoleKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
      cachedEnvSignature = signature;
    } catch (err) {
      console.warn('Supabase initialization skipped due to invalid configuration:', err);
      cachedAdmin = null;
      cachedEnvSignature = '';
    }
  } else {
    cachedAdmin = null;
    cachedEnvSignature = '';
  }

  return { admin: cachedAdmin, url, anonKey, publicAvailable, hasServiceRoleKey };
}

function requireAdminClient(): SupabaseClient {
  const { admin, url, hasServiceRoleKey } = getSupabaseAdmin();
  if (!admin) {
    const missing: string[] = [];
    if (!url) missing.push('SUPABASE_URL (atau VITE_SUPABASE_URL)');
    if (!hasServiceRoleKey) missing.push('SUPABASE_SERVICE_ROLE_KEY');
    const detail = missing.length > 0 ? ` Variabel yang belum valid/terisi: ${missing.join(', ')}.` : '';
    throw new HttpError(
      503,
      `Supabase Admin belum dikonfigurasi pada server.${detail} Pastikan Environment Variables sudah diisi dan lakukan Redeploy.`,
      'SUPABASE_NOT_CONFIGURED'
    );
  }
  return admin;
}

function getJakartaDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  if (res.writableEnded) return;
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

function getRouteAndQuery(req: IncomingMessage): {
  method: string;
  pathname: string;
  query: URLSearchParams;
} {
  const method = (req.method || 'GET').toUpperCase();
  const reqAny = req as IncomingMessage & { originalUrl?: string };
  const rawUrl = reqAny.originalUrl || req.url || '/api';
  const parsedUrl = new URL(rawUrl, 'http://localhost');
  const overridePath = parsedUrl.searchParams.get('__path');
  let pathname = overridePath || parsedUrl.pathname || '/api';
  if (!pathname.startsWith('/')) {
    pathname = `/${pathname}`;
  }
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }
  return { method, pathname, query: parsedUrl.searchParams };
}

async function readJsonBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  const reqAny = req as IncomingMessage & { body?: unknown };
  if (reqAny.body !== undefined && reqAny.body !== null) {
    if (typeof reqAny.body === 'string') {
      const trimmed = reqAny.body.trim();
      if (!trimmed) return {};
      try {
        const parsed = JSON.parse(trimmed);
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
      } catch {
        throw new HttpError(400, 'Format JSON pada body permintaan tidak valid.');
      }
    }
    if (Buffer.isBuffer(reqAny.body)) {
      const trimmed = reqAny.body.toString('utf8').trim();
      if (!trimmed) return {};
      try {
        const parsed = JSON.parse(trimmed);
        return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
      } catch {
        throw new HttpError(400, 'Format JSON pada body permintaan tidak valid.');
      }
    }
    if (typeof reqAny.body === 'object') {
      return reqAny.body as Record<string, unknown>;
    }
  }

  if (req.readableEnded) {
    return {};
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  const maxBytes = 2 * 1024 * 1024;

  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    totalBytes += buf.length;
    if (totalBytes > maxBytes) {
      throw new HttpError(413, 'Ukuran data permintaan melebihi batas 2MB.');
    }
    chunks.push(buf);
  }

  const raw = Buffer.concat(chunks).toString('utf8').trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    throw new HttpError(400, 'Format JSON pada body permintaan tidak valid.');
  }
}

async function ensureUserProfile(
  admin: SupabaseClient,
  authUser: {
    id: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  }
) {
  const { data: existingProfile, error: fetchErr } = await admin
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

  const { count, error: countErr } = await admin
    .from('profiles')
    .select('*', { count: 'exact', head: true });

  if (countErr) {
    throw countErr;
  }

  const metaRole = String(authUser.user_metadata?.role || '');
  let assignedRole: UserRole = 'tenaga_kependidikan';

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

  const { data: inserted, error: insertErr } = await admin
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

  await admin.auth.admin.updateUserById(authUser.id, {
    user_metadata: {
      ...authUser.user_metadata,
      full_name: fullName,
      role: assignedRole,
    },
  });

  return inserted;
}

async function authenticateRequest(req: IncomingMessage): Promise<{
  admin: SupabaseClient;
  authUser: AuthUser;
}> {
  const admin = requireAdminClient();
  const rawAuth = req.headers.authorization;
  const authHeader = Array.isArray(rawAuth) ? rawAuth[0] : rawAuth;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new HttpError(401, 'Sesi otentikasi tidak ditemukan. Silakan login kembali.');
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    throw new HttpError(401, 'Token sesi kosong. Silakan login kembali.');
  }

  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) {
    throw new HttpError(401, 'Token sesi tidak valid atau sudah kedaluwarsa.');
  }

  const profile = await ensureUserProfile(admin, data.user);
  return {
    admin,
    authUser: {
      id: profile.id,
      email: profile.email,
      role: profile.role,
      full_name: profile.full_name,
      nip: profile.nip || '',
      jabatan: profile.jabatan || '',
    },
  };
}

function assertRole(authUser: AuthUser, allowedRoles: UserRole[]): void {
  if (!allowedRoles.includes(authUser.role)) {
    throw new HttpError(403, 'Anda tidak memiliki izin akses untuk fitur ini.');
  }
}

async function resolveClassId(
  admin: SupabaseClient,
  kelasName: string,
  majorCode: string
): Promise<string | null> {
  try {
    const cleanName = kelasName.trim();
    const { data: existing, error: selErr } = await admin
      .from('classes')
      .select('id')
      .ilike('name', cleanName)
      .maybeSingle();

    if (selErr) return null;
    if (existing?.id) return existing.id;

    const upper = cleanName.toUpperCase();
    const tingkat = upper.startsWith('XII') ? 'XII' : upper.startsWith('XI') ? 'XI' : 'X';

    const { data: created, error: createErr } = await admin
      .from('classes')
      .upsert(
        { name: cleanName, tingkat, major_code: majorCode },
        { onConflict: 'name' }
      )
      .select('id')
      .single();

    if (createErr) return null;
    return created?.id || null;
  } catch {
    return null;
  }
}

export async function handleApiRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    const { method, pathname, query } = getRouteAndQuery(req);

    if (method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.end();
      return;
    }

    if (method === 'GET' && pathname === '/api/health') {
      const { admin, url, anonKey, publicAvailable, hasServiceRoleKey } = getSupabaseAdmin();
      sendJson(res, 200, {
        ok: true,
        status: 'healthy',
        runtime: 'node-http',
        nodeVersion: process.version,
        configured: Boolean(admin),
        publicConfigured: publicAvailable,
        envStatus: {
          hasSupabaseUrl: Boolean(url),
          hasAnonKey: isRealSecret(anonKey),
          hasServiceRoleKey,
        },
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/config') {
      const { admin, url, anonKey, publicAvailable } = getSupabaseAdmin();
      sendJson(res, 200, {
        configured: Boolean(admin),
        publicConfigured: publicAvailable,
        supabaseUrl: publicAvailable ? url : '',
        supabaseAnonKey: publicAvailable ? anonKey : '',
      });
      return;
    }

    if (method === 'GET' && pathname === '/api/auth/first-user-status') {
      const admin = requireAdminClient();
      const { data: listData, error: listErr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });
      if (listErr) throw listErr;
      const hasUsers = (listData?.users?.length ?? 0) > 0;
      sendJson(res, 200, { hasUsers });
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/register') {
      const admin = requireAdminClient();
      const body = await readJsonBody(req);
      const email = String(body.email || '');
      const password = String(body.password || '');
      const full_name = String(body.full_name || '');
      const nip = String(body.nip || '');
      const jabatan = String(body.jabatan || '');

      if (!email || !password || !full_name) {
        sendJson(res, 400, { error: 'Nama lengkap, email, dan kata sandi wajib diisi.' });
        return;
      }

      if (password.length < 6) {
        sendJson(res, 400, { error: 'Kata sandi minimal 6 karakter.' });
        return;
      }

      const { data: existingUsers, error: listErr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1,
      });
      if (listErr) throw listErr;

      const isFirstUser = (existingUsers?.users?.length ?? 0) === 0;
      const assignedRole: 'admin' | 'tenaga_kependidikan' = isFirstUser
        ? 'admin'
        : 'tenaga_kependidikan';

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim(),
          role: assignedRole,
          nip: nip.trim(),
          jabatan: jabatan.trim(),
        },
      });

      if (createErr || !created.user) {
        sendJson(res, 400, { error: createErr?.message || 'Gagal membuat akun di Supabase.' });
        return;
      }

      const profile = await ensureUserProfile(admin, {
        id: created.user.id,
        email: created.user.email,
        user_metadata: {
          full_name: full_name.trim(),
          role: assignedRole,
          nip: nip.trim(),
          jabatan: jabatan.trim(),
        },
      });

      sendJson(res, 201, {
        user: profile,
        isFirstAdmin: isFirstUser,
      });
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/login') {
      const { url, anonKey, serviceRoleKey } = getSupabaseEnv();
      const apiKey = isRealSecret(anonKey) ? anonKey : serviceRoleKey;
      if (!url || !isRealSecret(apiKey)) {
        sendJson(res, 503, {
          error:
            'Supabase belum dikonfigurasi pada server. Pastikan SUPABASE_URL dan SUPABASE_ANON_KEY sudah diisi pada Environment Variables.',
          code: 'SUPABASE_NOT_CONFIGURED',
        });
        return;
      }

      const body = await readJsonBody(req);
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '');

      if (!email || !password) {
        sendJson(res, 400, { error: 'Email dan kata sandi wajib diisi.' });
        return;
      }

      const publicClient = createClient(url, apiKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const { data, error } = await publicClient.auth.signInWithPassword({
        email,
        password,
      });

      if (error || !data.session || !data.user) {
        sendJson(res, 401, {
          error: error?.message || 'Email atau kata sandi tidak sesuai.',
        });
        return;
      }

      let profile: Record<string, unknown> | null = null;
      const { admin } = getSupabaseAdmin();
      if (admin) {
        profile = await ensureUserProfile(admin, data.user);
      } else {
        const authedClient = createClient(url, apiKey, {
          auth: { autoRefreshToken: false, persistSession: false },
          global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
        });
        const { data: profData } = await authedClient
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .maybeSingle();

        if (profData) {
          profile = profData;
        } else {
          const meta = data.user.user_metadata || {};
          const rawRole = String(meta.role || '');
          const role: UserRole =
            rawRole === 'admin' || rawRole === 'guru' || rawRole === 'tenaga_kependidikan'
              ? rawRole
              : 'tenaga_kependidikan';
          profile = {
            id: data.user.id,
            email: data.user.email || email,
            full_name: String(meta.full_name || email.split('@')[0] || 'Pengguna'),
            role,
            nip: String(meta.nip || ''),
            jabatan: String(meta.jabatan || ''),
            created_at: data.user.created_at,
            updated_at: data.user.created_at,
          };
        }
      }

      sendJson(res, 200, {
        session: data.session,
        user: data.user,
        profile,
      });
      return;
    }

    if (method === 'POST' && pathname === '/api/auth/sync-profile') {
      const { authUser } = await authenticateRequest(req);
      sendJson(res, 200, { profile: authUser });
      return;
    }

    if (method === 'GET' && pathname === '/api/auth/me') {
      const { authUser } = await authenticateRequest(req);
      sendJson(res, 200, { profile: authUser });
      return;
    }

    if (method === 'GET' && pathname === '/api/dashboard') {
      const { admin, authUser } = await authenticateRequest(req);
      const today = getJakartaDateString();

      const { data: myTodayAttendance } = await admin
        .from('employee_attendance')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('tanggal', today)
        .maybeSingle();

      const monthPrefix = today.slice(0, 7);
      const { data: myMonthRecords } = await admin
        .from('employee_attendance')
        .select('*')
        .eq('user_id', authUser.id)
        .gte('tanggal', `${monthPrefix}-01`)
        .lte('tanggal', `${monthPrefix}-31`)
        .order('tanggal', { ascending: false });

      let totalStudents = 0;
      let totalUsers = 0;
      const todayStudentSummary = { Hadir: 0, Izin: 0, Sakit: 0, Alpha: 0, totalRecorded: 0 };
      const todayEmployeeSummary = { Hadir: 0, Izin: 0, Sakit: 0, Alpha: 0, totalRecorded: 0 };
      let recentStudentAttendance: unknown[] = [];
      let recentEmployeeAttendance: unknown[] = [];

      if (authUser.role === 'admin' || authUser.role === 'guru') {
        const { count: studentCount } = await admin
          .from('students')
          .select('*', { count: 'exact', head: true });
        totalStudents = studentCount ?? 0;

        const { data: studentAttToday } = await admin
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

        const { data: recentStud } = await admin
          .from('student_attendance')
          .select('*, student:students(id, nis, nama, kelas, jurusan)')
          .order('created_at', { ascending: false })
          .limit(8);
        recentStudentAttendance = recentStud || [];
      }

      if (authUser.role === 'admin') {
        const { count: userCount } = await admin
          .from('profiles')
          .select('*', { count: 'exact', head: true });
        totalUsers = userCount ?? 0;

        const { data: empAttToday } = await admin
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

        const { data: recentEmp } = await admin
          .from('employee_attendance')
          .select('*, profile:profiles(id, full_name, email, role, nip, jabatan)')
          .order('created_at', { ascending: false })
          .limit(8);
        recentEmployeeAttendance = recentEmp || [];
      }

      sendJson(res, 200, {
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
      return;
    }

    if (method === 'GET' && pathname === '/api/attendance/employee/me') {
      const { admin, authUser } = await authenticateRequest(req);
      const today = getJakartaDateString();
      const month = query.get('month') || today.slice(0, 7);

      const { data: todayRecord, error: todayErr } = await admin
        .from('employee_attendance')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('tanggal', today)
        .maybeSingle();

      if (todayErr) throw todayErr;

      const { data: history, error: histErr } = await admin
        .from('employee_attendance')
        .select('*')
        .eq('user_id', authUser.id)
        .gte('tanggal', `${month}-01`)
        .lte('tanggal', `${month}-31`)
        .order('tanggal', { ascending: false });

      if (histErr) throw histErr;

      sendJson(res, 200, {
        today,
        todayRecord: todayRecord || null,
        history: history || [],
      });
      return;
    }

    if (method === 'POST' && pathname === '/api/attendance/employee/check-in') {
      const { admin, authUser } = await authenticateRequest(req);
      const today = getJakartaDateString();
      const nowIso = new Date().toISOString();
      const body = await readJsonBody(req);
      const status = String(body.status || 'Hadir');
      const catatan = String(body.catatan || '');

      if (!['Hadir', 'Izin', 'Sakit'].includes(status)) {
        sendJson(res, 400, { error: 'Status absensi mandiri harus Hadir, Izin, atau Sakit.' });
        return;
      }

      const { data: existing } = await admin
        .from('employee_attendance')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('tanggal', today)
        .maybeSingle();

      if (existing) {
        sendJson(res, 400, { error: 'Anda sudah melakukan pencatatan absensi untuk hari ini.' });
        return;
      }

      const { data, error } = await admin
        .from('employee_attendance')
        .insert({
          user_id: authUser.id,
          tanggal: today,
          check_in: status === 'Hadir' ? nowIso : null,
          status,
          catatan: catatan.trim(),
        })
        .select('*')
        .single();

      if (error) throw error;
      sendJson(res, 201, { record: data });
      return;
    }

    if (method === 'POST' && pathname === '/api/attendance/employee/check-out') {
      const { admin, authUser } = await authenticateRequest(req);
      const today = getJakartaDateString();
      const nowIso = new Date().toISOString();

      const { data: existing, error: findErr } = await admin
        .from('employee_attendance')
        .select('*')
        .eq('user_id', authUser.id)
        .eq('tanggal', today)
        .maybeSingle();

      if (findErr) throw findErr;
      if (!existing) {
        sendJson(res, 400, { error: 'Anda belum melakukan absen masuk hari ini.' });
        return;
      }
      if (existing.status !== 'Hadir') {
        sendJson(res, 400, { error: 'Absen pulang hanya berlaku untuk status Hadir.' });
        return;
      }
      if (existing.check_out) {
        sendJson(res, 400, { error: 'Anda sudah melakukan absen pulang hari ini.' });
        return;
      }

      const { data, error } = await admin
        .from('employee_attendance')
        .update({ check_out: nowIso, updated_at: nowIso })
        .eq('id', existing.id)
        .select('*')
        .single();

      if (error) throw error;
      sendJson(res, 200, { record: data });
      return;
    }

    if (method === 'GET' && pathname === '/api/majors') {
      const { admin } = await authenticateRequest(req);
      const { data, error } = await admin
        .from('majors')
        .select('*')
        .order('code', { ascending: true });
      if (error) throw error;
      sendJson(res, 200, { majors: data || [] });
      return;
    }

    if (method === 'GET' && pathname === '/api/classes') {
      const { admin, authUser } = await authenticateRequest(req);
      assertRole(authUser, ['admin', 'guru']);
      const { data, error } = await admin
        .from('classes')
        .select('*, major:majors(code, name, rumpun), wali_kelas:profiles(id, full_name)')
        .order('name', { ascending: true });
      if (error) throw error;
      sendJson(res, 200, { classes: data || [] });
      return;
    }

    if (method === 'GET' && pathname === '/api/students') {
      const { admin, authUser } = await authenticateRequest(req);
      assertRole(authUser, ['admin', 'guru']);
      const { data, error } = await admin
        .from('students')
        .select('*, class_info:classes(id, name, tingkat, major_code), major:majors(code, name, rumpun)')
        .order('kelas', { ascending: true })
        .order('nama', { ascending: true });

      if (error) {
        const { data: fallbackData, error: fallbackErr } = await admin
          .from('students')
          .select('*')
          .order('kelas', { ascending: true })
          .order('nama', { ascending: true });
        if (fallbackErr) throw fallbackErr;
        sendJson(res, 200, { students: fallbackData || [] });
        return;
      }

      sendJson(res, 200, { students: data || [] });
      return;
    }

    if (method === 'POST' && pathname === '/api/students') {
      const { admin, authUser } = await authenticateRequest(req);
      assertRole(authUser, ['admin']);
      const body = await readJsonBody(req);
      const nis = String(body.nis || '');
      const nama = String(body.nama || '');
      const kelas = String(body.kelas || '');
      const jurusan = String(body.jurusan || '');

      if (!nis || !nama || !kelas || !jurusan) {
        sendJson(res, 400, { error: 'NIS, Nama, Kelas, dan Jurusan wajib diisi.' });
        return;
      }

      const classId = await resolveClassId(admin, kelas, jurusan.trim());
      const { data, error } = await admin
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
          sendJson(res, 400, { error: 'NIS siswa sudah terdaftar.' });
          return;
        }
        throw error;
      }

      sendJson(res, 201, { student: data });
      return;
    }

    const studentIdMatch = pathname.match(/^\/api\/students\/([^/]+)$/);
    if (studentIdMatch) {
      const id = decodeURIComponent(studentIdMatch[1]);

      if (method === 'PUT') {
        const { admin, authUser } = await authenticateRequest(req);
        assertRole(authUser, ['admin']);
        const body = await readJsonBody(req);
        const nis = String(body.nis || '');
        const nama = String(body.nama || '');
        const kelas = String(body.kelas || '');
        const jurusan = String(body.jurusan || '');

        if (!nis || !nama || !kelas || !jurusan) {
          sendJson(res, 400, { error: 'NIS, Nama, Kelas, dan Jurusan wajib diisi.' });
          return;
        }

        const classId = await resolveClassId(admin, kelas, jurusan.trim());
        const { data, error } = await admin
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
        sendJson(res, 200, { student: data });
        return;
      }

      if (method === 'DELETE') {
        const { admin, authUser } = await authenticateRequest(req);
        assertRole(authUser, ['admin']);
        const { error } = await admin.from('students').delete().eq('id', id);
        if (error) throw error;
        sendJson(res, 200, { success: true });
        return;
      }
    }

    if (method === 'GET' && pathname === '/api/attendance/student') {
      const { admin, authUser } = await authenticateRequest(req);
      assertRole(authUser, ['admin', 'guru']);
      const tanggal = query.get('tanggal') || getJakartaDateString();

      const { data: students, error: studErr } = await admin
        .from('students')
        .select('*')
        .order('kelas', { ascending: true })
        .order('nama', { ascending: true });

      if (studErr) throw studErr;

      const { data: attendanceRows, error: attErr } = await admin
        .from('student_attendance')
        .select('*')
        .eq('tanggal', tanggal);

      if (attErr) throw attErr;

      sendJson(res, 200, {
        tanggal,
        students: students || [],
        records: attendanceRows || [],
      });
      return;
    }

    if (method === 'POST' && pathname === '/api/attendance/student/batch') {
      const { admin, authUser } = await authenticateRequest(req);
      assertRole(authUser, ['admin', 'guru']);
      const body = await readJsonBody(req);
      const tanggal = String(body.tanggal || '');
      const items = Array.isArray(body.items)
        ? (body.items as Array<{
            student_id: string;
            status: 'Hadir' | 'Izin' | 'Sakit' | 'Alpha';
            catatan?: string;
          }>)
        : [];

      if (!tanggal || items.length === 0) {
        sendJson(res, 400, { error: 'Tanggal dan daftar absensi siswa wajib diisi.' });
        return;
      }

      const nowIso = new Date().toISOString();
      const payload = items.map((item) => ({
        student_id: item.student_id,
        recorded_by: authUser.id,
        tanggal,
        status: item.status,
        catatan: String(item.catatan || '').trim(),
        updated_at: nowIso,
      }));

      const { data, error } = await admin
        .from('student_attendance')
        .upsert(payload, { onConflict: 'student_id,tanggal' })
        .select('*');

      if (error) throw error;
      sendJson(res, 200, { savedCount: data?.length ?? payload.length, records: data || [] });
      return;
    }

    if (method === 'GET' && pathname === '/api/rekap/karyawan') {
      const { admin, authUser } = await authenticateRequest(req);
      assertRole(authUser, ['admin']);
      const today = getJakartaDateString();
      const startDate = query.get('startDate') || `${today.slice(0, 7)}-01`;
      const endDate = query.get('endDate') || today;

      const { data, error } = await admin
        .from('employee_attendance')
        .select('*, profile:profiles(id, full_name, email, role, nip, jabatan)')
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false });

      if (error) throw error;
      sendJson(res, 200, { records: data || [] });
      return;
    }

    if (method === 'GET' && pathname === '/api/rekap/siswa') {
      const { admin, authUser } = await authenticateRequest(req);
      assertRole(authUser, ['admin', 'guru']);
      const today = getJakartaDateString();
      const startDate = query.get('startDate') || `${today.slice(0, 7)}-01`;
      const endDate = query.get('endDate') || today;

      const { data, error } = await admin
        .from('student_attendance')
        .select(
          '*, student:students(id, nis, nama, kelas, jurusan), recorder:profiles(id, full_name, role)'
        )
        .gte('tanggal', startDate)
        .lte('tanggal', endDate)
        .order('tanggal', { ascending: false });

      if (error) throw error;
      sendJson(res, 200, { records: data || [] });
      return;
    }

    if (method === 'GET' && pathname === '/api/users') {
      const { admin, authUser } = await authenticateRequest(req);
      assertRole(authUser, ['admin']);

      const { data: authUsersData, error: authErr } = await admin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (authErr) throw authErr;

      for (const au of authUsersData.users) {
        await ensureUserProfile(admin, au);
      }

      const { data: profiles, error: profErr } = await admin
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: true });

      if (profErr) throw profErr;

      sendJson(res, 200, { users: profiles || [] });
      return;
    }

    if (method === 'POST' && pathname === '/api/users') {
      const { admin, authUser } = await authenticateRequest(req);
      assertRole(authUser, ['admin']);
      const body = await readJsonBody(req);
      const email = String(body.email || '');
      const password = String(body.password || '');
      const full_name = String(body.full_name || '');
      const role = String(body.role || '') as UserRole;
      const nip = String(body.nip || '');
      const jabatan = String(body.jabatan || '');

      if (!email || !password || !full_name || !role) {
        sendJson(res, 400, { error: 'Nama lengkap, email, password, dan role wajib diisi.' });
        return;
      }

      if (!['admin', 'guru', 'tenaga_kependidikan'].includes(role)) {
        sendJson(res, 400, { error: 'Role tidak valid.' });
        return;
      }

      if (password.length < 6) {
        sendJson(res, 400, { error: 'Kata sandi minimal 6 karakter.' });
        return;
      }

      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email: email.trim().toLowerCase(),
        password,
        email_confirm: true,
        user_metadata: {
          full_name: full_name.trim(),
          role,
          nip: nip.trim(),
          jabatan: jabatan.trim(),
        },
      });

      if (createErr || !created.user) {
        sendJson(res, 400, { error: createErr?.message || 'Gagal membuat user di Supabase Auth.' });
        return;
      }

      const { data: profile, error: upsertErr } = await admin
        .from('profiles')
        .upsert(
          {
            id: created.user.id,
            email: email.trim().toLowerCase(),
            full_name: full_name.trim(),
            role,
            nip: nip.trim(),
            jabatan: jabatan.trim(),
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        )
        .select('*')
        .single();

      if (upsertErr) throw upsertErr;
      sendJson(res, 201, { user: profile });
      return;
    }

    const userIdMatch = pathname.match(/^\/api\/users\/([^/]+)$/);
    if (userIdMatch) {
      const id = decodeURIComponent(userIdMatch[1]);

      if (method === 'PUT') {
        const { admin, authUser } = await authenticateRequest(req);
        assertRole(authUser, ['admin']);
        const body = await readJsonBody(req);
        const email = String(body.email || '');
        const password = String(body.password || '');
        const full_name = String(body.full_name || '');
        const role = String(body.role || '') as UserRole;
        const nip = String(body.nip || '');
        const jabatan = String(body.jabatan || '');

        if (!email || !full_name || !role) {
          sendJson(res, 400, { error: 'Nama lengkap, email, dan role wajib diisi.' });
          return;
        }

        if (!['admin', 'guru', 'tenaga_kependidikan'].includes(role)) {
          sendJson(res, 400, { error: 'Role tidak valid.' });
          return;
        }

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
            nip: nip.trim(),
            jabatan: jabatan.trim(),
          },
        };

        if (password && password.trim().length > 0) {
          if (password.trim().length < 6) {
            sendJson(res, 400, { error: 'Kata sandi baru minimal 6 karakter.' });
            return;
          }
          authUpdatePayload.password = password.trim();
        }

        const { error: authUpdateErr } = await admin.auth.admin.updateUserById(
          id,
          authUpdatePayload
        );
        if (authUpdateErr) {
          sendJson(res, 400, { error: authUpdateErr.message });
          return;
        }

        const { data: updatedProfile, error: profErr } = await admin
          .from('profiles')
          .update({
            email: email.trim().toLowerCase(),
            full_name: full_name.trim(),
            role,
            nip: nip.trim(),
            jabatan: jabatan.trim(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select('*')
          .single();

        if (profErr) throw profErr;
        sendJson(res, 200, { user: updatedProfile });
        return;
      }

      if (method === 'DELETE') {
        const { admin, authUser } = await authenticateRequest(req);
        assertRole(authUser, ['admin']);

        if (id === authUser.id) {
          sendJson(res, 400, {
            error: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.',
          });
          return;
        }

        const { error: deleteAuthErr } = await admin.auth.admin.deleteUser(id, false);
        if (deleteAuthErr) {
          sendJson(res, 400, { error: deleteAuthErr.message });
          return;
        }

        await admin.from('profiles').delete().eq('id', id);
        sendJson(res, 200, { success: true, hardDeletedId: id });
        return;
      }
    }

    sendJson(res, 404, { error: `Endpoint API tidak ditemukan: ${method} ${pathname}` });
  } catch (err) {
    if (err instanceof HttpError) {
      sendJson(res, err.statusCode, {
        error: err.message,
        ...(err.code ? { code: err.code } : {}),
      });
      return;
    }

    const message =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message: unknown }).message)
        : 'Terjadi kesalahan internal pada server API.';

    console.error('[API Error]:', err);
    sendJson(res, 500, { error: message });
  }
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  await handleApiRequest(req, res);
}
