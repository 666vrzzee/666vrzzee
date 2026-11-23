import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader2, LogIn, UserPlus, AlertCircle, Info } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function LoginPage() {
  const { user, profile, loading, supabaseConfigured, signIn, registerUser } = useAuth();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [hasUsers, setHasUsers] = useState<boolean | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [nip, setNip] = useState('');
  const [jabatan, setJabatan] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  useEffect(() => {
    let active = true;
    fetch('/api/auth/first-user-status')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (active && data && typeof data.hasUsers === 'boolean') {
          setHasUsers(data.hasUsers);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (!loading && user && profile) {
    return <Navigate to="/app/dashboard" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSubmitting(true);

    try {
      if (mode === 'login') {
        await signIn(email, password);
        navigate('/app/dashboard', { replace: true });
      } else {
        if (!fullName.trim()) {
          throw new Error('Nama lengkap wajib diisi.');
        }
        const res = await registerUser({
          email,
          password,
          full_name: fullName,
          nip,
          jabatan,
        });
        setSuccessMsg(
          res.isFirstAdmin
            ? 'Akun pertama berhasil dibuat dengan peran Administrator.'
            : 'Akun berhasil didaftarkan.'
        );
        navigate('/app/dashboard', { replace: true });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Terjadi kesalahan otentikasi.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col lg:flex-row">
      {/* Left Brand Showcase */}
      <div className="lg:w-5/12 bg-red-800 text-white p-8 lg:p-12 flex flex-col justify-between">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-medium text-red-100 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Beranda
          </Link>

          <div className="mt-12">
            <p className="text-xs font-semibold tracking-wide text-red-200 mb-3">
              Portal Sistem Informasi Akademik
            </p>
            <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight leading-tight">
              SMK Prima Unggul
            </h1>
            <p className="mt-4 text-sm lg:text-base text-red-100 leading-relaxed max-w-md">
              Sistem presensi harian siswa dan karyawan yang terintegrasi dengan otentikasi
              keamanan Supabase untuk Administrator, Guru, dan Tenaga Kependidikan.
            </p>
          </div>
        </div>

        <div className="mt-10 hidden lg:block">
          <div className="rounded-xl overflow-hidden border border-red-700/60 mb-6 aspect-[16/9] bg-red-900">
            <img
              src="/src/assets/images/hero_smk_campus_1795061357783.jpg"
              alt="Kampus SMK Prima Unggul"
              referrerPolicy="no-referrer"
              className="w-full h-full object-cover opacity-90"
            />
          </div>
          <p className="text-xs text-red-200">
            Program Keahlian: TKJ · DKV · AK · BC · MPLB · BD
          </p>
        </div>
      </div>

      {/* Right Auth Form */}
      <div className="flex-1 flex items-center justify-center p-6 sm:p-10 lg:p-16">
        <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-7 sm:p-8">
          <div className="mb-6">
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {mode === 'login' ? 'Masuk ke Portal Absensi' : 'Registrasi Akun Baru'}
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              {mode === 'login'
                ? 'Gunakan email dan kata sandi akun Supabase Anda.'
                : 'Akun pertama yang dibuat otomatis memperoleh peran Admin.'}
            </p>
          </div>

          {!supabaseConfigured && (
            <div className="mb-6 p-4 rounded-lg border border-amber-200 bg-amber-50 text-amber-900 text-sm flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Konfigurasi Supabase Diperlukan</p>
                <p className="mt-1 text-xs leading-relaxed">
                  Atur <code className="font-mono">SUPABASE_URL</code>,{' '}
                  <code className="font-mono">SUPABASE_ANON_KEY</code>, dan{' '}
                  <code className="font-mono">SUPABASE_SERVICE_ROLE_KEY</code> pada environment
                  server serta jalankan <code className="font-mono">supabase/schema.sql</code> di
                  Supabase SQL Editor.
                </p>
              </div>
            </div>
          )}

          {hasUsers === false && (
            <div className="mb-5 p-3.5 rounded-lg border border-red-200 bg-red-50 text-red-900 text-xs flex items-start gap-2.5">
              <Info className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Belum ada pengguna terdaftar. User pertama yang dibuat pada tab{' '}
                <strong>Daftar Akun</strong> akan otomatis ditetapkan sebagai{' '}
                <strong>Administrator</strong>.
              </p>
            </div>
          )}

          {/* Segmented control tabs */}
          <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mb-6">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`py-2 px-3 text-sm font-semibold rounded-md transition-colors whitespace-nowrap ${
                mode === 'login'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Masuk Akun
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('register');
                setErrorMsg('');
                setSuccessMsg('');
              }}
              className={`py-2 px-3 text-sm font-semibold rounded-md transition-colors whitespace-nowrap ${
                mode === 'register'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daftar Akun
            </button>
          </div>

          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-lg border border-red-200 bg-red-50 text-red-800 text-sm flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-800 text-sm">
              {successMsg}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1.5">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Contoh: Budi Santoso, S.Kom"
                    className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      NIP / NUPTK
                    </label>
                    <input
                      type="text"
                      value={nip}
                      onChange={(e) => setNip(e.target.value)}
                      placeholder="Opsional"
                      className="w-full px-3.5 py-2.5 text-sm font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1.5">
                      Jabatan
                    </label>
                    <input
                      type="text"
                      value={jabatan}
                      onChange={(e) => setJabatan(e.target.value)}
                      placeholder="Contoh: Kepala TU"
                      className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                    />
                  </div>
                </div>
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Alamat Email
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@smkprimaunggul.sch.id"
                className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Kata Sandi
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="w-full px-3.5 py-2.5 pr-11 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-700/20 focus:border-red-700"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Lihat kata sandi'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={submitting || !supabaseConfigured}
              className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-red-700 rounded-lg hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : mode === 'login' ? (
                <LogIn className="w-4 h-4" />
              ) : (
                <UserPlus className="w-4 h-4" />
              )}
              {submitting
                ? 'Memproses...'
                : mode === 'login'
                ? 'Masuk ke Aplikasi'
                : 'Daftar & Masuk'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
