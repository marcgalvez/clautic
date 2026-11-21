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
