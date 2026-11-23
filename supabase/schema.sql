-- ============================================================================
-- SKEMA DATABASE RELASIONAL SUPABASE - SMK PRIMA UNGGUL
-- Jalankan script ini pada SQL Editor di Dashboard Supabase Anda.
--
-- Diagram Relasi Utama:
--   auth.users (1) ──< (1) profiles
--   profiles   (1) ──< (N) employee_attendance (user_id)
--   profiles   (1) ──< (N) student_attendance  (recorded_by)
--   profiles   (1) ──< (N) classes             (wali_kelas_id)
--   majors     (1) ──< (N) classes             (major_code)
--   majors     (1) ──< (N) students            (jurusan)
--   classes    (1) ──< (N) students            (class_id)
--   students   (1) ──< (N) student_attendance  (student_id)
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 1. Tabel Profiles (Terhubung 1-to-1 ke auth.users dengan ON DELETE CASCADE)
-- ----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('admin', 'guru', 'tenaga_kependidikan')),
  nip text default '',
  jabatan text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. Trigger Otomatis: User Pertama di Supabase Authentication menjadi ADMIN
-- ----------------------------------------------------------------------------
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  user_count integer;
  assigned_role text;
begin
  select count(*) into user_count from public.profiles;

  if user_count = 0 then
    assigned_role := 'admin';
  else
    assigned_role := coalesce(new.raw_user_meta_data->>'role', 'tenaga_kependidikan');
    if assigned_role not in ('admin', 'guru', 'tenaga_kependidikan') then
      assigned_role := 'tenaga_kependidikan';
    end if;
  end if;

  insert into public.profiles (id, email, full_name, role, nip, jabatan)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), split_part(coalesce(new.email, 'Pengguna'), '@', 1)),
    assigned_role,
    coalesce(new.raw_user_meta_data->>'nip', ''),
    coalesce(new.raw_user_meta_data->>'jabatan', '')
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_auth_user();

-- ----------------------------------------------------------------------------
-- 3. Tabel Master Jurusan / Program Keahlian (majors)
-- ----------------------------------------------------------------------------
create table if not exists public.majors (
  code text primary key check (code in ('TKJ', 'DKV', 'AK', 'BC', 'MPLB', 'BD')),
  name text not null,
  rumpun text not null,
  created_at timestamptz not null default now()
);

insert into public.majors (code, name, rumpun) values
  ('TKJ', 'Teknik Komputer dan Jaringan', 'Teknologi & Media Kreatif'),
  ('DKV', 'Desain Komunikasi Visual', 'Teknologi & Media Kreatif'),
  ('BC', 'Broadcasting dan Perfilman', 'Teknologi & Media Kreatif'),
  ('MPLB', 'Manajemen Perkantoran dan Layanan Bisnis', 'Manajemen & Layanan Bisnis'),
  ('AK', 'Akuntansi', 'Keuangan & Niaga Digital'),
  ('BD', 'Bisnis Digital', 'Keuangan & Niaga Digital')
on conflict (code) do update set
  name = excluded.name,
  rumpun = excluded.rumpun;

-- ----------------------------------------------------------------------------
-- 4. Tabel Master Kelas (classes) -> berelasi ke majors & profiles (wali kelas)
-- ----------------------------------------------------------------------------
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  tingkat text not null default 'X' check (tingkat in ('X', 'XI', 'XII')),
  major_code text not null references public.majors(code) on update cascade on delete restrict,
  wali_kelas_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed kelas awal standar SMK Prima Unggul (opsional, aman dijalankan ulang)
insert into public.classes (name, tingkat, major_code) values
  ('X TKJ 1', 'X', 'TKJ'),
  ('X DKV 1', 'X', 'DKV'),
  ('X BC 1', 'X', 'BC'),
  ('X MPLB 1', 'X', 'MPLB'),
  ('X AK 1', 'X', 'AK'),
  ('X BD 1', 'X', 'BD')
on conflict (name) do nothing;

-- ----------------------------------------------------------------------------
-- 5. Tabel Data Siswa (students) -> berelasi ke classes & majors
-- ----------------------------------------------------------------------------
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  nis text not null unique,
  nama text not null,
  class_id uuid references public.classes(id) on update cascade on delete set null,
  kelas text not null,
  jurusan text not null references public.majors(code) on update cascade on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Trigger otomatis sinkronisasi class_id pada tabel students berdasarkan nama kelas & jurusan
create or replace function public.sync_student_class_relation()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  matched_class_id uuid;
  detected_tingkat text;
begin
  if new.class_id is null and new.kelas is not null and trim(new.kelas) <> '' then
    select id into matched_class_id
    from public.classes
    where lower(name) = lower(trim(new.kelas))
    limit 1;

    if matched_class_id is null then
      if upper(trim(new.kelas)) like 'XII%' then
        detected_tingkat := 'XII';
      elsif upper(trim(new.kelas)) like 'XI%' then
        detected_tingkat := 'XI';
      else
        detected_tingkat := 'X';
      end if;

      insert into public.classes (name, tingkat, major_code)
      values (trim(new.kelas), detected_tingkat, new.jurusan)
      on conflict (name) do update set major_code = excluded.major_code
      returning id into matched_class_id;
    end if;

    new.class_id := matched_class_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_student_class on public.students;
create trigger trg_sync_student_class
  before insert or update on public.students
  for each row execute procedure public.sync_student_class_relation();

-- ----------------------------------------------------------------------------
-- 6. Tabel Absensi Karyawan (employee_attendance) -> berelasi ke profiles
-- ----------------------------------------------------------------------------
create table if not exists public.employee_attendance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tanggal date not null default current_date,
  check_in timestamptz,
  check_out timestamptz,
  status text not null check (status in ('Hadir', 'Izin', 'Sakit', 'Alpha')),
  catatan text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, tanggal)
);

-- ----------------------------------------------------------------------------
-- 7. Tabel Absensi Siswa (student_attendance) -> berelasi ke students & profiles
-- ----------------------------------------------------------------------------
create table if not exists public.student_attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  recorded_by uuid references public.profiles(id) on delete set null,
  tanggal date not null default current_date,
  status text not null check (status in ('Hadir', 'Izin', 'Sakit', 'Alpha')),
  catatan text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (student_id, tanggal)
);

-- ----------------------------------------------------------------------------
-- 8. Index Performa Query & Foreign Keys
-- ----------------------------------------------------------------------------
create index if not exists idx_classes_major_code on public.classes(major_code);
create index if not exists idx_students_class_id on public.students(class_id);
create index if not exists idx_students_jurusan on public.students(jurusan);
create index if not exists idx_emp_att_user_tanggal on public.employee_attendance(user_id, tanggal desc);
create index if not exists idx_emp_att_tanggal on public.employee_attendance(tanggal desc);
create index if not exists idx_stud_att_student_tanggal on public.student_attendance(student_id, tanggal desc);
create index if not exists idx_stud_att_tanggal on public.student_attendance(tanggal desc);
create index if not exists idx_stud_att_recorded_by on public.student_attendance(recorded_by);

-- ----------------------------------------------------------------------------
-- 9. Relational Views untuk Pelaporan Cepat
-- ----------------------------------------------------------------------------
create or replace view public.v_employee_attendance_detail as
select
  ea.id,
  ea.tanggal,
  ea.check_in,
  ea.check_out,
  ea.status,
  ea.catatan,
  p.id as user_id,
  p.full_name,
  p.email,
  p.role,
  p.nip,
  p.jabatan
from public.employee_attendance ea
join public.profiles p on p.id = ea.user_id;

create or replace view public.v_student_attendance_detail as
select
  sa.id,
  sa.tanggal,
  sa.status,
  sa.catatan,
  s.id as student_id,
  s.nis,
  s.nama as student_name,
  s.kelas,
  s.jurusan,
  m.name as jurusan_name,
  m.rumpun as jurusan_rumpun,
  rec.id as recorded_by_id,
  rec.full_name as recorded_by_name,
  rec.role as recorded_by_role
from public.student_attendance sa
join public.students s on s.id = sa.student_id
join public.majors m on m.code = s.jurusan
left join public.profiles rec on rec.id = sa.recorded_by;

-- ----------------------------------------------------------------------------
-- 10. Row Level Security (RLS)
-- ----------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.majors enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.employee_attendance enable row level security;
alter table public.student_attendance enable row level security;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer set search_path = public
as $$
  select role from public.profiles where id = auth.uid();
$$;

-- Policies: Majors & Classes
drop policy if exists "Authenticated users can read majors" on public.majors;
create policy "Authenticated users can read majors"
  on public.majors for select
  to authenticated
  using (true);

drop policy if exists "Authenticated users can read classes" on public.classes;
create policy "Authenticated users can read classes"
  on public.classes for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage classes" on public.classes;
create policy "Admins can manage classes"
  on public.classes for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Policies: Profiles
drop policy if exists "Authenticated users can read profiles" on public.profiles;
create policy "Authenticated users can read profiles"
  on public.profiles for select
  to authenticated
  using (true);

drop policy if exists "Users can update own basic profile or admin all" on public.profiles;
create policy "Users can update own basic profile or admin all"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id or public.current_user_role() = 'admin');

-- Policies: Students
drop policy if exists "Authenticated users can view students" on public.students;
create policy "Authenticated users can view students"
  on public.students for select
  to authenticated
  using (true);

drop policy if exists "Admins can manage students" on public.students;
create policy "Admins can manage students"
  on public.students for all
  to authenticated
  using (public.current_user_role() = 'admin')
  with check (public.current_user_role() = 'admin');

-- Policies: Employee Attendance
drop policy if exists "Employees read own or admin reads all" on public.employee_attendance;
create policy "Employees read own or admin reads all"
  on public.employee_attendance for select
  to authenticated
  using (user_id = auth.uid() or public.current_user_role() = 'admin');

drop policy if exists "Employees manage own attendance" on public.employee_attendance;
create policy "Employees manage own attendance"
  on public.employee_attendance for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Employees update own attendance" on public.employee_attendance;
create policy "Employees update own attendance"
  on public.employee_attendance for update
  to authenticated
  using (user_id = auth.uid() or public.current_user_role() = 'admin');

-- Policies: Student Attendance
drop policy if exists "Guru and Admin read student attendance" on public.student_attendance;
create policy "Guru and Admin read student attendance"
  on public.student_attendance for select
  to authenticated
  using (public.current_user_role() in ('admin', 'guru'));

drop policy if exists "Guru and Admin record student attendance" on public.student_attendance;
create policy "Guru and Admin record student attendance"
  on public.student_attendance for all
  to authenticated
  using (public.current_user_role() in ('admin', 'guru'))
  with check (public.current_user_role() in ('admin', 'guru'));
