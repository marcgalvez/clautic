-- Proves de servidor: s'executen com a rol "authenticated" amb diferents usuaris.
\set ON_ERROR_STOP 1
create or replace function pg_temp.login(_email text) returns void language plpgsql security definer as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', (select id from auth.users where email = _email), 'role', 'authenticated')::text, false);
end $$;
create or replace function pg_temp.ok(_cond boolean, _msg text) returns void language plpgsql as $$
begin
  if not coalesce(_cond, false) then raise exception 'FALLA: %', _msg; end if;
  raise notice 'OK  %', _msg;
end $$;
create or replace function pg_temp.fails(_sql text, _msg text) returns void language plpgsql as $$
begin
  begin execute _sql; exception when others then raise notice 'OK  % (%)', _msg, sqlerrm; return; end;
  raise exception 'FALLA: s''esperava error: %', _msg;
end $$;

-- ───── Professora Anna (R1) ─────
select pg_temp.login('anna@clautic.cat');
set role authenticated;

select pg_temp.ok(jsonb_array_length(get_my_context()->'groups') = 5, 'Anna veu només els seus 5 grups');
select pg_temp.ok(jsonb_array_length(class_board((select id from groups where code='R1' and active))->'students') >= 10, 'Graella R1 amb alumnes');
select pg_temp.fails($q$ select class_board((select id from groups where code='V5' and active)) $q$, 'Anna no pot obrir V5');

-- Dos tocs: alumne + competència
create temp table t_ids as select (select id from groups where code='R1' and active) g,
  (select id from students where first_name='Laia') laia,
  (select id from competencies where key='creativitat') comp,
  (select id from students where first_name='Pau') pau;
grant select on t_ids to authenticated;

select pg_temp.ok((award_points(g, array[laia], comp, null, 'k1')->>'awarded')::int = 1, 'Concessió a la Laia') from t_ids;
select pg_temp.ok((award_points(g, array[laia], comp, null, 'k1')->>'awarded')::int = 0, 'Doble clic (mateixa clau) ignorat') from t_ids;
select pg_temp.ok((award_points(g, array[laia], comp, null, 'k2')->>'awarded')::int = 0, 'Finestra antiduplicats de 3 s') from t_ids;
select pg_temp.ok((undo_last(g)->>'undone')::int = 1, 'Desfer l''últim lot') from t_ids;
select pg_temp.ok((award_points(g, array[laia], comp, null, 'k3')->>'awarded')::int = 1, 'Després de desfer es pot tornar a donar') from t_ids;
select pg_temp.ok((award_points(g, (select array_agg(student_id) from enrollments where group_id = g),
                   null, (select id from quick_actions where label='Bon esforç'), 'k4')->>'awarded')::int >= 10, 'Tot el grup amb acció ràpida') from t_ids;
select pg_temp.ok((award_points(g, array[(select id from students s where not exists (select 1 from enrollments e where e.student_id=s.id and e.group_id=t_ids.g) limit 1)], comp, null, 'k5')->>'awarded')::int = 0,
                  'No es poden donar punts a alumnes d''un altre grup') from t_ids;

-- Assistència: tots presents + excepcions
select pg_temp.ok((save_attendance(g, current_date,
   (select jsonb_agg(jsonb_build_object('student_id', student_id, 'status', case when student_id = laia then 'justificada' else 'present' end)) from enrollments where group_id = g), true)->>'awarded')::int >= 9,
  'Assistència confirmada amb XP') from t_ids;
select pg_temp.ok((save_attendance(g, current_date, jsonb_build_array(jsonb_build_object('student_id', laia, 'status', 'present')), true)->>'awarded')::int = 1, 'Canvi d''absència a present') from t_ids;
select pg_temp.ok((save_attendance(g, current_date, jsonb_build_array(jsonb_build_object('student_id', laia, 'status', 'present')), true)->>'awarded')::int = 0, 'Reconfirmar no duplica XP') from t_ids;

-- Missió comunitària: validar una missió individual fa avançar la comunitària
select pg_temp.ok((validate_mission((select id from missions where title='Ajuda un company'), (select array_agg(student_id) from enrollments where group_id = g), g)->>'validated')::int >= 10, 'Validació de missió') from t_ids;
reset role;
select pg_temp.ok((select unlocked_at is not null from missions where title='Jardí comunitari'), 'Fita col·lectiva: Jardí desbloquejat');
select pg_temp.ok(exists (select 1 from plaza_unlocks where key='arbre_cristall'), 'Arbre de Cristall a la plaça');
select pg_temp.login('anna@clautic.cat');
set role authenticated;
select pg_temp.fails($q$ select admin_students() $q$, 'Professor no accedeix a funcions d''admin');
select pg_temp.fails($q$ insert into point_movements (student_id, source, xp) values ((select id from students limit 1), 'correccio', 999) $q$, 'Professor no pot escriure directament');

-- ───── Alumne Nil ─────
select pg_temp.login('nil@alumnes.clautic.app');
select pg_temp.ok((my_dashboard()->'student'->>'first_name') = 'Nil', 'Dashboard del Nil');
select pg_temp.ok((select count(*) from students) = 1, 'RLS: l''alumne només veu la seva fitxa');
select pg_temp.ok((select count(distinct student_id) from point_movements) = 1, 'RLS: només els seus moviments');
select pg_temp.ok(jsonb_array_length(city_overview()->'districts') >= 3, 'Veu el poble');
select pg_temp.ok(not (city_overview()::text like '%birth_year%') and not (city_overview()::text ~ 'Puig Soler'), 'El poble no exposa dades personals');
select pg_temp.fails($q$ select award_points((select id from groups where code='R1' and active), array[my_student_id()], (select id from competencies limit 1), null, 'x') $q$, 'Alumne no es pot donar punts');
select pg_temp.fails($q$ select student_report((select pau from t_ids)) $q$, 'Alumne no veu l''informe d''un altre');
select pg_temp.ok((get_house((select pau from t_ids))->>'is_mine')::boolean = false, 'Pot visitar la casa del Pau');
select pg_temp.fails($q$ select buy_item((select id from shop_items where key='nucli_mini')) $q$, 'No pot comprar per sobre del seu nivell');
select pg_temp.fails($q$ select buy_item((select id from shop_items where key='holo_trofeu')) $q$, 'No pot comprar exclusius');
select pg_temp.ok((buy_item((select id from shop_items where key='led_vermell'))->>'ok')::boolean, 'Compra amb ClauCoins');
select pg_temp.fails($q$ select buy_item((select id from shop_items where key='led_vermell')) $q$, 'No pot comprar dues vegades');
select pg_temp.ok((save_house('cub', '#E8F1FF', '#E5213B', '{"llum":"led_vermell"}'::jsonb)->'slots'->>'llum') = 'led_vermell', 'Desa la casa');
select pg_temp.fails($q$ select save_house('cub', '#E8F1FF', '#E5213B', '{"robot":"robot_aranya"}'::jsonb) $q$, 'No pot posar objectes que no té');
select pg_temp.fails($q$ select save_house('cupula', '#E8F1FF', '#E5213B', '{}'::jsonb) $q$, 'No pot fer servir un model que no té');
select pg_temp.ok(save_avatar('{"suit":"#8B5CF6","helmet":"casc","hack":"x"}'::jsonb) ? 'hack' = false, 'Avatar net');

select pg_temp.fails($q$ select _award(my_student_id(), 'correccio', 9999, 9999, 'hack') $q$, 'Alumne no pot cridar funcions internes');
select pg_temp.fails($q$ select student_xp((select pau from t_ids)) $q$, 'Alumne no pot consultar saldos d''altres');
select pg_temp.fails($q$ select admin_correct(my_student_id(), 999, 999, 'hack') $q$, 'Alumne no pot fer correccions');

-- ───── Família ─────
select pg_temp.login('familia@clautic.cat');
select pg_temp.ok(jsonb_array_length(get_my_context()->'children') = 2, 'La família té 2 fills');
select pg_temp.ok((student_report((select id from students where first_name='Nil'))->'student'->>'first_name') = 'Nil', 'Informe del fill');
select pg_temp.fails($q$ select student_report((select pau from t_ids)) $q$, 'La família no veu altres alumnes');
select pg_temp.ok((select count(*) from students) = 2, 'RLS família: només els fills');

-- ───── Admin ─────
select pg_temp.login('admin@clautic.cat');
select pg_temp.ok(jsonb_array_length(admin_students()) >= 60, 'Admin llista alumnes');
select pg_temp.ok((admin_import_students('[{"first_name":"Test","last_name":"Import","groups":"R3, V2","start_year":"2020","history":"2020-21: R1 | 2021-22: R2"},{"first_name":"","groups":"R1"},{"first_name":"Err","groups":"Z9"}]'::jsonb)->>'created')::int = 1, 'Importació amb errors controlats');
select pg_temp.ok(exists (select 1 from student_badges sb join badges b on b.id = sb.badge_id join students s on s.id = sb.student_id where s.first_name='Test' and b.key='anys_3'), 'Antiguitat importada → insígnia de 3 anys');
select pg_temp.ok((admin_save('competencies', jsonb_build_object('id', (select id from competencies where key='esforc'), 'xp', 12))->>'xp')::int = 12, 'Edició de competència');
select pg_temp.ok((admin_create_invitation('family', 'Família Test', array[(select id from students where first_name='Pau')])->>'code') like 'CQ-%', 'Invitació familiar');
select pg_temp.ok((admin_save_participants((select id from activities where name like 'Presentació%'),
   jsonb_build_array(jsonb_build_object('student_id', (select id from students where first_name='Pau'), 'role', 'destaca')), true)->>'awarded')::int = 1, 'Activitat: concessió massiva');
select pg_temp.ok((admin_correct((select id from students where first_name='Pau'), -5, 0, 'Prova')->>'xp')::int > 0, 'Correcció de punts');
select pg_temp.ok(jsonb_array_length(admin_stats()->'weekly') = 12, 'Estadístiques');
select pg_temp.ok(jsonb_array_length(group_stats((select id from groups where code='R1' and active))->'students') >= 10, 'Estadístiques de grup');
reset role;
select pg_temp.ok((select count(*) from audit_log) > 5, 'Registre d''auditoria');

-- ───── Activació per invitació ─────
select pg_temp.ok((check_invitation((select code from invitations where used_at is null and role='student' limit 1))->>'valid')::boolean, 'Codi d''invitació vàlid');
do $$ begin
  begin
    insert into auth.users (id, email, encrypted_password, raw_user_meta_data) values (gen_random_uuid(), 'x@x.cat', 'x', '{"invite_code":"FALS"}');
    raise exception 'FALLA: codi fals acceptat';
  exception when raise_exception then
    if sqlerrm like 'FALLA%' then raise; end if;
    raise notice 'OK  Codi fals rebutjat (%)', sqlerrm;
  end;
end $$;
select 'TOTES LES PROVES OK' as resultat;
