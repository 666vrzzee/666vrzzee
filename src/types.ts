export type UserRole = 'admin' | 'guru' | 'tenaga_kependidikan';

export type AttendanceStatus = 'Hadir' | 'Izin' | 'Sakit' | 'Alpha';

export type JurusanCode = 'TKJ' | 'DKV' | 'AK' | 'BC' | 'MPLB' | 'BD';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  nip: string;
  jabatan: string;
  created_at: string;
  updated_at?: string;
}

export interface Student {
  id: string;
  nis: string;
  nama: string;
  class_id?: string | null;
  kelas: string;
  jurusan: JurusanCode;
  created_at: string;
}

export interface EmployeeAttendance {
  id: string;
  user_id: string;
  tanggal: string;
  check_in: string | null;
  check_out: string | null;
  status: AttendanceStatus;
  catatan: string;
  created_at: string;
  profile?: Pick<UserProfile, 'id' | 'full_name' | 'email' | 'role' | 'nip' | 'jabatan'>;
}

export interface StudentAttendance {
  id: string;
  student_id: string;
  recorded_by: string | null;
  tanggal: string;
  status: AttendanceStatus;
  catatan: string;
  created_at: string;
  student?: Student;
  recorder?: Pick<UserProfile, 'id' | 'full_name' | 'role'>;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Administrator',
  guru: 'Guru',
  tenaga_kependidikan: 'Tenaga Kependidikan',
};

export const JURUSAN_LIST: {
  code: JurusanCode;
  name: string;
  rumpun: string;
  summary: string;
}[] = [
  {
    code: 'TKJ',
    name: 'Teknik Komputer dan Jaringan',
    rumpun: 'Teknologi & Infrastruktur Digital',
    summary: 'Administrasi server, jaringan fiber optik, keamanan siber, dan infrastruktur cloud.',
  },
  {
    code: 'DKV',
    name: 'Desain Komunikasi Visual',
    rumpun: 'Teknologi & Infrastruktur Digital',
    summary: 'Desain identitas merek, ilustrasi editorial, UI/UX, dan produksi media visual.',
  },
  {
    code: 'BC',
    name: 'Broadcasting dan Perfilman',
    rumpun: 'Teknologi & Infrastruktur Digital',
    summary: 'Sinematografi, tata kamera, penyutradaraan, penyiaran langsung, dan pascaproduksi.',
  },
  {
    code: 'MPLB',
    name: 'Manajemen Perkantoran dan Layanan Bisnis',
    rumpun: 'Manajemen & Layanan Bisnis',
    summary: 'Tata kelola administrasi modern, kearsipan digital, korespondensi, dan layanan korporat.',
  },
  {
    code: 'AK',
    name: 'Akuntansi',
    rumpun: 'Keuangan & Niaga Digital',
    summary: 'Pelaporan keuangan standar industri, perpajakan, audit dasar, dan sistem akuntansi digital.',
  },
  {
    code: 'BD',
    name: 'Bisnis Digital',
    rumpun: 'Keuangan & Niaga Digital',
    summary: 'E-commerce, pemasaran berbasis data, analitik penjualan, dan kewirausahaan digital.',
  },
];

export const ATTENDANCE_STATUSES: AttendanceStatus[] = ['Hadir', 'Izin', 'Sakit', 'Alpha'];
