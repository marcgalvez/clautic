-- ClauTIC Quest · DADES FICTÍCIES DE DEMOSTRACIÓ (no és una migració)
-- Només per a la demo al navegador i les proves locals. MAI a producció:
-- crea comptes amb una contrasenya pública (clautic2026).
set search_path = public, extensions;

-- Curs anterior (grups desactivats) per demostrar l'activació per curs
insert into groups (code, name, line, academic_year_id, active)
select code, name, line, (select id from academic_years where name = '2025-2026'), false
from groups where academic_year_id = (select id from academic_years where is_current) and code in ('R1','R2','V1','M1');
-- Les missions comunitàries compten des de fa 70 dies (historial de demo)
update missions set created_at = now() - interval '70 days' where kind = 'comunitaria';

insert into activities (name, kind, activity_date, description, location, xp_participa, xp_collabora, xp_destaca, coins_participa, coins_collabora, coins_destaca, badge_id) values
  ('Lliga Minecraft · Jornada 1','torneig', current_date - 40, 'Construcció col·laborativa d''una ciutat sostenible en equips.', 'Aula Minecraft', 40, 10, 10, 20, 5, 5, (select id from badges where key='minecraft_lliga')),
  ('Torneig de Sumo de robots','torneig', current_date - 18, 'Combats de robots minisumo construïts pels alumnes.', 'Sala gran', 40, 10, 10, 20, 5, 5, (select id from badges where key='sumo')),
  ('Jornada de portes obertes','comunitaria', current_date - 60, 'Els alumnes expliquen els seus projectes a les famílies visitants.', 'Tota l''acadèmia', 20, 10, 0, 10, 5, 0, null),
  ('Presentació de projectes de Nadal','presentacio', current_date + 25, 'Mostra dels videojocs i robots del primer trimestre.', 'Sala gran', 30, 10, 10, 15, 5, 5, null),
  ('Competició regional de robòtica','competicio', current_date + 60, 'L''equip de competició representa ClauTIC.', 'Fira de Barcelona', 40, 15, 15, 20, 5, 10, (select id from badges where key='torneig'));


-- ───────────── Comptes de demostració ─────────────
create or replace function public._seed_user(_email text, _full_name text, _code text)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare uid uuid := gen_random_uuid();
begin
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', uid, 'authenticated', 'authenticated', _email,
          crypt('clautic2026', gen_salt('bf')), now(),
          '{"provider":"email","providers":["email"]}'::jsonb,
          jsonb_build_object('full_name', _full_name, 'invite_code', _code), now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), uid, uid::text, jsonb_build_object('sub', uid::text, 'email', _email, 'email_verified', true), 'email', now(), now(), now());
  return uid;
end $$;

do $$
declare
  first_names text[] := array['Nil','Laia','Pau','Júlia','Marc','Aina','Pol','Martina','Biel','Ona','Arnau','Carla','Jan','Èlia','Roc','Mia',
    'Hugo','Abril','Gerard','Noa','Oriol','Paula','Àlex','Clàudia','Bruna','Eric','Irene','Joel','Lucía','Adrià','Mariona','Quim',
    'Sara','Teo','Valèria','Xavi','Zoe','Lluc','Emma','Iker','Gal·la','Nora','Dani','Berta','Leo','Txell','Ot','Rita','Max','Lara',
    'Guim','Duna','Isaac','Ariadna','Bernat','Sofia','Unai','Jana','Àngel','Queralt','Mateu','Alba','Ferran','Neus','Ismael','Mar'];
  last_names text[] := array['Puig','Soler','Vidal','Ferrer','Serra','Font','Roca','Pujol','Martí','Casals','Bosch','Riera','Camps','Vila','Mas','Coll',
    'Pons','Sala','Prat','Torres','Llopis','Garcia','Rovira','Badia','Grau','Esteve','Sabaté','Comas','Bertran','Marín'];
  avatars_skin text[] := array['#F5D0B0','#E8B894','#C98E62','#9C6644','#6B4226'];
  suits text[] := array['#E5213B','#22D3EE','#8B5CF6','#34D399','#FBBF24','#F472B6','#60A5FA','#FB923C'];
  helmets text[] := array['casc','cabell','gorra','auriculars','cabell_llarg','pentinat'];
  antennas text[] := array['cap','una','dues','orelles'];
  faces text[] := array['somriure','content','decidit','sorpres'];
  walls text[] := array['#E8F1FF','#DDE7F7','#F5F3FF','#ECFEFF','#FEF2F2','#F0FDF4','#1E293B','#334155'];
  sid uuid; g record; i int; n_groups int; cur_year uuid; t_anna uuid; t_marc uuid; t_jordi uuid; admin_id uuid; fam uuid;
  sess uuid; d date; st record; teacher uuid; c record; k int; it record; slot_items jsonb;
begin
  perform setseed(0.4242);
  select id into cur_year from academic_years where is_current;

  -- Alumnes
  for i in 1..array_length(first_names,1) loop
    insert into students (first_name, last_name, birth_year, start_year, consent_family, consent_images, avatar)
    values (first_names[i], last_names[1 + (i*7) % array_length(last_names,1)] || ' ' || last_names[1 + (i*3+5) % array_length(last_names,1)],
            2008 + (i % 12),
            greatest(2016, 2026 - (floor(random()*random()*9))::int),
            random() < 0.9, random() < 0.7,
            jsonb_build_object('skin', avatars_skin[1 + floor(random()*5)::int], 'suit', suits[1 + floor(random()*8)::int],
                               'visor', suits[1 + floor(random()*8)::int], 'helmet', helmets[1 + floor(random()*6)::int],
                               'antenna', antennas[1 + floor(random()*4)::int], 'face', faces[1 + floor(random()*4)::int]))
    returning id into sid;
    -- Matrícula: 1 grup sempre, 30% en té dos
    n_groups := case when random() < 0.3 then 2 else 1 end;
    insert into enrollments (student_id, group_id)
    select sid, gg.id from groups gg where gg.academic_year_id = cur_year order by random() limit n_groups;
    perform public._assign_plot(sid);
  end loop;
  -- Garantim que els alumnes de demo amb compte siguin a grups concrets
  delete from enrollments where student_id in (select id from students where first_name in ('Nil','Laia','Pau','Júlia'));
  insert into enrollments (student_id, group_id)
  select s.id, gg.id from students s join groups gg on gg.academic_year_id = cur_year
   where (s.first_name = 'Nil' and gg.code in ('R1','V1')) or (s.first_name = 'Laia' and gg.code = 'R1')
      or (s.first_name = 'Pau' and gg.code in ('V1','M1')) or (s.first_name = 'Júlia' and gg.code = 'R2');
  update students set start_year = 2019, birth_year = 2014 where first_name = 'Nil';
  update students set start_year = 2026, birth_year = 2018 where first_name = 'Laia';
  update students set start_year = 2023, birth_year = 2016 where first_name = 'Pau';
  update students set start_year = 2021, birth_year = 2012 where first_name = 'Júlia';
  -- Omplim R1 i V1 perquè el Mode Classe tingui una graella realista
  insert into enrollments (student_id, group_id)
  select s.id, (select id from groups where code = 'R1' and academic_year_id = cur_year) from students s order by s.first_name limit 12 offset 4
  on conflict do nothing;
  insert into enrollments (student_id, group_id)
  select s.id, (select id from groups where code = 'V1' and academic_year_id = cur_year) from students s order by s.last_name limit 10 offset 2
  on conflict do nothing;

  insert into student_history (student_id, year_label, description)
  select id, '2019-20', 'Comença a Robòtica 1 (abans de l''app)' from students where first_name = 'Nil'
  union all select id, '2021-22', 'Primer premi al concurs intern de robots' from students where first_name = 'Nil'
  union all select id, '2023-24', 'Passa a Videojocs i Robòtica' from students where first_name = 'Nil'
  union all select id, '2021-22', 'Comença a Minecraft Education' from students where first_name = 'Júlia';

  -- Invitacions i comptes
  insert into invitations (code, role, full_name) values ('DEMO-ADMIN','admin','Montse Riera (Direcció)');
  admin_id := public._seed_user('admin@clautic.cat', 'Montse Riera', 'DEMO-ADMIN');

  insert into invitations (code, role, full_name, group_ids)
  select 'DEMO-ANNA','teacher','Anna Bosch', array_agg(id) from groups where academic_year_id = cur_year and code in ('R1','R2','R3','R4','V1');
  t_anna := public._seed_user('anna@clautic.cat', 'Anna Bosch', 'DEMO-ANNA');
  insert into invitations (code, role, full_name, group_ids)
  select 'DEMO-MARC','teacher','Marc Ferrer', array_agg(id) from groups where academic_year_id = cur_year and code in ('V2','V3','V4','V5','V6','V7','V8','M1','M2');
  t_marc := public._seed_user('marc@clautic.cat', 'Marc Ferrer', 'DEMO-MARC');
  insert into invitations (code, role, full_name, group_ids)
  select 'DEMO-JORDI','teacher','Jordi Camps', array_agg(id) from groups where academic_year_id = cur_year and code in ('R5','R6','R7');
  t_jordi := public._seed_user('jordi@clautic.cat', 'Jordi Camps', 'DEMO-JORDI');

  insert into invitations (code, role, student_id, full_name)
  select 'DEMO-' || upper(translate(first_name, 'àèéíòóúüçÀÈÉÍÒÓÚ', 'aeeioouucAEEIOOU')), 'student', id, first_name || ' ' || last_name
    from students where first_name in ('Nil','Laia','Pau','Júlia');
  perform public._seed_user('nil@alumnes.clautic.app', 'Nil', 'DEMO-NIL');
  perform public._seed_user('laia@alumnes.clautic.app', 'Laia', 'DEMO-LAIA');
  perform public._seed_user('pau@alumnes.clautic.app', 'Pau', 'DEMO-PAU');
  perform public._seed_user('julia@alumnes.clautic.app', 'Júlia', 'DEMO-JULIA');

  insert into invitations (code, role, full_name, student_ids)
  select 'DEMO-FAMILIA', 'family', 'Família Puig', array_agg(id) from students where first_name in ('Nil','Laia');
  perform public._seed_user('familia@clautic.cat', 'Família Puig', 'DEMO-FAMILIA');

  -- Codis d'invitació pendents per a la resta d'alumnes (per mostrar l'activació)
  perform public._ensure_invite(id) from students where user_id is null;

  -- Historial: 10 setmanes de sessions, assistència i reconeixements
  for g in select gg.*, coalesce((select tg.teacher_id from teacher_groups tg where tg.group_id = gg.id limit 1), admin_id) as teacher
             from groups gg where gg.academic_year_id = cur_year loop
    for k in 1..10 loop
      d := (date_trunc('week', current_date)::date - k*7) + (coalesce(g.weekday,1) - 1);
      if d >= current_date then continue; end if;
      insert into class_sessions (group_id, session_date, teacher_id, confirmed_at)
      values (g.id, d, g.teacher, d + time '19:00') returning id into sess;
      for st in select e.student_id from enrollments e where e.group_id = g.id loop
        insert into attendance (session_id, student_id, status)
        values (sess, st.student_id, case when random() < 0.88 then 'present'::attendance_status
                                          when random() < 0.6 then 'justificada'::attendance_status
                                          else 'injustificada'::attendance_status end);
        if (select status from attendance where session_id = sess and student_id = st.student_id) = 'present' then
          insert into point_movements (student_id, created_by, group_id, source, ref_id, label, xp, coins, dedupe_key, created_at)
          values (st.student_id, g.teacher, g.id, 'assistencia', sess, 'Assistència', 5, 2, 'att:' || sess || ':' || st.student_id, d + time '19:00');
          -- 0 a 3 reconeixements per sessió (alguns alumnes en reben menys, per demostrar l'eina d'equilibri)
          for c in select * from competencies order by random() limit (floor(random() * (case when hashtext(st.student_id::text) % 5 = 0 then 1.3 else 3.6 end)))::int loop
            insert into point_movements (student_id, created_by, group_id, competency_id, source, label, xp, coins, batch_id, created_at)
            values (st.student_id, g.teacher, g.id, c.id, 'competencia', c.name, c.xp, c.coins, gen_random_uuid(),
                    d + time '17:15' + (random() * interval '80 minutes'));
          end loop;
        end if;
      end loop;
    end loop;
  end loop;

  -- XP d'activitats passades
  for st in select id from students order by random() limit 22 loop
    insert into activity_participants (activity_id, student_id, role, awarded_at)
    select a.id, st.id, (array['participa','participa','participa','collabora','destaca'])[1 + floor(random()*5)::int]::participation_role, a.activity_date + time '20:00'
      from activities a where a.name = 'Torneig de Sumo de robots';
  end loop;
  for st in select s.id from students s join enrollments e on e.student_id = s.id join groups gg on gg.id = e.group_id and gg.line = 'minecraft' loop
    insert into activity_participants (activity_id, student_id, role, awarded_at)
    select a.id, st.id, 'participa', a.activity_date + time '20:00' from activities a where a.name like 'Lliga Minecraft%'
    on conflict do nothing;
  end loop;
  for st in select id from students order by random() limit 18 loop
    insert into activity_participants (activity_id, student_id, role, awarded_at)
    select a.id, st.id, case when random() < 0.3 then 'collabora' else 'participa' end::participation_role, a.activity_date + time '20:00'
      from activities a where a.name = 'Jornada de portes obertes';
  end loop;
  insert into activity_participants (activity_id, student_id, role, awarded_at)
  select a.id, s.id, 'destaca', a.activity_date + time '20:00' from activities a, students s
   where a.name = 'Torneig de Sumo de robots' and s.first_name in ('Nil','Júlia')
  on conflict (activity_id, student_id) do update set role = 'destaca';
  insert into point_movements (student_id, source, ref_id, label, xp, coins, dedupe_key, created_at)
  select ap.student_id, 'activitat', a.id, a.name || ' · participació', a.xp_participa, a.coins_participa,
         'act:' || a.id || ':' || ap.student_id || ':participa', ap.awarded_at
    from activity_participants ap join activities a on a.id = ap.activity_id;
  insert into point_movements (student_id, source, ref_id, label, xp, coins, dedupe_key, created_at)
  select ap.student_id, 'activitat', a.id, a.name || case ap.role when 'collabora' then ' · col·laboració' else ' · resultat destacat' end,
         case ap.role when 'collabora' then a.xp_collabora else a.xp_destaca end,
         case ap.role when 'collabora' then a.coins_collabora else a.coins_destaca end,
         'act:' || a.id || ':' || ap.student_id || ':' || ap.role, ap.awarded_at
    from activity_participants ap join activities a on a.id = ap.activity_id where ap.role <> 'participa';
  insert into student_badges (student_id, badge_id, reason, awarded_at)
  select ap.student_id, a.badge_id, a.name, ap.awarded_at from activity_participants ap join activities a on a.id = ap.activity_id
   where a.badge_id is not null on conflict do nothing;

  -- Missions completades (alimenten les missions comunitàries)
  for st in select s.id, (select e.group_id from enrollments e where e.student_id = s.id limit 1) as gid,
                   (select gg.line from enrollments e join groups gg on gg.id = e.group_id where e.student_id = s.id limit 1) as line
              from students s loop
    for c in select m.* from missions m where m.kind = 'individual' and (m.line is null or m.line = st.line)
               order by random() limit floor(random()*3.5)::int loop
      insert into mission_completions (mission_id, student_id, group_id, created_at)
      values (c.id, st.id, st.gid, now() - random() * interval '50 days') returning id into sess;
      insert into point_movements (student_id, group_id, source, ref_id, label, xp, coins, dedupe_key, created_at)
      values (st.id, st.gid, 'missio', sess, 'Missió: ' || c.title, c.xp, c.coins, 'mis:' || sess, now() - random() * interval '50 days');
    end loop;
  end loop;
  update missions set unlocked_at = null where kind = 'comunitaria';
  perform public._check_community();

  -- Insígnies automàtiques (antiguitat, nivell…)
  perform public._check_badges(id) from students;

  -- Cases decorades: cada alumne "compra" uns quants objectes amb les seves monedes
  for st in select id from students loop
    slot_items := '{}'::jsonb;
    for it in select distinct on (si.slot) si.* from shop_items si
               where not si.exclusive and si.slot <> 'model' and si.min_level <= public.level_for_xp(public.student_xp(st.id))
               order by si.slot, random() loop
      exit when public.student_coins(st.id) < it.price + 10;
      if random() < 0.55 then
        insert into inventory (student_id, item_id) values (st.id, it.id) on conflict do nothing;
        insert into point_movements (student_id, source, ref_id, label, xp, coins, dedupe_key, created_at)
        values (st.id, 'compra', it.id, 'Compra: ' || it.name, 0, -it.price, 'buy:' || st.id || ':' || it.id, now() - random() * interval '20 days');
        slot_items := slot_items || jsonb_build_object(it.slot, it.key);
      end if;
    end loop;
    if public.level_for_xp(public.student_xp(st.id)) >= 3 and public.student_coins(st.id) >= 130 and random() < 0.5 then
      insert into inventory (student_id, item_id) select st.id, id from shop_items where key = 'torre' on conflict do nothing;
      insert into point_movements (student_id, source, ref_id, label, xp, coins, dedupe_key)
      select st.id, 'compra', id, 'Compra: Casa Torre', 0, -price, 'buy:' || st.id || ':' || id from shop_items where key = 'torre';
      update houses set model = 'torre' where student_id = st.id;
    end if;
    update houses set slots = slot_items, wall_color = walls[1 + floor(random()*8)::int],
                      accent_color = suits[1 + floor(random()*8)::int] where student_id = st.id;
  end loop;
end $$;

drop function public._seed_user(text, text, text);

-- Estadístiques per al planificador després de la càrrega inicial
analyze;
