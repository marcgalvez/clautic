-- ClauTIC Quest · INSTAL·LACIÓ COMPLETA EN UN SOL PAS
-- Enganxa tot aquest fitxer a Supabase → SQL Editor i clica Run (només un cop).
-- Conté les migracions 001–007: taules, seguretat (RLS), funcions i configuració inicial. Sense dades fictícies.


-- ════════ 20261121000001_schema.sql ════════
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

-- ════════ 20261121000002_security.sql ════════
-- ClauTIC Quest · Funcions de permisos i polítiques RLS

create or replace function public.has_role(_role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role = _role)
$$;

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select public.has_role('admin')
$$;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from user_roles where user_id = auth.uid() and role in ('admin','teacher'))
$$;

create or replace function public.teaches_group(_group uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from teacher_groups where teacher_id = auth.uid() and group_id = _group)
$$;

create or replace function public.teaches_student(_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from teacher_groups tg join enrollments e on e.group_id = tg.group_id
    where tg.teacher_id = auth.uid() and e.student_id = _student)
$$;

create or replace function public.my_student_id()
returns uuid language sql stable security definer set search_path = public as $$
  select id from students where user_id = auth.uid()
$$;

create or replace function public.is_family_of(_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from family_students where family_id = auth.uid() and student_id = _student)
$$;

-- Pot veure les dades privades (punts, assistència, historial) de l'alumne?
create or replace function public.can_view_student(_student uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select _student is not null and coalesce(
         public.teaches_student(_student)
      or public.is_family_of(_student)
      or _student = public.my_student_id(), false)
$$;

-- ───────────── RLS ─────────────
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','user_roles','academic_years','districts','groups','teacher_groups','students','enrollments',
    'family_students','student_history','invitations','settings','competencies','quick_actions','point_rules',
    'point_movements','class_sessions','attendance','badges','student_badges','shop_items','inventory','houses',
    'missions','mission_completions','plaza_unlocks','activities','activity_participants','audit_log']
  loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Configuració pública per a usuaris autenticats (lectura); escriptura només admin.
do $$
declare t text;
begin
  foreach t in array array['academic_years','districts','groups','settings','competencies','quick_actions',
                           'point_rules','badges','shop_items','missions','plaza_unlocks','activities']
  loop
    execute format('create policy "%s_read" on public.%I for select to authenticated using (true)', t, t);
    execute format('create policy "%s_admin_write" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- Perfils i rols
create policy profiles_self on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_staff());
create policy profiles_admin on public.profiles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy roles_self on public.user_roles for select to authenticated
  using (user_id = auth.uid() or public.is_admin());
create policy roles_admin on public.user_roles for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Alumnes: dades privades només per a ells, les seves famílies i el seu professorat.
create policy students_read on public.students for select to authenticated
  using (public.can_view_student(id));
create policy students_admin on public.students for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy teacher_groups_read on public.teacher_groups for select to authenticated
  using (teacher_id = auth.uid() or public.is_admin());
create policy teacher_groups_admin on public.teacher_groups for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy enrollments_read on public.enrollments for select to authenticated
  using (public.can_view_student(student_id));
create policy enrollments_admin on public.enrollments for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy family_read on public.family_students for select to authenticated
  using (family_id = auth.uid() or public.is_admin());
create policy family_admin on public.family_students for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Taules lligades a un alumne: lectura per a qui pot veure l'alumne; escriptura admin.
do $$
declare t text;
begin
  foreach t in array array['student_history','point_movements','attendance','student_badges','inventory','mission_completions','activity_participants']
  loop
    execute format('create policy "%s_read" on public.%I for select to authenticated using (public.can_view_student(student_id))', t, t);
    execute format('create policy "%s_admin" on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t, t);
  end loop;
end $$;

-- Les cases són visitables per tothom (sense dades personals), però només editables via funció.
create policy houses_read on public.houses for select to authenticated using (true);
create policy houses_admin on public.houses for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy sessions_read on public.class_sessions for select to authenticated
  using (public.teaches_group(group_id));
create policy sessions_admin on public.class_sessions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy invitations_admin on public.invitations for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy audit_admin on public.audit_log for select to authenticated using (public.is_admin());

-- ════════ 20261121000003_core_functions.sql ════════
-- ClauTIC Quest · Funcions internes, nivells, concessió de punts, assistència i missions

-- ───────────── Utilitats ─────────────
create or replace function public.level_for_xp(_xp int)
returns int language plpgsql immutable as $$
declare l int := 1;
begin
  while 60*l + 10*l*(l-1) <= coalesce(_xp,0) loop l := l + 1; end loop;
  return l;
end $$;

create or replace function public.xp_for_level(_l int)
returns int language sql immutable as $$
  select 60*(_l-1) + 10*(_l-1)*(_l-2)
$$;

create or replace function public._setting_int(_key text, _default int)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::int from settings where key = _key), _default)
$$;

create or replace function public._short_name(_first text, _last text)
returns text language sql immutable as $$
  select trim(_first) || case when coalesce(trim(_last),'') = '' then '' else ' ' || left(trim(_last),1) || '.' end
$$;

create or replace function public.student_xp(_s uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(xp),0)::int from point_movements where student_id = _s and undone_at is null
$$;

create or replace function public.student_coins(_s uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce(sum(coins),0)::int from point_movements where student_id = _s and undone_at is null
$$;

-- Any d'inici del curs acadèmic actual (setembre)
create or replace function public._academic_start_year()
returns int language sql stable security definer set search_path = public as $$
  select coalesce(
    (select extract(year from start_date)::int from academic_years where is_current),
    case when extract(month from current_date) >= 9 then extract(year from current_date)::int
         else extract(year from current_date)::int - 1 end)
$$;

create or replace function public.student_years(_s uuid)
returns int language sql stable security definer set search_path = public as $$
  select greatest(1, public._academic_start_year() - start_year + 1) from students where id = _s
$$;

create or replace function public._audit(_action text, _entity text, _entity_id text, _data jsonb)
returns void language sql security definer set search_path = public as $$
  insert into audit_log (actor, action, entity, entity_id, data) values (auth.uid(), _action, _entity, _entity_id, _data)
$$;

create or replace function public._require_auth()
returns uuid language plpgsql stable as $$
begin
  if auth.uid() is null then raise exception 'Cal iniciar sessió' using errcode = '28000'; end if;
  return auth.uid();
end $$;

create or replace function public._gen_code()
returns text language plpgsql volatile as $$
declare alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; c text; i int;
begin
  loop
    c := 'CQ-';
    for i in 1..6 loop c := c || substr(alphabet, 1 + floor(random()*length(alphabet))::int, 1); end loop;
    exit when not exists (select 1 from invitations where code = c);
  end loop;
  return c;
end $$;

-- Inserció al llibre de moviments. Retorna true si s'ha inserit (no duplicat).
create or replace function public._award(
  _student uuid, _source public.movement_source, _xp int, _coins int, _label text,
  _competency uuid default null, _group uuid default null, _ref uuid default null,
  _dedupe text default null, _batch uuid default null, _note text default '')
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  insert into point_movements (student_id, created_by, group_id, competency_id, source, ref_id, label, xp, coins, note, dedupe_key, batch_id)
  values (_student, auth.uid(), _group, _competency, _source, _ref, coalesce(_label,''), coalesce(_xp,0), coalesce(_coins,0), coalesce(_note,''), _dedupe, _batch)
  on conflict (dedupe_key) do nothing;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Concedeix una insígnia (i el seu objecte exclusiu i la seva recompensa). Idempotent.
create or replace function public._give_badge(_student uuid, _badge uuid, _reason text default '')
returns boolean language plpgsql security definer set search_path = public as $$
declare b badges; n int;
begin
  select * into b from badges where id = _badge;
  if not found then return false; end if;
  insert into student_badges (student_id, badge_id, awarded_by, reason)
  values (_student, _badge, auth.uid(), coalesce(_reason,'')) on conflict do nothing;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;
  if b.xp <> 0 or b.coins <> 0 then
    perform public._award(_student, case when b.category = 'antiguitat' then 'antiguitat'::movement_source else 'insignia'::movement_source end,
      b.xp, b.coins, 'Insígnia: ' || b.name, null, null, b.id, 'badge:' || b.id || ':' || _student);
  end if;
  if b.unlock_item_key is not null then
    insert into inventory (student_id, item_id, source)
    select _student, id, 'insignia' from shop_items where key = b.unlock_item_key on conflict do nothing;
  end if;
  return true;
end $$;

-- Revisa les insígnies automàtiques (antiguitat, nivell, missions, activitats, reconeixements).
create or replace function public._check_badges(_student uuid)
returns int language plpgsql security definer set search_path = public as $$
declare b badges; v int; got int := 0; xp int;
begin
  xp := public.student_xp(_student);
  for b in select * from badges where active and rule_type is not null
             and not exists (select 1 from student_badges sb where sb.badge_id = badges.id and sb.student_id = _student)
  loop
    v := case b.rule_type
      when 'anys' then public.student_years(_student)
      when 'nivell' then public.level_for_xp(xp)
      when 'missions' then (select count(*)::int from mission_completions where student_id = _student)
      when 'activitats' then (select count(*)::int from activity_participants where student_id = _student and awarded_at is not null)
      when 'reconeixements' then (select count(*)::int from point_movements where student_id = _student and undone_at is null and source in ('competencia','accio_rapida'))
      else 0 end;
    if v >= coalesce(b.rule_value, 0) then
      if public._give_badge(_student, b.id, 'Automàtica') then got := got + 1; end if;
    end if;
  end loop;
  return got;
end $$;

-- Assigna una parcel·la lliure; si tots els barris són plens, en crea un de nou (el poble creix).
create or replace function public._assign_plot(_student uuid)
returns void language plpgsql security definer set search_path = public as $$
declare d districts; p int; names text[] := array['Barri Cian','Barri Violeta','Barri Grana','Barri Menta','Barri Solar','Barri Aurora','Barri Quàntic','Barri Píxel','Barri Òrbita','Barri Circuit'];
        colors text[] := array['#22D3EE','#8B5CF6','#E5213B','#34D399','#FBBF24','#F472B6','#60A5FA','#A3E635','#FB923C','#2DD4BF'];
        n int;
begin
  if exists (select 1 from students where id = _student and plot is not null) then return; end if;
  select dd.* into d from districts dd
   where (select count(*) from students s where s.district_id = dd.id and s.plot is not null) < dd.capacity
   order by dd.sort, (select count(*) from students s where s.district_id = dd.id) limit 1;
  if not found then
    select count(*) into n from districts;
    insert into districts (name, color, sort, capacity)
    values (coalesce(names[n+1], 'Barri ' || (n+1)), coalesce(colors[(n % 10)+1], '#22D3EE'), n, 24)
    returning * into d;
  end if;
  select min(g) into p from generate_series(0, d.capacity-1) g
   where not exists (select 1 from students s where s.district_id = d.id and s.plot = g);
  update students set district_id = d.id, plot = p where id = _student;
  insert into houses (student_id) values (_student) on conflict do nothing;
end $$;

create or replace function public._ensure_invite(_student uuid)
returns text language plpgsql security definer set search_path = public as $$
declare c text;
begin
  if exists (select 1 from students where id = _student and user_id is not null) then return null; end if;
  select code into c from invitations where student_id = _student and role = 'student' and used_at is null limit 1;
  if c is null then
    c := public._gen_code();
    insert into invitations (code, role, student_id, full_name, created_by)
    select c, 'student', id, first_name || ' ' || last_name, auth.uid() from students where id = _student;
  end if;
  return c;
end $$;

-- ───────────── Alta d'usuaris per invitació ─────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare inv invitations; _code text := upper(trim(coalesce(new.raw_user_meta_data->>'invite_code','')));
begin
  if _code = '' then raise exception 'Cal un codi d''invitació'; end if;
  select * into inv from invitations i where i.code = _code and i.used_at is null for update;
  if not found then raise exception 'El codi d''invitació no és vàlid o ja s''ha fet servir'; end if;
  if inv.role = 'student' and exists (select 1 from students where id = inv.student_id and user_id is not null) then
    raise exception 'Aquest alumne ja té un compte actiu';
  end if;

  insert into profiles (id, full_name, email)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'full_name',''), inv.full_name, ''), new.email)
  on conflict (id) do nothing;
  insert into user_roles (user_id, role) values (new.id, inv.role) on conflict do nothing;

  if inv.role = 'student' then
    update students set user_id = new.id where id = inv.student_id;
    update profiles set full_name = (select first_name || ' ' || last_name from students where id = inv.student_id) where id = new.id;
  elsif inv.role = 'family' then
    insert into family_students (family_id, student_id) select new.id, unnest(inv.student_ids) on conflict do nothing;
  elsif inv.role = 'teacher' then
    insert into teacher_groups (teacher_id, group_id) select new.id, unnest(inv.group_ids) on conflict do nothing;
  end if;
  update invitations set used_at = now(), used_by = new.id where code = _code;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Comprova un codi abans de registrar-se (accessible sense sessió).
create or replace function public.check_invitation(p_code text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare inv invitations; s students;
begin
  select * into inv from invitations where code = upper(trim(p_code)) and used_at is null;
  if not found then return jsonb_build_object('valid', false); end if;
  if inv.role = 'student' then
    select * into s from students where id = inv.student_id;
    return jsonb_build_object('valid', true, 'role', inv.role, 'name', s.first_name,
      'suggested_username', lower(regexp_replace(translate(s.first_name || '.' || left(coalesce(s.last_name,''),1),
        'àáèéíìïòóúùüçñÀÁÈÉÍÌÏÒÓÚÙÜÇÑ·', 'aaeeiiiooouuucnAAEEIIIOOOUUUCN.'), '[^a-zA-Z0-9.]', '', 'g')));
  end if;
  return jsonb_build_object('valid', true, 'role', inv.role, 'name', inv.full_name);
end $$;

-- ───────────── Context de l'usuari ─────────────
create or replace function public.get_my_context()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := public._require_auth(); res jsonb; s students;
begin
  res := jsonb_build_object(
    'user_id', uid,
    'full_name', (select full_name from profiles where id = uid),
    'roles', coalesce((select jsonb_agg(role order by role) from user_roles where user_id = uid), '[]'::jsonb),
    'academic_year', (select to_jsonb(y) from academic_years y where is_current));

  select * into s from students where user_id = uid;
  if found then
    res := res || jsonb_build_object('student', jsonb_build_object('id', s.id, 'first_name', s.first_name, 'name', public._short_name(s.first_name, s.last_name), 'avatar', s.avatar));
  end if;

  if public.has_role('family') then
    res := res || jsonb_build_object('children', coalesce((
      select jsonb_agg(jsonb_build_object('id', st.id, 'name', st.first_name || ' ' || st.last_name, 'first_name', st.first_name, 'avatar', st.avatar) order by st.first_name)
      from family_students fs join students st on st.id = fs.student_id where fs.family_id = uid), '[]'::jsonb));
  end if;

  if public.is_staff() then
    res := res || jsonb_build_object('groups', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'code', g.code, 'name', g.name, 'line', g.line, 'weekday', g.weekday, 'schedule', g.schedule,
                                          'students', (select count(*) from enrollments e join students st on st.id = e.student_id and st.active where e.group_id = g.id))
                       order by g.line, length(g.code), g.code)
      from groups g join academic_years y on y.id = g.academic_year_id and y.is_current
      where g.active and (public.is_admin() or exists (select 1 from teacher_groups tg where tg.group_id = g.id and tg.teacher_id = uid))), '[]'::jsonb));
  end if;
  return res;
end $$;

-- ───────────── Mode Classe ─────────────
create or replace function public.class_board(p_group_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare uid uuid := public._require_auth(); sess class_sessions; lastb record;
begin
  if not public.teaches_group(p_group_id) then raise exception 'No tens accés a aquest grup' using errcode = '42501'; end if;
  select * into sess from class_sessions where group_id = p_group_id and session_date = current_date;

  select pm.batch_id, max(pm.label) as label, count(*) as n, max(pm.created_at) as at into lastb
    from point_movements pm
   where pm.created_by = uid and pm.group_id = p_group_id and pm.undone_at is null and pm.batch_id is not null
     and pm.source in ('competencia','accio_rapida','regla','missio')
     and pm.created_at > now() - make_interval(mins => public._setting_int('undo_minutes', 15))
   group by pm.batch_id order by max(pm.created_at) desc limit 1;

  return jsonb_build_object(
    'group', (select jsonb_build_object('id', g.id, 'code', g.code, 'name', g.name, 'line', g.line) from groups g where g.id = p_group_id),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'name', public._short_name(s.first_name, s.last_name), 'first_name', s.first_name, 'avatar', s.avatar,
        'xp', x.xp, 'level', public.level_for_xp(x.xp),
        'today', x.today, 'week', x.week,
        'status', (select a.status from attendance a where a.session_id = sess.id and a.student_id = s.id))
        order by s.first_name, s.last_name)
      from enrollments e join students s on s.id = e.student_id and s.active
      cross join lateral (
        select coalesce(sum(pm.xp),0)::int as xp,
               count(*) filter (where pm.created_at::date = current_date and pm.source in ('competencia','accio_rapida'))::int as today,
               count(*) filter (where pm.created_at > now() - interval '7 days' and pm.source in ('competencia','accio_rapida'))::int as week
          from point_movements pm where pm.student_id = s.id and pm.undone_at is null) x
      where e.group_id = p_group_id), '[]'::jsonb),
    'competencies', coalesce((select jsonb_agg(to_jsonb(c) order by c.sort) from competencies c where c.active), '[]'::jsonb),
    'quick_actions', coalesce((select jsonb_agg(to_jsonb(q) order by q.sort) from quick_actions q where q.active), '[]'::jsonb),
    'rules', coalesce((select jsonb_agg(to_jsonb(r) order by r.sort) from point_rules r where r.key not in ('assistencia')), '[]'::jsonb),
    'session', case when sess.id is null then null else jsonb_build_object('id', sess.id, 'confirmed_at', sess.confirmed_at) end,
    'last_batch', case when lastb.batch_id is null then null else jsonb_build_object('batch_id', lastb.batch_id, 'label', lastb.label, 'count', lastb.n, 'at', lastb.at) end);
end $$;

-- Concessió ràpida: alumnes + competència (o acció ràpida). Sense confirmacions.
create or replace function public.award_points(
  p_group_id uuid, p_student_ids uuid[], p_competency_id uuid default null,
  p_quick_action_id uuid default null, p_client_key text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_auth(); c competencies; q quick_actions;
        _xp int; _coins int; _label text; _comp uuid; _src movement_source;
        batch uuid := gen_random_uuid(); s uuid; n int := 0; skipped int := 0; win int;
        awarded uuid[] := '{}';
begin
  if not public.teaches_group(p_group_id) then raise exception 'No tens accés a aquest grup' using errcode = '42501'; end if;
  if p_quick_action_id is not null then
    select * into q from quick_actions where id = p_quick_action_id and active;
    if not found then raise exception 'Acció ràpida desconeguda'; end if;
    _xp := q.xp; _coins := q.coins; _label := q.label; _comp := q.competency_id; _src := 'accio_rapida';
  else
    select * into c from competencies where id = p_competency_id and active;
    if not found then raise exception 'Competència desconeguda'; end if;
    _xp := c.xp; _coins := c.coins; _label := c.name; _comp := c.id; _src := 'competencia';
  end if;
  win := public._setting_int('dedupe_seconds', 3);

  foreach s in array coalesce(p_student_ids, '{}') loop
    if not exists (select 1 from enrollments where student_id = s and group_id = p_group_id) then skipped := skipped + 1; continue; end if;
    -- Antiduplicats: mateix professor, alumne i motiu en pocs segons
    if exists (select 1 from point_movements where created_by = uid and student_id = s and label = _label
               and undone_at is null and created_at > now() - make_interval(secs => win)) then
      skipped := skipped + 1; continue;
    end if;
    if public._award(s, _src, _xp, _coins, _label, _comp, p_group_id, coalesce(p_quick_action_id, p_competency_id),
                     case when p_client_key is null then null else 'tap:' || p_client_key || ':' || s end, batch) then
      n := n + 1; awarded := awarded || s;
      perform public._check_badges(s);
    else
      skipped := skipped + 1;
    end if;
  end loop;

  return jsonb_build_object('batch_id', batch, 'awarded', n, 'skipped', skipped, 'xp', _xp, 'coins', _coins,
                            'label', _label, 'student_ids', to_jsonb(awarded));
end $$;

-- Desfà l'últim lot del professor en aquest grup.
create or replace function public.undo_last(p_group_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_auth(); b uuid; n int; lbl text;
begin
  if not public.teaches_group(p_group_id) then raise exception 'No tens accés a aquest grup' using errcode = '42501'; end if;
  select batch_id into b from point_movements
   where created_by = uid and group_id = p_group_id and undone_at is null and batch_id is not null
     and source in ('competencia','accio_rapida','regla','missio')
     and created_at > now() - make_interval(mins => public._setting_int('undo_minutes', 15))
   order by created_at desc limit 1;
  if b is null then return jsonb_build_object('undone', 0); end if;
  select max(label) into lbl from point_movements where batch_id = b;
  update point_movements set undone_at = now(), undone_by = uid where batch_id = b and undone_at is null;
  get diagnostics n = row_count;
  -- Les validacions de missió del lot també es desfan
  delete from mission_completions mc using point_movements pm
   where pm.batch_id = b and pm.source = 'missio' and mc.id = pm.ref_id;
  perform public._audit('desfer', 'point_movements', b::text, jsonb_build_object('count', n, 'label', lbl));
  return jsonb_build_object('undone', n, 'label', lbl, 'batch_id', b);
end $$;

-- Regles de punts generals (torneig, presentació, final de curs…)
create or replace function public.award_rule(p_rule_key text, p_student_ids uuid[], p_group_id uuid default null,
                                             p_note text default '', p_client_key text default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_auth(); r point_rules; s uuid; n int := 0; batch uuid := gen_random_uuid();
begin
  if not public.is_staff() then raise exception 'Sense permís' using errcode = '42501'; end if;
  select * into r from point_rules where key = p_rule_key;
  if not found then raise exception 'Regla desconeguda'; end if;
  foreach s in array coalesce(p_student_ids,'{}') loop
    if not public.teaches_student(s) then continue; end if;
    if public._award(s, 'regla', r.xp, r.coins, r.label, null, p_group_id, null,
                     'rule:' || coalesce(p_client_key, gen_random_uuid()::text) || ':' || s, batch, p_note) then
      n := n + 1; perform public._check_badges(s);
    end if;
  end loop;
  perform public._audit('regla', 'point_rules', p_rule_key, jsonb_build_object('count', n));
  return jsonb_build_object('awarded', n, 'xp', r.xp, 'label', r.label, 'batch_id', batch);
end $$;

-- ───────────── Assistència ─────────────
create or replace function public.get_session(p_group_id uuid, p_date date)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare sess class_sessions;
begin
  perform public._require_auth();
  if not public.teaches_group(p_group_id) then raise exception 'No tens accés a aquest grup' using errcode = '42501'; end if;
  select * into sess from class_sessions where group_id = p_group_id and session_date = p_date;
  return jsonb_build_object(
    'session', case when sess.id is null then null else to_jsonb(sess) end,
    'xp', (select xp from point_rules where key = 'assistencia'),
    'students', coalesce((
      select jsonb_agg(jsonb_build_object('id', s.id, 'name', public._short_name(s.first_name, s.last_name), 'avatar', s.avatar,
                                          'status', coalesce((select a.status::text from attendance a where a.session_id = sess.id and a.student_id = s.id), null))
                       order by s.first_name, s.last_name)
      from enrollments e join students s on s.id = e.student_id and s.active where e.group_id = p_group_id), '[]'::jsonb),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object('date', cs.session_date, 'confirmed', cs.confirmed_at is not null,
                                          'present', (select count(*) from attendance a where a.session_id = cs.id and a.status = 'present'),
                                          'total', (select count(*) from attendance a where a.session_id = cs.id)) order by cs.session_date desc)
      from (select * from class_sessions where group_id = p_group_id order by session_date desc limit 8) cs), '[]'::jsonb));
end $$;

create or replace function public.save_attendance(p_group_id uuid, p_date date, p_entries jsonb, p_confirm boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_auth(); sid uuid; e jsonb; st uuid; status attendance_status; r point_rules;
        n_award int := 0; n_present int := 0; _key text;
begin
  if not public.teaches_group(p_group_id) then raise exception 'No tens accés a aquest grup' using errcode = '42501'; end if;
  insert into class_sessions (group_id, session_date, teacher_id) values (p_group_id, p_date, uid)
  on conflict (group_id, session_date) do update set teacher_id = excluded.teacher_id
  returning id into sid;
  select * into r from point_rules where key = 'assistencia';

  for e in select * from jsonb_array_elements(coalesce(p_entries, '[]'::jsonb)) loop
    st := (e->>'student_id')::uuid;
    status := coalesce(e->>'status', 'present')::attendance_status;
    if not exists (select 1 from enrollments where student_id = st and group_id = p_group_id) then continue; end if;
    insert into attendance (session_id, student_id, status) values (sid, st, status)
    on conflict (session_id, student_id) do update set status = excluded.status;
    if p_confirm then
      _key := 'att:' || sid || ':' || st;
      if status = 'present' then
        n_present := n_present + 1;
        if public._award(st, 'assistencia', coalesce(r.xp,5), coalesce(r.coins,2), 'Assistència', null, p_group_id, sid, _key) then
          n_award := n_award + 1;
        else
          update point_movements set undone_at = null, undone_by = null where dedupe_key = _key and undone_at is not null;
        end if;
        perform public._check_badges(st);
      else
        -- Les absències no penalitzen: simplement no hi ha XP d'assistència.
        update point_movements set undone_at = now(), undone_by = uid where dedupe_key = _key and undone_at is null;
      end if;
    end if;
  end loop;

  if p_confirm then update class_sessions set confirmed_at = now() where id = sid; end if;
  perform public._audit(case when p_confirm then 'assistencia_confirmada' else 'assistencia_desada' end, 'class_sessions', sid::text,
                        jsonb_build_object('present', n_present, 'awarded', n_award));
  return jsonb_build_object('session_id', sid, 'present', n_present, 'awarded', n_award);
end $$;

-- Progrés comunitari: totes les missions completades per tots els alumnes des que es va crear la missió comunitària
create or replace function public._community_progress(_m uuid)
returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from mission_completions mc, missions m where m.id = _m and mc.created_at >= m.created_at
$$;

create or replace function public._check_community()
returns jsonb language plpgsql security definer set search_path = public as $$
declare m missions; names jsonb := '[]'::jsonb;
begin
  for m in select * from missions where kind = 'comunitaria' and active and unlocked_at is null order by goal loop
    if public._community_progress(m.id) >= m.goal then
      update missions set unlocked_at = now() where id = m.id;
      if m.unlock_key is not null then
        insert into plaza_unlocks (key, name, mission_id) values (m.unlock_key, coalesce(m.unlock_name, m.title), m.id) on conflict do nothing;
      end if;
      names := names || to_jsonb(coalesce(m.unlock_name, m.title));
    end if;
  end loop;
  return names;
end $$;

-- ───────────── Missions ─────────────
create or replace function public.validate_mission(p_mission_id uuid, p_student_ids uuid[], p_group_id uuid default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := public._require_auth(); m missions; s uuid; cid uuid; n int := 0; total int; batch uuid := gen_random_uuid(); unlocked jsonb;
begin
  if not public.is_staff() then raise exception 'Sense permís' using errcode = '42501'; end if;
  select * into m from missions where id = p_mission_id and active;
  if not found then raise exception 'Missió desconeguda'; end if;

  foreach s in array coalesce(p_student_ids,'{}') loop
    if not public.teaches_student(s) then continue; end if;
    if not m.repeatable and exists (select 1 from mission_completions where mission_id = m.id and student_id = s) then continue; end if;
    insert into mission_completions (mission_id, student_id, validated_by, group_id) values (m.id, s, uid, p_group_id) returning id into cid;
    perform public._award(s, 'missio', m.xp, m.coins, 'Missió: ' || m.title, null, p_group_id, cid, 'mis:' || cid, batch);
    if m.badge_id is not null then perform public._give_badge(s, m.badge_id, 'Missió: ' || m.title); end if;
    perform public._check_badges(s);
    n := n + 1;
  end loop;

  unlocked := public._check_community();
  perform public._audit('missio_validada', 'missions', m.id::text, jsonb_build_object('count', n));
  return jsonb_build_object('validated', n, 'xp', m.xp, 'unlocked', unlocked, 'batch_id', batch);
end $$;

-- Insígnia manual (professor als seus alumnes, admin a tothom)
create or replace function public.award_badge(p_badge_id uuid, p_student_ids uuid[], p_reason text default '')
returns jsonb language plpgsql security definer set search_path = public as $$
declare s uuid; n int := 0;
begin
  perform public._require_auth();
  if not public.is_staff() then raise exception 'Sense permís' using errcode = '42501'; end if;
  foreach s in array coalesce(p_student_ids,'{}') loop
    if public.teaches_student(s) and public._give_badge(s, p_badge_id, p_reason) then n := n + 1; end if;
  end loop;
  perform public._audit('insignia', 'badges', p_badge_id::text, jsonb_build_object('count', n));
  return jsonb_build_object('awarded', n);
end $$;

-- ════════ 20261121000004_student_family.sql ════════
-- ClauTIC Quest · Alumne, ClauTIC City, botiga, famílies i informes

create or replace function public._house_json(_s uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce((select jsonb_build_object('model', h.model, 'wall_color', h.wall_color, 'accent_color', h.accent_color, 'slots', h.slots)
                     from houses h where h.student_id = _s),
                  jsonb_build_object('model','cub','wall_color','#E8F1FF','accent_color','#22D3EE','slots','{}'::jsonb))
$$;

create or replace function public._recent_json(_s uuid, _limit int)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r order by (r->>'created_at') desc), '[]'::jsonb) from (
    select jsonb_build_object('id', pm.id, 'label', pm.label, 'xp', pm.xp, 'coins', pm.coins, 'source', pm.source,
                              'created_at', pm.created_at, 'note', pm.note,
                              'competency', case when c.id is null then null else jsonb_build_object('key', c.key, 'name', c.name, 'icon', c.icon, 'color', c.color, 'family_explanation', c.family_explanation) end) r
      from point_movements pm left join competencies c on c.id = pm.competency_id
     where pm.student_id = _s and pm.undone_at is null and pm.source <> 'compra'
     order by pm.created_at desc limit _limit) t
$$;

create or replace function public._badges_json(_s uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', b.id, 'key', b.key, 'name', b.name, 'icon', b.icon, 'color', b.color,
                                               'description', b.description, 'category', b.category, 'awarded_at', sb.awarded_at)
                            order by sb.awarded_at), '[]'::jsonb)
    from student_badges sb join badges b on b.id = sb.badge_id where sb.student_id = _s
$$;

-- Tauler principal de l'alumne
create or replace function public.my_dashboard()
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid; s students; xp int; lvl int;
begin
  perform public._require_auth();
  sid := public.my_student_id();
  if sid is null then raise exception 'Aquest compte no és d''alumne'; end if;
  perform public._check_badges(sid);
  select * into s from students where id = sid;
  xp := public.student_xp(sid); lvl := public.level_for_xp(xp);
  return jsonb_build_object(
    'student', jsonb_build_object('id', s.id, 'first_name', s.first_name, 'name', public._short_name(s.first_name, s.last_name),
                                  'avatar', s.avatar, 'start_year', s.start_year, 'years', public.student_years(sid)),
    'xp', xp, 'coins', public.student_coins(sid), 'level', lvl,
    'level_xp', public.xp_for_level(lvl), 'next_level_xp', public.xp_for_level(lvl + 1),
    'recent', public._recent_json(sid, 12),
    'badges', public._badges_json(sid),
    'house', public._house_json(sid),
    'inventory', coalesce((select jsonb_agg(si.key) from inventory i join shop_items si on si.id = i.item_id where i.student_id = sid), '[]'::jsonb),
    'groups', coalesce((select jsonb_agg(jsonb_build_object('code', g.code, 'name', g.name, 'line', g.line))
                          from enrollments e join groups g on g.id = e.group_id and g.active where e.student_id = sid), '[]'::jsonb));
end $$;

-- Vista general del poble: només nom curt, nivell i casa (cap dada personal)
create or replace function public.city_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare me uuid;
begin
  perform public._require_auth();
  me := public.my_student_id();
  return jsonb_build_object(
    'me', me,
    'districts', coalesce((
      select jsonb_agg(jsonb_build_object('id', d.id, 'name', d.name, 'color', d.color, 'capacity', d.capacity,
        'houses', coalesce((
          select jsonb_agg(jsonb_build_object('student_id', s.id, 'name', public._short_name(s.first_name, s.last_name),
                                              'plot', s.plot, 'level', public.level_for_xp(public.student_xp(s.id)),
                                              'avatar', s.avatar, 'house', public._house_json(s.id), 'is_me', s.id = me) order by s.plot)
            from students s where s.district_id = d.id and s.active and s.plot is not null), '[]'::jsonb))
        order by d.sort)
      from districts d), '[]'::jsonb),
    'plaza', coalesce((select jsonb_agg(jsonb_build_object('key', key, 'name', name, 'unlocked_at', unlocked_at)) from plaza_unlocks), '[]'::jsonb),
    'community', coalesce((
      select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'icon', m.icon, 'description', m.description, 'goal', m.goal,
                                          'progress', public._community_progress(m.id),
                                          'unlock_name', m.unlock_name, 'unlocked_at', m.unlocked_at) order by m.sort)
        from missions m where m.kind = 'comunitaria' and m.active), '[]'::jsonb));
end $$;

-- Visita d'una casa (qualsevol usuari autenticat; només lectura)
create or replace function public.get_house(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s students; me uuid;
begin
  perform public._require_auth();
  me := public.my_student_id();
  select * into s from students where id = p_student_id and active;
  if not found then raise exception 'Casa no trobada'; end if;
  return jsonb_build_object(
    'student_id', s.id, 'name', public._short_name(s.first_name, s.last_name), 'avatar', s.avatar,
    'level', public.level_for_xp(public.student_xp(s.id)),
    'house', public._house_json(s.id),
    'district', (select jsonb_build_object('id', d.id, 'name', d.name, 'color', d.color) from districts d where d.id = s.district_id),
    'badges', (select coalesce(jsonb_agg(jsonb_build_object('icon', b.icon, 'name', b.name, 'color', b.color) order by sb.awarded_at), '[]'::jsonb)
                 from student_badges sb join badges b on b.id = sb.badge_id where sb.student_id = s.id),
    'is_mine', s.id = me);
end $$;

-- Botiga
create or replace function public.shop_catalog()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare sid uuid; xp int;
begin
  perform public._require_auth();
  sid := public.my_student_id();
  xp := case when sid is null then 0 else public.student_xp(sid) end;
  return jsonb_build_object(
    'coins', case when sid is null then 0 else public.student_coins(sid) end,
    'level', public.level_for_xp(xp),
    'items', coalesce((
      select jsonb_agg(to_jsonb(si) || jsonb_build_object('owned', exists (select 1 from inventory i where i.item_id = si.id and i.student_id = sid))
                       order by si.slot, si.sort, si.price)
        from shop_items si where si.active), '[]'::jsonb));
end $$;

create or replace function public.buy_item(p_item_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid; it shop_items; bal int;
begin
  perform public._require_auth();
  sid := public.my_student_id();
  if sid is null then raise exception 'Només els alumnes poden comprar'; end if;
  perform pg_advisory_xact_lock(hashtext('buy:' || sid));
  select * into it from shop_items where id = p_item_id and active;
  if not found then raise exception 'Objecte no disponible'; end if;
  if it.exclusive then raise exception 'Aquest objecte és exclusiu: es desbloqueja amb una fita'; end if;
  if exists (select 1 from inventory where student_id = sid and item_id = it.id) then raise exception 'Ja el tens a l''inventari'; end if;
  if public.level_for_xp(public.student_xp(sid)) < it.min_level then raise exception 'Necessites el nivell %', it.min_level; end if;
  bal := public.student_coins(sid);
  if bal < it.price then raise exception 'Et falten % ClauCoins', it.price - bal; end if;
  insert into inventory (student_id, item_id, source) values (sid, it.id, 'compra');
  perform public._award(sid, 'compra', 0, -it.price, 'Compra: ' || it.name, null, null, it.id, 'buy:' || sid || ':' || it.id);
  return jsonb_build_object('ok', true, 'coins', public.student_coins(sid), 'item', to_jsonb(it));
end $$;

-- Desa la casa: només pot fer servir objectes que té a l'inventari, a la ranura correcta.
create or replace function public.save_house(p_model text, p_wall_color text, p_accent_color text, p_slots jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid; k text; v text; clean jsonb := '{}'::jsonb;
begin
  perform public._require_auth();
  sid := public.my_student_id();
  if sid is null then raise exception 'Només l''alumne pot modificar la seva casa'; end if;
  if p_wall_color !~ '^#[0-9A-Fa-f]{6}$' or p_accent_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Color no vàlid'; end if;
  if coalesce(p_model,'cub') <> 'cub' and not exists (
      select 1 from inventory i join shop_items si on si.id = i.item_id where i.student_id = sid and si.slot = 'model' and si.key = p_model) then
    raise exception 'No tens aquest model de casa';
  end if;
  for k, v in select key, value #>> '{}' from jsonb_each(coalesce(p_slots,'{}'::jsonb)) loop
    if v is null or v = '' then continue; end if;
    if not exists (select 1 from inventory i join shop_items si on si.id = i.item_id
                   where i.student_id = sid and si.key = v and si.slot = k) then
      raise exception 'No tens l''objecte % per a la ranura %', v, k;
    end if;
    clean := clean || jsonb_build_object(k, v);
  end loop;
  insert into houses (student_id, model, wall_color, accent_color, slots, updated_at)
  values (sid, coalesce(p_model,'cub'), p_wall_color, p_accent_color, clean, now())
  on conflict (student_id) do update set model = excluded.model, wall_color = excluded.wall_color,
    accent_color = excluded.accent_color, slots = excluded.slots, updated_at = now();
  return public._house_json(sid);
end $$;

create or replace function public.save_avatar(p_avatar jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid; clean jsonb;
begin
  perform public._require_auth();
  sid := public.my_student_id();
  if sid is null then raise exception 'Només l''alumne pot canviar el seu avatar'; end if;
  select coalesce(jsonb_object_agg(key, value), '{}'::jsonb) into clean
    from jsonb_each(coalesce(p_avatar,'{}'::jsonb))
   where key in ('skin','suit','visor','helmet','antenna','face','badge') and jsonb_typeof(value) = 'string' and length(value #>> '{}') <= 20;
  update students set avatar = clean where id = sid;
  return clean;
end $$;

-- Missions per a l'alumne (laboratoris i nucli)
create or replace function public.student_missions()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare sid uuid;
begin
  perform public._require_auth();
  sid := public.my_student_id();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', m.id, 'title', m.title, 'description', m.description, 'kind', m.kind, 'line', m.line,
                                        'icon', m.icon, 'xp', m.xp, 'coins', m.coins, 'goal', m.goal, 'repeatable', m.repeatable,
                                        'unlock_name', m.unlock_name, 'unlocked_at', m.unlocked_at,
                                        'badge', (select jsonb_build_object('name', b.name, 'icon', b.icon) from badges b where b.id = m.badge_id),
                                        'progress', case when m.kind = 'comunitaria' then public._community_progress(m.id) else (select count(*) from mission_completions mc where mc.mission_id = m.id) end,
                                        'done', (select count(*) from mission_completions mc where mc.mission_id = m.id and mc.student_id = sid))
                     order by m.kind, m.sort, m.title)
      from missions m where m.active), '[]'::jsonb);
end $$;

-- Centre de Competicions: activitats públiques (sense llistes de noms)
create or replace function public.public_activities()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare sid uuid;
begin
  perform public._require_auth();
  sid := public.my_student_id();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', a.id, 'name', a.name, 'kind', a.kind, 'activity_date', a.activity_date,
                                        'description', a.description, 'location', a.location,
                                        'xp_participa', a.xp_participa, 'xp_collabora', a.xp_collabora, 'xp_destaca', a.xp_destaca,
                                        'participants', (select count(*) from activity_participants ap where ap.activity_id = a.id),
                                        'badge', (select jsonb_build_object('name', b.name, 'icon', b.icon) from badges b where b.id = a.badge_id),
                                        'my_role', (select ap.role from activity_participants ap where ap.activity_id = a.id and ap.student_id = sid))
                     order by a.activity_date desc)
      from activities a), '[]'::jsonb);
end $$;

-- Museu dels Assoliments
create or replace function public.museum()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare sid uuid;
begin
  perform public._require_auth();
  sid := public.my_student_id();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', b.id, 'name', b.name, 'icon', b.icon, 'color', b.color, 'description', b.description,
                                        'category', b.category, 'rule_type', b.rule_type, 'rule_value', b.rule_value,
                                        'awarded_at', (select sb.awarded_at from student_badges sb where sb.badge_id = b.id and sb.student_id = sid),
                                        'holders', (select count(*) from student_badges sb where sb.badge_id = b.id))
                     order by b.category, b.sort, b.name)
      from badges b where b.active), '[]'::jsonb);
end $$;

-- ───────────── Informe complet d'un alumne (família, professorat, admin, el mateix alumne) ─────────────
create or replace function public.student_report(p_student_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare s students; xp int; lvl int;
begin
  perform public._require_auth();
  if not public.can_view_student(p_student_id) then raise exception 'No tens accés a aquest alumne' using errcode = '42501'; end if;
  select * into s from students where id = p_student_id;
  xp := public.student_xp(s.id); lvl := public.level_for_xp(xp);
  return jsonb_build_object(
    'student', jsonb_build_object('id', s.id, 'first_name', s.first_name, 'last_name', s.last_name, 'avatar', s.avatar,
                                  'start_year', s.start_year, 'years', public.student_years(s.id), 'birth_year', s.birth_year),
    'xp', xp, 'coins', public.student_coins(s.id), 'level', lvl,
    'level_xp', public.xp_for_level(lvl), 'next_level_xp', public.xp_for_level(lvl+1),
    'xp_this_year', (select coalesce(sum(pm.xp),0) from point_movements pm where pm.student_id = s.id and pm.undone_at is null
                       and pm.created_at >= make_date(public._academic_start_year(), 9, 1)),
    'groups', coalesce((select jsonb_agg(jsonb_build_object('code', g.code, 'name', g.name, 'line', g.line))
                          from enrollments e join groups g on g.id = e.group_id where e.student_id = s.id and g.active), '[]'::jsonb),
    'attendance', (select jsonb_build_object(
                     'present', count(*) filter (where a.status = 'present'),
                     'justificada', count(*) filter (where a.status = 'justificada'),
                     'injustificada', count(*) filter (where a.status = 'injustificada'),
                     'total', count(*))
                   from attendance a join class_sessions cs on cs.id = a.session_id and cs.confirmed_at is not null
                   where a.student_id = s.id and cs.session_date >= make_date(public._academic_start_year(), 9, 1)),
    'badges', public._badges_json(s.id),
    'recent', public._recent_json(s.id, 25),
    'competencies', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'key', c.key, 'name', c.name, 'icon', c.icon, 'color', c.color,
                                          'description', c.description, 'family_explanation', c.family_explanation,
                                          'total', (select count(*) from point_movements pm where pm.student_id = s.id and pm.competency_id = c.id and pm.undone_at is null),
                                          'months', (select jsonb_agg(jsonb_build_object('month', to_char(m, 'YYYY-MM'),
                                                                 'count', (select count(*) from point_movements pm where pm.student_id = s.id and pm.competency_id = c.id
                                                                             and pm.undone_at is null and date_trunc('month', pm.created_at) = m)) order by m)
                                                     from generate_series(date_trunc('month', now()) - interval '5 months', date_trunc('month', now()), interval '1 month') m))
                       order by c.sort)
        from competencies c where c.active), '[]'::jsonb),
    'activities', coalesce((
      select jsonb_agg(jsonb_build_object('name', a.name, 'kind', a.kind, 'date', a.activity_date, 'role', ap.role, 'description', a.description) order by a.activity_date desc)
        from activity_participants ap join activities a on a.id = ap.activity_id where ap.student_id = s.id), '[]'::jsonb),
    'missions', coalesce((
      select jsonb_agg(jsonb_build_object('title', m.title, 'icon', m.icon, 'kind', m.kind, 'line', m.line, 'date', mc.created_at) order by mc.created_at desc)
        from mission_completions mc join missions m on m.id = mc.mission_id where mc.student_id = s.id), '[]'::jsonb),
    'timeline', coalesce((
      select jsonb_agg(t order by t->>'date') from (
        select jsonb_build_object('date', make_date(s.start_year, 9, 1), 'type', 'inici', 'title', 'Comença a ClauTIC', 'icon', '🚀') t
        union all
        select jsonb_build_object('date', h.created_at::date, 'type', 'historial', 'title', h.year_label || ': ' || h.description, 'icon', '📜', 'sort_label', h.year_label)
          from student_history h where h.student_id = s.id
        union all
        select jsonb_build_object('date', sb.awarded_at::date, 'type', 'insignia', 'title', b.name, 'icon', b.icon)
          from student_badges sb join badges b on b.id = sb.badge_id where sb.student_id = s.id
        union all
        select jsonb_build_object('date', a.activity_date, 'type', 'activitat', 'title', a.name, 'icon', '🏆')
          from activity_participants ap join activities a on a.id = ap.activity_id where ap.student_id = s.id
      ) x), '[]'::jsonb),
    'house', public._house_json(s.id));
end $$;

-- ───────────── Estadístiques del grup per al professorat (eina d'equilibri) ─────────────
create or replace function public.group_stats(p_group_id uuid, p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => greatest(p_days,1));
begin
  perform public._require_auth();
  if not public.teaches_group(p_group_id) then raise exception 'No tens accés a aquest grup' using errcode = '42501'; end if;
  return jsonb_build_object(
    'group', (select jsonb_build_object('id', id, 'code', code, 'name', name, 'line', line) from groups where id = p_group_id),
    'days', p_days,
    'students', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', s.id, 'name', public._short_name(s.first_name, s.last_name), 'avatar', s.avatar,
          'recognitions', (select count(*) from point_movements pm where pm.student_id = s.id and pm.group_id = p_group_id and pm.undone_at is null
                             and pm.source in ('competencia','accio_rapida') and pm.created_at >= since),
          'xp', (select coalesce(sum(pm.xp),0) from point_movements pm where pm.student_id = s.id and pm.undone_at is null and pm.created_at >= since),
          'last', (select max(pm.created_at) from point_movements pm where pm.student_id = s.id and pm.group_id = p_group_id and pm.undone_at is null
                     and pm.source in ('competencia','accio_rapida')),
          'by_competency', (select coalesce(jsonb_object_agg(c.key, cnt), '{}'::jsonb) from (
                              select pm.competency_id, count(*) cnt from point_movements pm
                               where pm.student_id = s.id and pm.group_id = p_group_id and pm.undone_at is null and pm.created_at >= since and pm.competency_id is not null
                               group by pm.competency_id) z join competencies c on c.id = z.competency_id),
          'attendance', (select jsonb_build_object('present', count(*) filter (where a.status = 'present'), 'total', count(*))
                           from attendance a join class_sessions cs on cs.id = a.session_id
                          where a.student_id = s.id and cs.group_id = p_group_id and cs.session_date >= since::date))
        order by s.first_name)
      from enrollments e join students s on s.id = e.student_id and s.active where e.group_id = p_group_id), '[]'::jsonb),
    'competencies', coalesce((
      select jsonb_agg(jsonb_build_object('key', c.key, 'name', c.name, 'icon', c.icon, 'color', c.color,
                       'count', (select count(*) from point_movements pm where pm.competency_id = c.id and pm.group_id = p_group_id and pm.undone_at is null and pm.created_at >= since))
                       order by c.sort)
      from competencies c where c.active), '[]'::jsonb),
    'weekly', coalesce((
      select jsonb_agg(jsonb_build_object('week', to_char(w, 'YYYY-MM-DD'),
                       'xp', (select coalesce(sum(pm.xp),0) from point_movements pm where pm.group_id = p_group_id and pm.undone_at is null
                                and pm.created_at >= w and pm.created_at < w + interval '7 days'),
                       'count', (select count(*) from point_movements pm where pm.group_id = p_group_id and pm.undone_at is null
                                and pm.source in ('competencia','accio_rapida') and pm.created_at >= w and pm.created_at < w + interval '7 days')) order by w)
      from generate_series(date_trunc('week', now()) - interval '7 weeks', date_trunc('week', now()), interval '1 week') w), '[]'::jsonb));
end $$;

-- Competències visibles per a tothom (explicació pedagògica per a les famílies)
create or replace function public.competencies_public()
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'key', key, 'name', name, 'icon', icon, 'color', color, 'description', description,
                                               'examples', examples, 'family_explanation', family_explanation) order by sort), '[]'::jsonb)
    from competencies where active
$$;

-- ════════ 20261121000005_admin.sql ════════
-- ClauTIC Quest · Administració

create or replace function public._require_admin()
returns uuid language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_auth();
  if not public.is_admin() then raise exception 'Només per a administració' using errcode = '42501'; end if;
  return auth.uid();
end $$;

-- Taules de configuració editables amb CRUD genèric
create or replace function public._admin_table_pk(_t text)
returns text language sql immutable as $$
  select case _t
    when 'academic_years' then 'id' when 'districts' then 'id' when 'groups' then 'id'
    when 'competencies' then 'id' when 'quick_actions' then 'id' when 'point_rules' then 'key'
    when 'settings' then 'key' when 'badges' then 'id' when 'shop_items' then 'id'
    when 'missions' then 'id' when 'activities' then 'id' when 'student_history' then 'id'
    else null end
$$;

create or replace function public.admin_list(p_table text)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare res jsonb; ord text;
begin
  perform public._require_admin();
  if public._admin_table_pk(p_table) is null then raise exception 'Taula no permesa'; end if;
  ord := case
    when p_table in ('districts','competencies','quick_actions','point_rules','badges','shop_items','missions') then 'sort'
    when p_table = 'academic_years' then 'start_date desc'
    when p_table = 'activities' then 'activity_date desc'
    when p_table = 'groups' then 'line, length(code), code'
    else public._admin_table_pk(p_table) end;
  execute format('select coalesce(jsonb_agg(to_jsonb(t) order by %s), ''[]''::jsonb) from public.%I t', ord, p_table) into res;
  return res;
end $$;

create or replace function public.admin_save(p_table text, p_row jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare pk text := public._admin_table_pk(p_table); cols text; ex text; res jsonb; found_row boolean;
begin
  perform public._require_admin();
  if pk is null then raise exception 'Taula no permesa'; end if;
  if pk = 'id' and coalesce(p_row->>'id','') = '' then p_row := p_row || jsonb_build_object('id', gen_random_uuid()); end if;
  if p_table = 'academic_years' and coalesce((p_row->>'is_current')::boolean, false) then
    update academic_years set is_current = false where id <> (p_row->>'id')::uuid;
  end if;
  select string_agg(quote_ident(k), ','), string_agg('excluded.' || quote_ident(k), ',')
    into cols, ex
    from jsonb_object_keys(p_row) k
   where exists (select 1 from information_schema.columns c where c.table_schema = 'public' and c.table_name = p_table and c.column_name = k);
  execute format('select exists (select 1 from public.%I where %I::text = $1)', p_table, pk) using p_row->>pk into found_row;
  if found_row then
    execute format('update public.%I t set (%s) = (select %s from jsonb_populate_record(null::public.%I, $1)) where t.%I::text = $1->>%L returning to_jsonb(t.*)',
                   p_table, cols, cols, p_table, pk, pk)
      using p_row into res;
  else
    execute format('insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, $1) returning to_jsonb(%I.*)',
                   p_table, cols, cols, p_table, p_table)
      using p_row into res;
  end if;
  perform public._audit('desar', p_table, res->>pk, p_row);
  return res;
end $$;

create or replace function public.admin_delete(p_table text, p_id text)
returns void language plpgsql security definer set search_path = public as $$
declare pk text := public._admin_table_pk(p_table);
begin
  perform public._require_admin();
  if pk is null then raise exception 'Taula no permesa'; end if;
  execute format('delete from public.%I where %I::text = $1', p_table, pk) using p_id;
  perform public._audit('esborrar', p_table, p_id, null);
end $$;

-- ───────────── Alumnes ─────────────
create or replace function public.admin_students()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'first_name', s.first_name, 'last_name', s.last_name, 'birth_year', s.birth_year, 'start_year', s.start_year,
      'active', s.active, 'consent_family', s.consent_family, 'consent_images', s.consent_images, 'notes', s.notes,
      'avatar', s.avatar, 'has_account', s.user_id is not null, 'district_id', s.district_id,
      'username', (select u.email from auth.users u where u.id = s.user_id),
      'invite_code', (select i.code from invitations i where i.student_id = s.id and i.used_at is null and i.role = 'student' limit 1),
      'group_ids', coalesce((select jsonb_agg(e.group_id) from enrollments e where e.student_id = s.id), '[]'::jsonb),
      'groups', coalesce((select jsonb_agg(g.code order by g.code) from enrollments e join groups g on g.id = e.group_id where e.student_id = s.id), '[]'::jsonb),
      'families', coalesce((select jsonb_agg(p.full_name) from family_students fs join profiles p on p.id = fs.family_id where fs.student_id = s.id), '[]'::jsonb),
      'xp', public.student_xp(s.id), 'coins', public.student_coins(s.id), 'level', public.level_for_xp(public.student_xp(s.id)),
      'years', public.student_years(s.id))
      order by s.first_name, s.last_name)
    from students s), '[]'::jsonb);
end $$;

create or replace function public.admin_save_student(p jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare sid uuid := nullif(p->>'id','')::uuid; g uuid;
begin
  perform public._require_admin();
  if coalesce(trim(p->>'first_name'),'') = '' then raise exception 'Cal el nom'; end if;
  if sid is null then
    insert into students (first_name, last_name, birth_year, start_year, active, consent_family, consent_images, notes)
    values (trim(p->>'first_name'), coalesce(trim(p->>'last_name'),''), nullif(p->>'birth_year','')::int,
            coalesce(nullif(p->>'start_year','')::int, public._academic_start_year()), coalesce((p->>'active')::boolean, true),
            coalesce((p->>'consent_family')::boolean,false), coalesce((p->>'consent_images')::boolean,false), coalesce(p->>'notes',''))
    returning id into sid;
  else
    update students set first_name = trim(p->>'first_name'), last_name = coalesce(trim(p->>'last_name'),''),
      birth_year = nullif(p->>'birth_year','')::int, start_year = coalesce(nullif(p->>'start_year','')::int, start_year),
      active = coalesce((p->>'active')::boolean, active), consent_family = coalesce((p->>'consent_family')::boolean, consent_family),
      consent_images = coalesce((p->>'consent_images')::boolean, consent_images), notes = coalesce(p->>'notes', notes)
    where id = sid;
  end if;
  if p ? 'group_ids' then
    delete from enrollments where student_id = sid and group_id not in (select (jsonb_array_elements_text(p->'group_ids'))::uuid);
    insert into enrollments (student_id, group_id)
    select sid, (jsonb_array_elements_text(p->'group_ids'))::uuid on conflict do nothing;
  end if;
  perform public._assign_plot(sid);
  perform public._ensure_invite(sid);
  perform public._check_badges(sid);
  perform public._audit('desar_alumne', 'students', sid::text, p);
  return jsonb_build_object('id', sid);
end $$;

create or replace function public.admin_delete_student(p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare u uuid;
begin
  perform public._require_admin();
  select user_id into u from students where id = p_id;
  delete from students where id = p_id;
  if u is not null then delete from auth.users where id = u; end if;
  perform public._audit('esborrar_alumne', 'students', p_id::text, null);
end $$;

-- Importació massiva. Files: {first_name, last_name, birth_year, start_year, groups:"R1, V2", history:"2022-23: R1 | 2023-24: R2", xp_previ}
create or replace function public.admin_import_students(p_rows jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare r jsonb; sid uuid; code text; gcode text; gid uuid; h text; created int := 0; errors jsonb := '[]'::jsonb;
        codes jsonb := '[]'::jsonb; i int := 0; prev int;
begin
  perform public._require_admin();
  for r in select * from jsonb_array_elements(p_rows) loop
    i := i + 1;
    begin
      if coalesce(trim(r->>'first_name'),'') = '' then raise exception 'Falta el nom'; end if;
      insert into students (first_name, last_name, birth_year, start_year)
      values (trim(r->>'first_name'), coalesce(trim(r->>'last_name'),''), nullif(trim(r->>'birth_year'),'')::int,
              coalesce(nullif(trim(r->>'start_year'),'')::int, public._academic_start_year()))
      returning id into sid;
      foreach gcode in array regexp_split_to_array(coalesce(r->>'groups',''), '\s*[,;]\s*') loop
        if trim(gcode) = '' then continue; end if;
        select g.id into gid from groups g join academic_years y on y.id = g.academic_year_id and y.is_current
         where upper(g.code) = upper(trim(gcode));
        if gid is null then raise exception 'Grup desconegut: %', gcode; end if;
        insert into enrollments (student_id, group_id) values (sid, gid) on conflict do nothing;
      end loop;
      foreach h in array regexp_split_to_array(coalesce(r->>'history',''), '\s*\|\s*') loop
        if trim(h) = '' then continue; end if;
        insert into student_history (student_id, year_label, description)
        values (sid, trim(split_part(h, ':', 1)), coalesce(nullif(trim(substr(h, strpos(h, ':') + 1)), ''), trim(h)));
      end loop;
      prev := nullif(trim(coalesce(r->>'xp_previ','')),'')::int;
      if prev is not null and prev > 0 then
        perform public._award(sid, 'importacio', prev, 0, 'Trajectòria anterior', null, null, null, 'import:' || sid);
      end if;
      perform public._assign_plot(sid);
      code := public._ensure_invite(sid);
      perform public._check_badges(sid);
      codes := codes || jsonb_build_object('name', trim(r->>'first_name') || ' ' || coalesce(trim(r->>'last_name'),''), 'code', code);
      created := created + 1;
    exception when others then
      errors := errors || jsonb_build_object('row', i, 'error', sqlerrm);
    end;
  end loop;
  perform public._audit('importar_alumnes', 'students', null, jsonb_build_object('created', created, 'errors', jsonb_array_length(errors)));
  return jsonb_build_object('created', created, 'errors', errors, 'codes', codes);
end $$;

-- ───────────── Persones i invitacions ─────────────
create or replace function public.admin_people(p_role public.app_role)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'email', p.email, 'created_at', p.created_at,
      'groups', case when p_role = 'teacher' then coalesce((select jsonb_agg(jsonb_build_object('id', g.id, 'code', g.code)) from teacher_groups tg join groups g on g.id = tg.group_id where tg.teacher_id = p.id), '[]'::jsonb) end,
      'children', case when p_role = 'family' then coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'name', s.first_name || ' ' || s.last_name, 'consent_family', s.consent_family)) from family_students fs join students s on s.id = fs.student_id where fs.family_id = p.id), '[]'::jsonb) end)
      order by p.full_name)
    from profiles p join user_roles ur on ur.user_id = p.id and ur.role = p_role), '[]'::jsonb);
end $$;

create or replace function public.admin_set_teacher_groups(p_teacher uuid, p_group_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  delete from teacher_groups where teacher_id = p_teacher and group_id <> all(coalesce(p_group_ids,'{}'));
  insert into teacher_groups (teacher_id, group_id) select p_teacher, unnest(coalesce(p_group_ids,'{}')) on conflict do nothing;
  perform public._audit('professor_grups', 'profiles', p_teacher::text, to_jsonb(p_group_ids));
end $$;

create or replace function public.admin_set_family_students(p_family uuid, p_student_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  delete from family_students where family_id = p_family and student_id <> all(coalesce(p_student_ids,'{}'));
  insert into family_students (family_id, student_id) select p_family, unnest(coalesce(p_student_ids,'{}')) on conflict do nothing;
  perform public._audit('familia_fills', 'profiles', p_family::text, to_jsonb(p_student_ids));
end $$;

create or replace function public.admin_create_invitation(p_role public.app_role, p_full_name text,
                                                          p_student_ids uuid[] default '{}', p_group_ids uuid[] default '{}')
returns jsonb language plpgsql security definer set search_path = public as $$
declare c text := public._gen_code();
begin
  perform public._require_admin();
  if p_role = 'student' then raise exception 'Les invitacions d''alumne es creen des de la fitxa de l''alumne'; end if;
  insert into invitations (code, role, full_name, student_ids, group_ids, created_by)
  values (c, p_role, coalesce(p_full_name,''), coalesce(p_student_ids,'{}'), coalesce(p_group_ids,'{}'), auth.uid());
  perform public._audit('invitacio', 'invitations', c, jsonb_build_object('role', p_role));
  return jsonb_build_object('code', c);
end $$;

create or replace function public.admin_invitations()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return coalesce((
    select jsonb_agg(jsonb_build_object('code', i.code, 'role', i.role, 'full_name', coalesce(nullif(i.full_name,''), s.first_name || ' ' || s.last_name),
                                        'student_id', i.student_id, 'created_at', i.created_at,
                                        'groups', (select jsonb_agg(g.code) from enrollments e join groups g on g.id = e.group_id where e.student_id = i.student_id))
                     order by i.role, i.full_name)
      from invitations i left join students s on s.id = i.student_id where i.used_at is null), '[]'::jsonb);
end $$;

create or replace function public.admin_regenerate_invite(p_student_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  delete from invitations where student_id = p_student_id and used_at is null;
  return jsonb_build_object('code', public._ensure_invite(p_student_id));
end $$;

-- ───────────── Grups ─────────────
create or replace function public.admin_groups()
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return coalesce((
    select jsonb_agg(to_jsonb(g) || jsonb_build_object(
      'year', y.name, 'is_current', y.is_current,
      'student_ids', coalesce((select jsonb_agg(e.student_id) from enrollments e where e.group_id = g.id), '[]'::jsonb),
      'teachers', coalesce((select jsonb_agg(jsonb_build_object('id', p.id, 'name', p.full_name)) from teacher_groups tg join profiles p on p.id = tg.teacher_id where tg.group_id = g.id), '[]'::jsonb))
      order by y.start_date desc, g.line, length(g.code), g.code)
    from groups g join academic_years y on y.id = g.academic_year_id), '[]'::jsonb);
end $$;

create or replace function public.admin_set_group_students(p_group uuid, p_student_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  delete from enrollments where group_id = p_group and student_id <> all(coalesce(p_student_ids,'{}'));
  insert into enrollments (student_id, group_id) select unnest(coalesce(p_student_ids,'{}')), p_group on conflict do nothing;
  perform public._audit('grup_alumnes', 'groups', p_group::text, to_jsonb(p_student_ids));
end $$;

-- Crea els grups estàndard de ClauTIC per a un curs (R1–R7, V1–V8, M1–M2)
create or replace function public.admin_create_standard_groups(p_year_id uuid)
returns int language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform public._require_admin();
  insert into groups (code, name, line, academic_year_id)
  select 'R' || i, 'Robòtica ' || i, 'robotica', p_year_id from generate_series(1,7) i
  union all select 'V' || i, 'Videojocs ' || i, 'videojocs', p_year_id from generate_series(1,8) i
  union all select 'M' || i, 'Minecraft ' || i, 'minecraft', p_year_id from generate_series(1,2) i
  on conflict (code, academic_year_id) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- ───────────── Moviments i correccions ─────────────
create or replace function public.admin_movements(p_student_id uuid default null, p_limit int default 300)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return coalesce((
    select jsonb_agg(x order by (x->>'created_at') desc) from (
      select jsonb_build_object('id', pm.id, 'student_id', pm.student_id, 'student', s.first_name || ' ' || s.last_name,
        'teacher', p.full_name, 'group', g.code, 'source', pm.source, 'label', pm.label, 'xp', pm.xp, 'coins', pm.coins,
        'note', pm.note, 'created_at', pm.created_at, 'undone_at', pm.undone_at) x
      from point_movements pm join students s on s.id = pm.student_id
      left join profiles p on p.id = pm.created_by left join groups g on g.id = pm.group_id
      where p_student_id is null or pm.student_id = p_student_id
      order by pm.created_at desc limit p_limit) t), '[]'::jsonb);
end $$;

create or replace function public.admin_correct(p_student_id uuid, p_xp int, p_coins int, p_note text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._require_admin();
  if coalesce(trim(p_note),'') = '' then raise exception 'Indica el motiu de la correcció'; end if;
  perform public._award(p_student_id, 'correccio', coalesce(p_xp,0), coalesce(p_coins,0), 'Correcció', null, null, null, null, null, p_note);
  perform public._audit('correccio', 'students', p_student_id::text, jsonb_build_object('xp', p_xp, 'coins', p_coins, 'note', p_note));
  return jsonb_build_object('xp', public.student_xp(p_student_id), 'coins', public.student_coins(p_student_id));
end $$;

create or replace function public.admin_toggle_movement(p_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare m point_movements;
begin
  perform public._require_admin();
  update point_movements set undone_at = case when undone_at is null then now() else null end,
                             undone_by = case when undone_at is null then auth.uid() else null end
   where id = p_id returning * into m;
  perform public._audit(case when m.undone_at is null then 'restaurar_moviment' else 'anular_moviment' end, 'point_movements', p_id::text, to_jsonb(m));
  return to_jsonb(m);
end $$;

create or replace function public.admin_audit(p_limit int default 100)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', a.id, 'actor', p.full_name, 'action', a.action, 'entity', a.entity,
                                                       'entity_id', a.entity_id, 'data', a.data, 'created_at', a.created_at) order by a.id desc)
                     from (select * from audit_log order by id desc limit p_limit) a left join profiles p on p.id = a.actor), '[]'::jsonb);
end $$;

-- ───────────── Activitats extraordinàries ─────────────
create or replace function public.activity_detail(p_activity_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  perform public._require_auth();
  if not public.is_staff() then raise exception 'Sense permís' using errcode = '42501'; end if;
  return jsonb_build_object(
    'activity', (select to_jsonb(a) from activities a where a.id = p_activity_id),
    'participants', coalesce((select jsonb_agg(jsonb_build_object('student_id', ap.student_id, 'role', ap.role, 'awarded_at', ap.awarded_at,
                                                                  'name', s.first_name || ' ' || s.last_name))
                                from activity_participants ap join students s on s.id = ap.student_id where ap.activity_id = p_activity_id), '[]'::jsonb));
end $$;

-- Desa participants i (opcionalment) concedeix punts massivament.
-- Participar sempre suma; col·laborar i destacar hi afegeixen un extra.
create or replace function public.admin_save_participants(p_activity_id uuid, p_entries jsonb, p_award boolean default true)
returns jsonb language plpgsql security definer set search_path = public as $$
declare a activities; e jsonb; st uuid; rl participation_role; n int := 0; ids uuid[] := '{}';
begin
  perform public._require_admin();
  select * into a from activities where id = p_activity_id;
  if not found then raise exception 'Activitat no trobada'; end if;
  for e in select * from jsonb_array_elements(coalesce(p_entries,'[]'::jsonb)) loop
    st := (e->>'student_id')::uuid; rl := coalesce(e->>'role','participa')::participation_role; ids := ids || st;
    insert into activity_participants (activity_id, student_id, role) values (a.id, st, rl)
    on conflict (activity_id, student_id) do update set role = excluded.role;
    if p_award then
      if public._award(st, 'activitat', a.xp_participa, a.coins_participa, a.name || ' · participació', null, null, a.id, 'act:' || a.id || ':' || st || ':participa') then n := n + 1; end if;
      if rl = 'collabora' then
        perform public._award(st, 'activitat', a.xp_collabora, a.coins_collabora, a.name || ' · col·laboració', null, null, a.id, 'act:' || a.id || ':' || st || ':collabora');
      elsif rl = 'destaca' then
        perform public._award(st, 'activitat', a.xp_destaca, a.coins_destaca, a.name || ' · resultat destacat', null, null, a.id, 'act:' || a.id || ':' || st || ':destaca');
      end if;
      if a.badge_id is not null then perform public._give_badge(st, a.badge_id, a.name); end if;
      update activity_participants set awarded_at = coalesce(awarded_at, now()) where activity_id = a.id and student_id = st;
      perform public._check_badges(st);
    end if;
  end loop;
  -- Treu els participants que ja no hi són i encara no han rebut punts
  delete from activity_participants where activity_id = a.id and awarded_at is null and student_id <> all(ids);
  perform public._audit('activitat_participants', 'activities', a.id::text, jsonb_build_object('count', jsonb_array_length(p_entries), 'awarded', n));
  return jsonb_build_object('saved', jsonb_array_length(p_entries), 'awarded', n);
end $$;

-- ───────────── Estadístiques generals ─────────────
create or replace function public.admin_stats(p_days int default 30)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare since timestamptz := now() - make_interval(days => p_days);
begin
  perform public._require_auth();
  if not public.is_staff() then raise exception 'Sense permís' using errcode = '42501'; end if;
  return jsonb_build_object(
    'totals', jsonb_build_object(
      'students', (select count(*) from students where active),
      'with_account', (select count(*) from students where active and user_id is not null),
      'teachers', (select count(*) from user_roles where role = 'teacher'),
      'families', (select count(*) from user_roles where role = 'family'),
      'groups', (select count(*) from groups g join academic_years y on y.id = g.academic_year_id and y.is_current where g.active),
      'xp_period', (select coalesce(sum(xp),0) from point_movements where undone_at is null and xp > 0 and created_at >= since),
      'recognitions_period', (select count(*) from point_movements where undone_at is null and source in ('competencia','accio_rapida') and created_at >= since),
      'coins_spent', (select coalesce(-sum(coins),0) from point_movements where undone_at is null and source = 'compra'),
      'badges_awarded', (select count(*) from student_badges),
      'missions_completed', (select count(*) from mission_completions)),
    'weekly', coalesce((
      select jsonb_agg(jsonb_build_object('week', to_char(w, 'YYYY-MM-DD'),
        'xp', (select coalesce(sum(xp),0) from point_movements where undone_at is null and xp > 0 and created_at >= w and created_at < w + interval '7 days'),
        'recognitions', (select count(*) from point_movements where undone_at is null and source in ('competencia','accio_rapida') and created_at >= w and created_at < w + interval '7 days'),
        'attendance', (select round(100.0 * count(*) filter (where a.status = 'present') / nullif(count(*),0)) from attendance a join class_sessions cs on cs.id = a.session_id
                        where cs.session_date >= w::date and cs.session_date < (w + interval '7 days')::date)) order by w)
      from generate_series(date_trunc('week', now()) - interval '11 weeks', date_trunc('week', now()), interval '1 week') w), '[]'::jsonb),
    'attendance', (select jsonb_build_object('present', count(*) filter (where a.status = 'present'),
                                             'justificada', count(*) filter (where a.status = 'justificada'),
                                             'injustificada', count(*) filter (where a.status = 'injustificada'))
                     from attendance a join class_sessions cs on cs.id = a.session_id where cs.session_date >= since::date),
    'competencies', coalesce((
      select jsonb_agg(jsonb_build_object('key', c.key, 'name', c.name, 'icon', c.icon, 'color', c.color,
        'count', (select count(*) from point_movements pm where pm.competency_id = c.id and pm.undone_at is null and pm.created_at >= since)) order by c.sort)
      from competencies c where c.active), '[]'::jsonb),
    'low_recognized', coalesce((
      select jsonb_agg(x order by (x->>'count')::int, x->>'name') from (
        select jsonb_build_object('id', s.id, 'name', s.first_name || ' ' || s.last_name,
          'groups', (select jsonb_agg(g.code) from enrollments e join groups g on g.id = e.group_id and g.active where e.student_id = s.id),
          'count', (select count(*) from point_movements pm where pm.student_id = s.id and pm.undone_at is null and pm.source in ('competencia','accio_rapida') and pm.created_at >= since)) x
        from students s where s.active and exists (select 1 from enrollments e join groups g on g.id = e.group_id and g.active where e.student_id = s.id)
          and (public.is_admin() or public.teaches_student(s.id))
        order by 1 limit 400) t where (x->>'count')::int <= 2), '[]'::jsonb),
    'groups', coalesce((
      select jsonb_agg(jsonb_build_object('id', g.id, 'code', g.code, 'line', g.line,
        'students', (select count(*) from enrollments e where e.group_id = g.id),
        'xp', (select coalesce(sum(pm.xp),0) from point_movements pm where pm.group_id = g.id and pm.undone_at is null and pm.created_at >= since),
        'recognitions', (select count(*) from point_movements pm where pm.group_id = g.id and pm.undone_at is null and pm.source in ('competencia','accio_rapida') and pm.created_at >= since),
        'weeks', (select jsonb_agg((select count(*) from point_movements pm where pm.group_id = g.id and pm.undone_at is null and pm.source in ('competencia','accio_rapida')
                                      and pm.created_at >= w and pm.created_at < w + interval '7 days') order by w)
                    from generate_series(date_trunc('week', now()) - interval '5 weeks', date_trunc('week', now()), interval '1 week') w))
        order by g.line, length(g.code), g.code)
      from groups g join academic_years y on y.id = g.academic_year_id and y.is_current
      where g.active and (public.is_admin() or public.teaches_group(g.id))), '[]'::jsonb),
    'activities', coalesce((
      select jsonb_agg(jsonb_build_object('name', a.name, 'date', a.activity_date,
        'participa', (select count(*) from activity_participants ap where ap.activity_id = a.id),
        'collabora', (select count(*) from activity_participants ap where ap.activity_id = a.id and ap.role = 'collabora'),
        'destaca', (select count(*) from activity_participants ap where ap.activity_id = a.id and ap.role = 'destaca')) order by a.activity_date desc)
      from activities a), '[]'::jsonb),
    'missions', coalesce((
      select jsonb_agg(jsonb_build_object('title', m.title, 'icon', m.icon, 'kind', m.kind,
        'count', case when m.kind = 'comunitaria' then public._community_progress(m.id) else (select count(*) from mission_completions mc where mc.mission_id = m.id) end, 'goal', m.goal) order by m.sort)
      from missions m where m.active), '[]'::jsonb));
end $$;

-- ───────────── Permisos d'execució ─────────────
do $$
declare f record;
begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.prokind = 'f'
  loop
    execute format('revoke all on function %s from public', f.sig);
    begin execute format('revoke all on function %s from anon', f.sig); exception when undefined_object then null; end;
    begin execute format('revoke all on function %s from authenticated', f.sig); exception when undefined_object then null; end;
    -- Les funcions internes (prefix _), el trigger i els saldos per id no són accessibles per RPC
    if left(f.proname, 1) <> '_' and f.proname not in ('handle_new_user', 'student_xp', 'student_coins', 'student_years') then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
end $$;
grant execute on function public.check_invitation(text) to anon;
-- Funcions internes utilitzades per polítiques RLS
grant execute on function public._short_name(text, text) to authenticated;

-- ════════ 20261121000006_initial_config.sql ════════
-- ClauTIC Quest · Configuració inicial (sense dades personals ni comptes)
-- Curs, barris, grups R1–R7 / V1–V8 / M1–M2, competències, accions ràpides, regles de punts,
-- botiga, insígnies i missions. Tot és editable des del panell d'administració.
set search_path = public, extensions;

-- ───────────── Configuració base ─────────────
insert into settings (key, value) values
  ('dedupe_seconds', '3'), ('undo_minutes', '15')
on conflict do nothing;

insert into academic_years (name, start_date, end_date, is_current) values
  ('2025-2026', '2025-09-01', '2026-06-30', false),
  ('2026-2027', '2026-09-01', '2027-06-30', true)
on conflict do nothing;

insert into districts (name, color, sort, capacity) values
  ('Barri Cian', '#22D3EE', 0, 24), ('Barri Violeta', '#8B5CF6', 1, 24),
  ('Barri Grana', '#E5213B', 2, 24), ('Barri Menta', '#34D399', 3, 24);

insert into groups (code, name, line, academic_year_id, weekday, schedule)
select g.code, g.name, g.line::edu_line, (select id from academic_years where is_current), g.wd, g.sch
from (values
  ('R1','Robòtica 1 · Primària','robotica',1,'Dl 17:00-18:30'), ('R2','Robòtica 2 · Primària','robotica',2,'Dt 17:00-18:30'),
  ('R3','Robòtica 3','robotica',3,'Dc 17:00-18:30'), ('R4','Robòtica 4','robotica',4,'Dj 17:00-18:30'),
  ('R5','Robòtica 5 · ESO','robotica',1,'Dl 18:30-20:00'), ('R6','Robòtica 6 · ESO','robotica',3,'Dc 18:30-20:00'),
  ('R7','Robòtica 7 · Competició','robotica',6,'Ds 10:00-12:00'),
  ('V1','Videojocs 1 · Scratch','videojocs',1,'Dl 17:00-18:30'), ('V2','Videojocs 2 · Scratch','videojocs',2,'Dt 17:00-18:30'),
  ('V3','Videojocs 3 · Construct','videojocs',3,'Dc 17:00-18:30'), ('V4','Videojocs 4 · Construct','videojocs',4,'Dj 17:00-18:30'),
  ('V5','Videojocs 5 · Godot','videojocs',2,'Dt 18:30-20:00'), ('V6','Videojocs 6 · Godot','videojocs',4,'Dj 18:30-20:00'),
  ('V7','Videojocs 7 · Unity','videojocs',5,'Dv 17:00-18:30'), ('V8','Videojocs 8 · Projectes','videojocs',6,'Ds 12:00-14:00'),
  ('M1','Minecraft Education 1','minecraft',5,'Dv 17:00-18:30'), ('M2','Minecraft Education 2','minecraft',5,'Dv 18:30-20:00')
) as g(code, name, line, wd, sch);


insert into competencies (key, name, icon, color, description, examples, family_explanation, xp, coins, sort) values
 ('autonomia','Autonomia','🧭','#22D3EE','Treballa i pren decisions sense dependre constantment de l''adult.',
   array['Busca la solució abans de preguntar','Organitza el seu material','Continua el projecte sense que li ho recordin'],
   'Reconeixem que el vostre fill o filla és capaç d''avançar pel seu compte, prendre decisions i buscar recursos. És la base per aprendre a aprendre.', 10, 5, 1),
 ('creativitat','Creativitat','💡','#FBBF24','Proposa idees originals i solucions diferents.',
   array['Inventa una mecànica nova al joc','Dissenya un robot amb una solució original','Combina idees de manera inesperada'],
   'Valorem les idees pròpies i les solucions diferents. La tecnologia no és només seguir instruccions: és inventar.', 10, 5, 2),
 ('cooperacio','Cooperació','🤝','#34D399','Treballa en equip i ajuda els companys.',
   array['Ajuda un company encallat','Reparteix tasques en equip','Escolta i respecta les idees dels altres'],
   'Ha ajudat altres companys o ha treballat bé en equip. A ClauTIC aprenem junts i compartim el que sabem.', 10, 5, 3),
 ('perseveranca','Perseverança','🧗','#F472B6','No es rendeix davant els errors i les dificultats.',
   array['Torna a provar després d''un error','Depura el codi fins que funciona','Acaba el repte encara que costi'],
   'Davant d''un error o d''un repte difícil no s''ha rendit. Equivocar-se forma part d''aprendre a programar.', 10, 5, 4),
 ('aprenentatge','Aprenentatge','📚','#60A5FA','Aplica coneixements nous i previs.',
   array['Aplica un concepte après en una altra sessió','Fa servir correctament un sensor nou','Explica el que ha après'],
   'Ha demostrat que ha après alguna cosa nova i que la sap aplicar. Reconeixem el progrés, no la perfecció.', 10, 5, 5),
 ('comunicacio','Comunicació','🎤','#A78BFA','Explica, documenta i presenta el seu treball.',
   array['Presenta el projecte al grup','Documenta el codi o el muntatge','Explica clarament un problema'],
   'Ha sabut explicar o presentar la seva feina. Comunicar el que fem és tan important com fer-ho.', 10, 5, 6),
 ('responsabilitat','Responsabilitat','🛡️','#2DD4BF','Cuida el material, l''espai i els compromisos.',
   array['Recull i guarda el material','Assumeix un rol a l''equip','Compleix el que s''ha compromès a fer'],
   'Ha tingut cura del material, de l''espai o ha assumit una responsabilitat dins del grup.', 10, 5, 7),
 ('esforc','Esforç','💪','#E5213B','Hi posa ganes i dedicació, independentment del resultat.',
   array['Treballa concentrat tota la sessió','Millora respecte a la sessió anterior','Hi dedica temps extra'],
   'Reconeixem la dedicació i les ganes, encara que el resultat encara no sigui perfecte. L''esforç és el que fa créixer.', 10, 5, 8),
 ('compromis','Compromís','🎯','#FB923C','Implicació amb el grup, els projectes i l''acadèmia.',
   array['Porta idees de casa','Participa en activitats voluntàries','Anima l''equip'],
   'Mostra implicació amb el grup i amb els projectes. Agraïm aquesta actitud positiva.', 10, 5, 9);

insert into quick_actions (label, icon, competency_id, xp, coins, sort)
select q.label, q.icon, (select id from competencies where key = q.comp), q.xp, q.coins, q.sort
from (values
  ('Bon esforç','💪','esforc',10,5,1), ('Ha ajudat un company','🤝','cooperacio',10,5,2),
  ('Ha resolt un problema','🧩','perseveranca',10,5,3), ('Bona idea','💡','creativitat',10,5,4),
  ('Ha perseverat','🧗','perseveranca',10,5,5), ('Ha aplicat coneixements previs','📚','aprenentatge',10,5,6),
  ('Ha documentat el projecte','📝','comunicacio',10,5,7), ('Ha assumit responsabilitats','🛡️','responsabilitat',10,5,8)
) as q(label, icon, comp, xp, coins, sort);

insert into point_rules (key, label, xp, coins, description, sort) values
  ('assistencia', 'Assistència', 5, 2, 'S''atorga automàticament en confirmar la sessió.', 1),
  ('torneig', 'Participació en torneig', 40, 20, 'Lliga Minecraft, Sumo, competicions…', 2),
  ('altres_activitats', 'Participació en altres activitats', 20, 10, 'Jornades, activitats comunitàries…', 3),
  ('presentacio', 'Presentació de projecte', 30, 15, 'Presentar una creació davant el grup o les famílies.', 4),
  ('final_curs', 'Finalització de curs', 100, 50, 'En acabar el curs acadèmic.', 5);

insert into shop_items (key, name, slot, description, price, min_level, exclusive, color, sort) values
  ('torre','Casa Torre','model','Dos pisos i terrassa al terrat.',120,3,false,'#E8F1FF',1),
  ('cupula','Casa Cúpula','model','Cúpula geodèsica de vidre intel·ligent.',200,6,false,'#E8F1FF',2),
  ('solar_basic','Plaques solars','teulada','Energia neta per a la teva casa.',30,1,false,'#1E3A8A',1),
  ('antena','Antena de comunicacions','teulada','Connecta amb tota la ciutat.',40,1,false,'#94A3B8',2),
  ('turbina','Mini turbina eòlica','teulada','Gira amb el vent del barri.',70,3,false,'#E8F1FF',3),
  ('parabolica','Antena parabòlica','teulada','Rep senyals de l''espai.',90,4,false,'#CBD5E1',4),
  ('solar_pro','Plaques solars Pro','teulada','Plaques bifacials amb seguiment solar.',140,7,false,'#312E81',5),
  ('arbre_tec','Arbre tecnològic','jardi','Fulles que brillen de nit.',35,1,false,'#34D399',1),
  ('bonsai_led','Bonsai LED','jardi','Petit però espectacular.',45,2,false,'#A3E635',2),
  ('flors_holo','Flors hologràfiques','jardi','Canvien de color cada segon.',60,3,false,'#F472B6',3),
  ('font_mini','Font d''aigua lluminosa','jardi','Aigua reciclada amb llums.',100,5,false,'#22D3EE',4),
  ('robot_gos','Robot gos','robot','Fidel i juganer.',60,2,false,'#E5213B',1),
  ('robot_huma','Robot ajudant','robot','T''espera a la porta.',110,4,false,'#E8F1FF',2),
  ('robot_aranya','Robot aranya','robot','Sis potes i molta personalitat.',150,6,false,'#8B5CF6',3),
  ('dron_basic','Dron explorador','dron','Vigila el barri des de l''aire.',50,2,false,'#22D3EE',1),
  ('dron_llum','Dron de llum','dron','Il·lumina la nit.',90,4,false,'#FBBF24',2),
  ('dron_carrega','Dron de càrrega','dron','Porta paquets d''un costat a l''altre.',130,6,false,'#FB923C',3),
  ('holo_logo','Holograma ClauTIC','holograma','El logo de l''acadèmia en 3D.',40,1,false,'#E5213B',1),
  ('holo_pixel','Holograma píxel','holograma','Un personatge de 8 bits que saluda.',70,3,false,'#A3E635',2),
  ('holo_planeta','Holograma planeta','holograma','Un planeta que gira sobre la casa.',100,5,false,'#60A5FA',3),
  ('holo_cub','Cub de Minecraft','holograma','Un bloc hologràfic que levita.',80,4,false,'#34D399',4),
  ('bateria','Bateria domèstica','energia','Guarda l''energia del dia.',40,1,false,'#34D399',1),
  ('generador','Generador cinètic','energia','Energia del moviment.',80,4,false,'#FBBF24',2),
  ('nucli_mini','Mini nucli d''energia','energia','Una rèplica del gran nucli de la plaça.',160,8,false,'#E5213B',3),
  ('led_cian','LED cian','llum','Franja de llum cian.',20,1,false,'#22D3EE',1),
  ('led_violeta','LED violeta','llum','Franja de llum violeta.',20,1,false,'#8B5CF6',2),
  ('led_vermell','LED vermell ClauTIC','llum','El color de la casa.',20,1,false,'#E5213B',3),
  ('led_arcadia','LED arc de Sant Martí','llum','Tots els colors alhora.',90,5,false,'#F472B6',4),
  ('porta_lliscant','Porta lliscant','porta','S''obre sola en apropar-t''hi.',30,1,false,'#94A3B8',1),
  ('porta_portal','Porta portal','porta','Una porta que sembla un portal.',120,6,false,'#8B5CF6',2),
  ('facana_panells','Façana de panells','facana','Panells modulars amb juntes de llum.',50,2,false,'#CBD5E1',1),
  ('facana_vidre','Façana de vidre','facana','Vidre intel·ligent que s''enfosqueix.',90,4,false,'#7DD3FC',2),
  ('facana_circuit','Façana circuit','facana','Dibuix de placa base.',130,6,false,'#34D399',3),
  -- Exclusius (es desbloquegen amb insígnies)
  ('holo_trofeu','Trofeu hologràfic','holograma','Exclusiu: has participat en un torneig.',0,1,true,'#FBBF24',10),
  ('robot_veterà','Robot veterà','robot','Exclusiu: cinc anys a ClauTIC.',0,1,true,'#FBBF24',10),
  ('antena_daurada','Antena daurada','teulada','Exclusiu: tres anys a ClauTIC.',0,1,true,'#FBBF24',10),
  ('led_or','LED daurat','llum','Exclusiu: nivell 10.',0,1,true,'#FBBF24',10);

insert into badges (key, name, icon, color, description, category, rule_type, rule_value, xp, coins, unlock_item_key, sort) values
  ('any_1','Primer any','🌱','#34D399','Benvingut/da a ClauTIC! Aquest és el teu primer curs.','antiguitat','anys',1,0,10,null,1),
  ('anys_3','Tres anys','🌿','#22D3EE','Tres cursos aprenent amb nosaltres.','antiguitat','anys',3,0,25,'antena_daurada',2),
  ('anys_5','Cinc anys','🌳','#8B5CF6','Cinc cursos! Ja ets part de la història de ClauTIC.','antiguitat','anys',5,0,40,'robot_veterà',3),
  ('anys_7','Set anys','🏛️','#FBBF24','Set cursos: llegenda de ClauTIC City.','antiguitat','anys',7,0,60,null,4),
  ('nivell_5','Nivell 5','⚡','#22D3EE','Has arribat al nivell 5.','fita','nivell',5,0,15,null,10),
  ('nivell_10','Nivell 10','🔋','#8B5CF6','Has arribat al nivell 10.','fita','nivell',10,0,30,'led_or',11),
  ('nivell_20','Nivell 20','🌟','#FBBF24','Has arribat al nivell 20.','fita','nivell',20,0,50,null,12),
  ('reco_25','25 reconeixements','🎖️','#F472B6','Has rebut 25 reconeixements del professorat.','fita','reconeixements',25,0,15,null,13),
  ('reco_100','100 reconeixements','🏵️','#E5213B','Cent vegades reconegut/da. Increïble!','fita','reconeixements',100,0,40,null,14),
  ('missions_5','Explorador/a de missions','🗺️','#60A5FA','Has completat 5 missions.','missio','missions',5,0,20,null,20),
  ('activitats_3','Sempre a punt','🎪','#FB923C','Has participat en 3 activitats extraordinàries.','activitat','activitats',3,0,20,null,21),
  ('torneig','Primer torneig','🏆','#FBBF24','Has participat en un torneig de ClauTIC.','activitat',null,null,0,0,'holo_trofeu',30),
  ('sumo','Lluitador/a de Sumo','🤖','#E5213B','Has competit al Torneig de Sumo de robots.','activitat',null,null,0,0,null,31),
  ('minecraft_lliga','Lliga Minecraft','⛏️','#34D399','Has participat a la Lliga Minecraft.','activitat',null,null,0,0,null,32),
  ('mentor','Mentor/a','🧑‍🏫','#2DD4BF','Ha ajudat molts companys de manera continuada.','especial',null,null,0,20,null,40),
  ('projecte_estrella','Projecte estrella','✨','#A78BFA','Un projecte que ha inspirat tot el grup.','especial',null,null,0,20,null,41);

insert into missions (title, description, kind, line, icon, xp, coins, goal, repeatable, sort, badge_id) values
  ('Ajuda un company','Ajuda algú que està encallat fins que ho resolgui.','individual',null,'🤝',15,10,1,true,1,null),
  ('Resol un error','Troba i corregeix un error (bug) del teu projecte.','individual',null,'🐞',15,10,1,true,2,null),
  ('Documenta un projecte','Explica com funciona el teu projecte amb text, fotos o vídeo.','individual',null,'📝',20,10,1,false,3,null),
  ('Presenta una creació','Presenta el teu projecte davant del grup.','individual',null,'🎤',25,15,1,false,4,(select id from badges where key='projecte_estrella')),
  ('Robot seguidor de línia','Programa un robot que segueixi una línia negra.','individual','robotica','🛤️',25,15,1,false,10,null),
  ('Sensor d''obstacles','Fes que el robot s''aturi davant d''un obstacle.','individual','robotica','📡',20,10,1,false,11,null),
  ('Repte de Sumo','Construeix un robot capaç de treure un altre del dohyo.','individual','robotica','🥋',30,20,1,false,12,null),
  ('El meu primer joc','Crea un joc amb inici, objectiu i final.','individual','videojocs','🎮',25,15,1,false,20,null),
  ('Puntuació i vides','Afegeix un marcador i un sistema de vides al teu joc.','individual','videojocs','❤️',20,10,1,false,21,null),
  ('Nivell secret','Amaga un nivell secret dins del teu joc.','individual','videojocs','🔐',25,15,1,false,22,null),
  ('Constructor de redstone','Fes un mecanisme automàtic amb redstone.','individual','minecraft','🔴',25,15,1,false,30,null),
  ('Agent programador','Programa l''Agent perquè construeixi una estructura.','individual','minecraft','🤖',25,15,1,false,31,null),
  ('Energia per a la plaça','Entre tots, completem 40 missions per encendre la Font Hologràfica de la plaça.','comunitaria',null,'⚡',10,5,40,true,50,null),
  ('Jardí comunitari','Entre tots, completem 80 missions per fer créixer l''Arbre de Cristall.','comunitaria',null,'🌳',10,5,80,true,51,null),
  ('Satèl·lit ClauTIC','La gran fita: 150 missions per llançar el satèl·lit de la ciutat.','comunitaria',null,'🛰️',10,5,150,true,52,null);
update missions set unlock_key = 'font_holografica', unlock_name = 'Font Hologràfica' where title = 'Energia per a la plaça';
update missions set unlock_key = 'arbre_cristall', unlock_name = 'Arbre de Cristall' where title = 'Jardí comunitari';
update missions set unlock_key = 'satellit', unlock_name = 'Satèl·lit ClauTIC' where title = 'Satèl·lit ClauTIC';


analyze;

-- ════════ 20261121000007_remove_demo_accounts.sql ════════
-- ClauTIC Quest · Seguretat: elimina les dades fictícies si una versió anterior les havia carregat.
-- Els comptes de demo tenen una contrasenya pública, així que no poden existir en una instal·lació real.
-- En una base de dades neta aquesta migració no fa res.
do $$
begin
  if exists (select 1 from auth.users where raw_user_meta_data->>'invite_code' like 'DEMO-%') then
    delete from public.students;            -- tots eren fictitis (cascada: moviments, cases, matrícules…)
    delete from public.activities;
    delete from public.class_sessions;
    delete from public.plaza_unlocks;
    delete from public.invitations;
    delete from public.audit_log;
    delete from public.groups g using public.academic_years y where y.id = g.academic_year_id and not y.is_current;
    delete from auth.users where raw_user_meta_data->>'invite_code' like 'DEMO-%';
    update public.missions set unlocked_at = null, created_at = now();
  end if;
end $$;
