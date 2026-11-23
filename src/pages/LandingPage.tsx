import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  GraduationCap,
  MapPin,
  Phone,
  Mail,
  Users,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { JURUSAN_LIST } from '../types';

function ImageWithFallback({
  src,
  alt,
  className,
  fallbackTitle,
}: {
  src: string;
  alt: string;
  className: string;
  fallbackTitle: string;
}) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={`${className} bg-gradient-to-br from-red-900 via-red-800 to-slate-900 flex flex-col items-center justify-center p-8 text-white text-center`}
      >
        <GraduationCap className="w-10 h-10 mb-3 opacity-80" />
        <p className="text-sm font-semibold tracking-tight">{fallbackTitle}</p>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}

export default function LandingPage() {
  const { user } = useAuth();

  const bidangGroups = [
    {
      number: '01',
      title: 'Bidang Teknologi & Media Kreatif',
      description:
        'Mempersiapkan talenta infrastruktur jaringan, desain visual modern, dan produksi penyiaran standar industri.',
      majors: JURUSAN_LIST.filter((j) => ['TKJ', 'DKV', 'BC'].includes(j.code)),
    },
    {
      number: '02',
      title: 'Bidang Manajemen & Layanan Bisnis',
      description:
        'Membentuk tenaga profesional tata kelola perkantoran digital, korespondensi korporat, dan pelayanan publik.',
      majors: JURUSAN_LIST.filter((j) => j.code === 'MPLB'),
    },
    {
      number: '03',
      title: 'Bidang Keuangan & Niaga Digital',
      description:
        'Mengembangkan keahlian pencatatan akuntansi terkomputerisasi, perpajakan, serta pemasaran niaga digital.',
      majors: JURUSAN_LIST.filter((j) => ['AK', 'BD'].includes(j.code)),
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <Link
            to="/"
            className="text-lg font-bold tracking-tight text-red-700 whitespace-nowrap shrink-0"
          >
            SMK Prima Unggul
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a
              href="#profil"
              className="hover:text-red-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Profil
            </a>
            <a
              href="#jurusan"
              className="hover:text-red-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Jurusan
            </a>
            <a
              href="#sistem-absensi"
              className="hover:text-red-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Sistem Absensi
            </a>
            <a
              href="#kontak"
              className="hover:text-red-700 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              Kontak
            </a>
          </nav>

          <div className="shrink-0">
            <Link
              to={user ? '/app/dashboard' : '/login'}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-700 rounded-lg hover:bg-red-800 transition-colors whitespace-nowrap shrink-0"
            >
              {user ? 'Buka Aplikasi' : 'Masuk Portal'}
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="max-w-7xl mx-auto px-6 pt-12 pb-16 lg:pt-16 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-between py-2">
              <div>
                <p className="text-xs font-semibold tracking-wide text-red-700 mb-4">
                  Sekolah Menengah Kejuruan Terakreditasi A · Tangerang
                </p>
                <h1
                  className="font-extrabold tracking-tight text-slate-900 leading-[1.12] mb-6"
                  style={{ fontSize: 'clamp(2.25rem, 4vw, 3.5rem)', textWrap: 'balance' }}
                >
                  Pendidikan Vokasi Unggul Berbasis Disiplin dan Teknologi.
                </h1>
                <p className="text-base lg:text-lg text-slate-600 leading-relaxed max-w-xl mb-8">
                  SMK Prima Unggul mencetak lulusan siap kerja dan berkarakter melalui 3 bidang
                  keahlian utama dengan 6 kompetensi jurusan unggulan: TKJ, DKV, AK, BC, MPLB,
                  dan BD, didukung sistem presensi digital terpadu bagi seluruh sivitas sekolah.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-4">
                <Link
                  to={user ? '/app/dashboard' : '/login'}
                  className="inline-flex items-center gap-2.5 px-6 py-3 text-sm font-semibold text-white bg-red-700 rounded-lg hover:bg-red-800 transition-colors whitespace-nowrap shrink-0"
                >
                  {user ? 'Masuk ke Dashboard' : 'Masuk Sistem Absensi'}
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#jurusan"
                  className="inline-flex items-center px-5 py-3 text-sm font-semibold text-slate-700 border border-slate-300 rounded-lg hover:border-red-700 hover:text-red-700 transition-colors whitespace-nowrap shrink-0"
                >
                  Pelajari Kompetensi Jurusan
                </a>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="h-72 sm:h-96 lg:h-full min-h-[340px] rounded-xl overflow-hidden border border-slate-200 bg-slate-100">
                <ImageWithFallback
                  src="/src/assets/images/hero_smk_campus_1795061357783.jpg"
                  alt="Gedung Kampus Modern SMK Prima Unggul"
                  fallbackTitle="Kampus SMK Prima Unggul"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>

          {/* 4-Column Full-Width Metric Strip below Hero */}
          <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 border border-slate-200 rounded-xl divide-y lg:divide-y-0 lg:divide-x divide-slate-200 bg-slate-50/70">
            <div className="p-6">
              <p className="text-2xl lg:text-3xl font-bold text-red-700 tabular-nums">3 Bidang</p>
              <p className="text-sm text-slate-600 mt-1">Rumpun Keahlian Utama</p>
            </div>
            <div className="p-6">
              <p className="text-2xl lg:text-3xl font-bold text-slate-900 tabular-nums">6 Jurusan</p>
              <p className="text-sm text-slate-600 mt-1">TKJ · DKV · AK · BC · MPLB · BD</p>
            </div>
            <div className="p-6">
              <p className="text-2xl lg:text-3xl font-bold text-slate-900 tabular-nums">3 Peran</p>
              <p className="text-sm text-slate-600 mt-1">Admin, Guru &amp; Tendik</p>
            </div>
            <div className="p-6">
              <p className="text-2xl lg:text-3xl font-bold text-slate-900 tabular-nums">100%</p>
              <p className="text-sm text-slate-600 mt-1">Presensi Terintegrasi Cloud</p>
            </div>
          </div>
        </section>

        {/* Profil SMK Prima Unggul */}
        <section id="profil" className="border-t border-slate-200 bg-slate-50/60 py-16 lg:py-20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-5">
                <div className="aspect-[4/3] rounded-xl overflow-hidden border border-slate-200 bg-white">
                  <ImageWithFallback
                    src="/src/assets/images/lab_tkj_dkv_1795061357594.jpg"
                    alt="Laboratorium Komputer dan Desain SMK Prima Unggul"
                    fallbackTitle="Laboratorium Praktik Kejuruan"
                    className="w-full h-full object-cover"
                  />
                </div>
              </div>
              <div className="lg:col-span-7">
                <p className="text-sm font-semibold text-red-700 mb-2">Profil Institusi</p>
                <h2 className="text-2xl lg:text-3xl font-bold tracking-tight text-slate-900 mb-5">
                  Membangun Kompetensi Vokasi Berstandar Industri
                </h2>
                <p className="text-slate-600 leading-relaxed mb-6">
                  SMK Prima Unggul adalah lembaga pendidikan menengah kejuruan yang memadukan
                  kurikulum nasional berbasis praktik industri, sertifikasi kompetensi profesi,
                  dan tata kelola sekolah berbasis sistem informasi modern. Setiap peserta didik
                  dibimbing langsung oleh tenaga pendidik tersertifikasi di laboratorium khusus
                  masing-masing jurusan.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-4 border-t border-slate-200">
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-1.5">
                      Kedisiplinan Terukur
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Pemantauan kehadiran siswa dan seluruh karyawan tercatat real-time setiap
                      hari sekolah untuk menjamin ketertiban akademik.
                    </p>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 mb-1.5">
                      Fasilitas Studio &amp; Lab Modern
                    </h3>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Dilengkapi laboratorium jaringan komputer, studio desain, ruang siaran
                      broadcasting, dan simulasi perkantoran digital.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3 Rumpun Bidang & 6 Jurusan */}
        <section id="jurusan" className="py-16 lg:py-24 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end mb-14">
              <div className="lg:col-span-7">
                <p className="text-sm font-semibold text-red-700 mb-2">Program Keahlian</p>
                <h2 className="text-2xl lg:text-4xl font-bold tracking-tight text-slate-900">
                  3 Bidang Keahlian dengan 6 Kompetensi Jurusan Unggulan
                </h2>
              </div>
              <div className="lg:col-span-5">
                <p className="text-sm lg:text-base text-slate-600 leading-relaxed">
                  Seluruh kurikulum dirancang selaras dengan kebutuhan industri masa kini mencakup
                  TKJ, DKV, AK, BC, MPLB, dan BD.
                </p>
              </div>
            </div>

            <div className="space-y-8">
              {bidangGroups.map((group) => (
                <div
                  key={group.number}
                  className="border border-slate-200 rounded-xl p-6 lg:p-8 bg-white"
                >
                  <div className="flex flex-col lg:flex-row lg:items-baseline justify-between gap-4 pb-6 border-b border-slate-200">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900">
                        {group.number}. {group.title}
                      </h3>
                      <p className="text-sm text-slate-600 mt-1 max-w-2xl">{group.description}</p>
                    </div>
                    <span className="text-xs font-semibold text-red-700 tabular-nums shrink-0">
                      {group.majors.length} Kompetensi Keahlian
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
                    {group.majors.map((major) => (
                      <div key={major.code} className="flex flex-col justify-between">
                        <div>
                          <div className="flex items-baseline gap-2.5 mb-2">
                            <span className="font-mono text-sm font-bold text-red-700">
                              {major.code}
                            </span>
                            <span className="text-slate-300" aria-hidden="true">
                              /
                            </span>
                            <h4 className="text-base font-bold text-slate-900">{major.name}</h4>
                          </div>
                          <p className="text-sm text-slate-600 leading-relaxed">{major.summary}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sistem Absensi Terpadu Showcase */}
        <section
          id="sistem-absensi"
          className="border-t border-slate-200 bg-slate-950 text-white py-16 lg:py-24"
        >
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
              <div className="lg:col-span-6">
                <p className="text-sm font-semibold text-red-400 mb-2">
                  Portal Presensi Terintegrasi
                </p>
                <h2 className="text-2xl lg:text-4xl font-bold tracking-tight text-white mb-5">
                  Satu Sistem untuk Absensi Siswa dan Karyawan
                </h2>
                <p className="text-slate-300 leading-relaxed mb-8">
                  Terhubung langsung ke Supabase Authentication dan database PostgreSQL untuk
                  menjamin keakuratan data kehadiran harian seluruh warga sekolah.
                </p>

                <div className="space-y-5">
                  <div className="flex items-start gap-4 pb-5 border-b border-slate-800">
                    <Building2 className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-base font-semibold text-white">Administrator</h3>
                      <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                        Mengelola seluruh data siswa, manajemen user terhubung penuh dengan
                        Supabase Auth (termasuk penghapusan permanen), serta memantau rekap
                        absensi karyawan dan siswa.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 pb-5 border-b border-slate-800">
                    <ClipboardCheck className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-base font-semibold text-white">Guru</h3>
                      <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                        Melakukan absensi karyawan secara mandiri, menginput presensi siswa per
                        kelas dan tanggal, serta meninjau rekap absensi siswa.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4">
                    <Users className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="text-base font-semibold text-white">Tenaga Kependidikan</h3>
                      <p className="text-sm text-slate-300 mt-1 leading-relaxed">
                        Mengakses dashboard harian dan mencatat kehadiran mandiri (jam masuk, jam
                        pulang, izin, atau sakit) secara cepat dan transparan.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-8">
                  <Link
                    to={user ? '/app/dashboard' : '/login'}
                    className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-red-700 rounded-lg hover:bg-red-600 transition-colors whitespace-nowrap shrink-0"
                  >
                    {user ? 'Buka Dashboard Aplikasi' : 'Login ke Portal Absensi'}
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>

              <div className="lg:col-span-6">
                <div className="aspect-[4/3] rounded-xl overflow-hidden border border-slate-800 bg-slate-900">
                  <ImageWithFallback
                    src="/src/assets/images/studio_bc_digital_1795061357147.jpg"
                    alt="Studio Broadcasting dan Bisnis Digital SMK Prima Unggul"
                    fallbackTitle="Studio Broadcasting SMK Prima Unggul"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-red-400" />
                    Sinkronisasi Supabase Authentication
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-red-400" />
                    Ekspor Laporan Format CSV
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Quiet Footer */}
      <footer id="kontak" className="border-t border-slate-200 bg-white py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pb-8 border-b border-slate-200">
            <div>
              <p className="text-lg font-bold text-red-700 mb-2">SMK Prima Unggul</p>
              <p className="text-sm text-slate-600 leading-relaxed max-w-xs">
                Sekolah Menengah Kejuruan berbasis kompetensi industri dan kedisiplinan digital.
              </p>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <p className="font-semibold text-slate-900 mb-2">Alamat &amp; Kontak</p>
              <p className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-red-700 shrink-0 mt-0.5" />
                <span>Jl. Raya Pendidikan No. 88, Kota Tangerang, Banten</span>
              </p>
              <p className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-red-700 shrink-0" />
                <span className="tabular-nums">(021) 5576-8890</span>
              </p>
              <p className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-red-700 shrink-0" />
                <span>info@smkprimaunggul.sch.id</span>
              </p>
            </div>
            <div className="space-y-2 text-sm text-slate-600">
              <p className="font-semibold text-slate-900 mb-2">Tautan Cepat</p>
              <div className="flex flex-col gap-1.5">
                <a href="#profil" className="hover:text-red-700 transition-colors w-fit">
                  Profil Sekolah
                </a>
                <a href="#jurusan" className="hover:text-red-700 transition-colors w-fit">
                  Program Keahlian
                </a>
                <Link to="/login" className="hover:text-red-700 transition-colors w-fit">
                  Portal Login Karyawan &amp; Admin
                </Link>
              </div>
            </div>
          </div>
          <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <p>&copy; {new Date().getFullYear()} SMK Prima Unggul. Hak cipta dilindungi.</p>
            <p>Sistem Informasi Absensi Siswa &amp; Karyawan</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
