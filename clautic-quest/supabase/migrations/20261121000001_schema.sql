-- ClauTIC Quest · Esquema principal
create extension if not exists pgcrypto;

create type public.app_role as enum ('admin','teacher','student','family');
create type public.edu_line as enum ('robotica','videojocs','minecraft');
create type public.attendance_status as enum ('present','justificada','injustificada');
create type public.movement_source as enum ('competencia','accio_rapida','assistencia','missio','activitat','insignia','antiguitat','regla','correccio','compra','importacio');
create type public.participation_role as enum ('participa','collabora','destaca');
create type public.mission_kind as enum ('individual','comunitaria');

-- ───────────── Usuaris i rols ─────────────
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  created_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.app_role not null,
  primary key (user_id, role)
);

-- ───────────── Estructura acadèmica ─────────────
create table public.academic_years (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  start_date date not null,
  end_date date not null,
  is_current boolean not null default false
);
create unique index one_current_year on public.academic_years (is_current) where is_current;

create table public.districts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default '#22D3EE',
  sort int not null default 0,
  capacity int not null default 24
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  line public.edu_line not null,
  academic_year_id uuid not null references public.academic_years(id) on delete cascade,
  schedule text default '',
  weekday int,            -- 1=dilluns … 7=diumenge (per obrir el grup del dia)
  active boolean not null default true,
  unique (code, academic_year_id)
);

create table public.teacher_groups (
  teacher_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  primary key (teacher_id, group_id)
);

create table public.students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid unique references auth.users(id) on delete set null,
  first_name text not null,
  last_name text not null default '',
  birth_year int,
  start_year int not null default extract(year from now())::int,
  district_id uuid references public.districts(id) on delete set null,
  plot int,
  avatar jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  consent_family boolean not null default false,
  consent_images boolean not null default false,
  notes text default '',
  created_at timestamptz not null default now()
);
create unique index students_plot_unique on public.students (district_id, plot) where plot is not null;

create table public.enrollments (
  student_id uuid not null references public.students(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (student_id, group_id)
);
create index enr_group on public.enrollments (group_id);

create table public.family_students (
  family_id uuid not null references public.profiles(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  relation text default 'família',
  primary key (family_id, student_id)
);

create table public.student_history (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  year_label text not null,
  description text not null,
  created_at timestamptz not null default now()
);

create table public.invitations (
  code text primary key,
  role public.app_role not null,
  full_name text default '',
  student_id uuid references public.students(id) on delete cascade,
  student_ids uuid[] not null default '{}',
  group_ids uuid[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  used_at timestamptz,
  used_by uuid references auth.users(id) on delete set null
);

-- ───────────── Configuració de punts ─────────────
create table public.settings (
  key text primary key,
  value jsonb not null
);

create table public.competencies (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  icon text not null default '⭐',
  color text not null default '#22D3EE',
  description text not null default '',
  examples text[] not null default '{}',
  family_explanation text not null default '',
  xp int not null default 10,
  coins int not null default 5,
  sort int not null default 0,
  active boolean not null default true
);

create table public.quick_actions (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  icon text not null default '⚡',
  competency_id uuid references public.competencies(id) on delete set null,
  xp int not null default 10,
  coins int not null default 5,
  sort int not null default 0,
  active boolean not null default true
);

create table public.point_rules (
  key text primary key,
  label text not null,
  xp int not null default 0,
  coins int not null default 0,
  description text default '',
  sort int not null default 0
);

-- ───────────── Moviments (llibre únic d'XP i ClauCoins) ─────────────
create table public.point_movements (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  created_by uuid references public.profiles(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  competency_id uuid references public.competencies(id) on delete set null,
  source public.movement_source not null,
  ref_id uuid,
  label text not null default '',
  xp int not null default 0,
  coins int not null default 0,
  note text default '',
  dedupe_key text unique,
  batch_id uuid,
  created_at timestamptz not null default now(),
  undone_at timestamptz,
  undone_by uuid references public.profiles(id) on delete set null
);
create index pm_student on public.point_movements (student_id, created_at desc);
create index pm_batch on public.point_movements (created_by, batch_id);
create index pm_created on public.point_movements (created_at desc);
create index pm_competency on public.point_movements (competency_id);
create index pm_group on public.point_movements (group_id, created_at);

-- ───────────── Assistència ─────────────
create table public.class_sessions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  session_date date not null,
  teacher_id uuid references public.profiles(id) on delete set null,
  confirmed_at timestamptz,
  unique (group_id, session_date)
);

create table public.attendance (
  session_id uuid not null references public.class_sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  status public.attendance_status not null default 'present',
  primary key (session_id, student_id)
);
create index att_student on public.attendance (student_id);

-- ───────────── Insígnies ─────────────
create table public.badges (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  icon text not null default '🏅',
  color text not null default '#8B5CF6',
  description text not null default '',
  category text not null default 'fita',   -- fita | antiguitat | activitat | missio | especial
  rule_type text,                           -- anys | nivell | missions | activitats | reconeixements (automàtiques)
  rule_value int,
  unlock_item_key text,                     -- objecte exclusiu de la botiga que desbloqueja
  xp int not null default 0,
  coins int not null default 0,
  sort int not null default 0,
  active boolean not null default true
);

create table public.student_badges (
  student_id uuid not null references public.students(id) on delete cascade,
  badge_id uuid not null references public.badges(id) on delete cascade,
  awarded_by uuid references public.profiles(id) on delete set null,
  reason text default '',
  awarded_at timestamptz not null default now(),
  primary key (student_id, badge_id)
);

-- ───────────── Botiga i cases ─────────────
create table public.shop_items (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  name text not null,
  slot text not null,            -- model | teulada | jardi | robot | dron | holograma | energia | llum | porta | facana
  description text default '',
  price int not null default 50,
  min_level int not null default 1,
  exclusive boolean not null default false,  -- no es pot comprar: es desbloqueja
  color text default '#22D3EE',
  sort int not null default 0,
  active boolean not null default true
);

create table public.inventory (
  student_id uuid not null references public.students(id) on delete cascade,
  item_id uuid not null references public.shop_items(id) on delete cascade,
  source text not null default 'compra',
  acquired_at timestamptz not null default now(),
  primary key (student_id, item_id)
);

create table public.houses (
  student_id uuid primary key references public.students(id) on delete cascade,
  model text not null default 'cub',
  wall_color text not null default '#E8F1FF',
  accent_color text not null default '#22D3EE',
  slots jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

-- ───────────── Missions ─────────────
create table public.missions (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  kind public.mission_kind not null default 'individual',
  line public.edu_line,
  icon text not null default '🎯',
  xp int not null default 15,
  coins int not null default 10,
  badge_id uuid references public.badges(id) on delete set null,
  goal int not null default 1,
  unlock_key text,
  unlock_name text,
  unlocked_at timestamptz,
  repeatable boolean not null default false,
  active boolean not null default true,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create table public.mission_completions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.missions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  validated_by uuid references public.profiles(id) on delete set null,
  group_id uuid references public.groups(id) on delete set null,
  created_at timestamptz not null default now()
);
create index mc_mission on public.mission_completions (mission_id);
create index mc_student on public.mission_completions (student_id);

create table public.plaza_unlocks (
  key text primary key,
  name text not null,
  mission_id uuid references public.missions(id) on delete set null,
  unlocked_at timestamptz not null default now()
);

-- ───────────── Activitats extraordinàries ─────────────
create table public.activities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null default 'altres',   -- torneig | competicio | presentacio | jornada | comunitaria | altres
  activity_date date not null default current_date,
  description text not null default '',
  location text default '',
  xp_participa int not null default 20,
  xp_collabora int not null default 10,
  xp_destaca int not null default 10,
  coins_participa int not null default 10,
  coins_collabora int not null default 5,
  coins_destaca int not null default 5,
  badge_id uuid references public.badges(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.activity_participants (
  activity_id uuid not null references public.activities(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  role public.participation_role not null default 'participa',
  awarded_at timestamptz,
  primary key (activity_id, student_id)
);

-- ───────────── Auditoria ─────────────
create table public.audit_log (
  id bigserial primary key,
  actor uuid,
  action text not null,
  entity text,
  entity_id text,
  data jsonb,
  created_at timestamptz not null default now()
);
create index audit_created on public.audit_log (created_at desc);
