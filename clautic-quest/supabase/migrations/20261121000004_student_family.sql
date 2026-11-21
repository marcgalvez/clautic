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
