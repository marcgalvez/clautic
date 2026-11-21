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
