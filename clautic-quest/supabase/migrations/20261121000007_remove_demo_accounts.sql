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
