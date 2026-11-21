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
