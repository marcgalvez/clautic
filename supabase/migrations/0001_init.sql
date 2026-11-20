-- ChessLab — esquema (Fase 2). Tots els identificadors d'aplicació són text
-- (generats al client) perquè les dades locals es puguin migrar sense canvis.
-- Totes les taules d'usuari tenen Row Level Security: cada usuari només pot
-- llegir i modificar les seves files (auth.uid() = user_id).

-- Perfil escaquístic (1:1 amb auth.users)
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  locale text not null default 'ca' check (locale in ('ca','es','en')),
  session_minutes smallint not null default 15 check (session_minutes in (10,15,20,30,45)),
  lichess_username text,
  chesscom_username text,
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Classificacions externes. Mai es barregen plataformes ni ritmes.
create table public.external_ratings (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('lichess','chesscom','fide')),
  time_control text not null check (time_control in ('bullet','blitz','rapid','classical','correspondence','standard')),
  rating integer not null check (rating between 100 and 3500),
  provisional boolean,
  source text not null check (source in ('self-reported','api')),
  username text,
  recorded_at timestamptz not null
);
create index on public.external_ratings (user_id, platform, time_control, recorded_at desc);

-- Diagnòstics (qüestionari, resultats per ítem i competències)
create table public.diagnostics (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz not null,
  data jsonb not null
);

-- Sessions d'entrenament
create table public.training_sessions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null,
  planned_minutes smallint not null,
  exercise_ids text[] not null default '{}',
  attempt_ids text[] not null default '{}',
  recall jsonb not null default '[]'::jsonb,
  reflection jsonb,
  started_at timestamptz not null,
  completed_at timestamptz
);

-- Intents d'exercicis (resultats)
create table public.attempts (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null,
  session_id text,
  theme text not null,
  concepts text[] not null default '{}',
  difficulty smallint not null,
  context text not null check (context in ('session','free','diagnostic')),
  outcome text not null check (outcome in ('solved','solved-with-help','revealed','abandoned')),
  wrong_moves smallint not null default 0,
  hints_used smallint not null default 0,
  first_try boolean not null,
  duration_ms integer not null check (duration_ms >= 0),
  quality real not null check (quality between 0 and 1),
  reasoning text,
  started_at timestamptz not null
);
create index on public.attempts (user_id, started_at desc);

-- Repassos espaiats (per concepte, no per posició)
create table public.review_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id text not null,
  stage smallint not null,
  interval_days smallint not null,
  due_at timestamptz not null,
  last_reviewed_at timestamptz not null,
  last_quality real not null,
  reviews integer not null default 0,
  primary key (user_id, concept_id)
);
create index on public.review_items (user_id, due_at);

-- Partides importades i la seva anàlisi (dades del motor + interpretació separada)
create table public.games (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('pgn','lichess','chesscom')),
  external_id text,
  pgn text not null check (char_length(pgn) < 200000),
  headers jsonb not null default '{}'::jsonb,
  user_color char(1) check (user_color in ('w','b')),
  played_at timestamptz,
  imported_at timestamptz not null,
  analysis jsonb,
  exercise_ids text[] not null default '{}'
);
create unique index on public.games (user_id, source, external_id) where external_id is not null;

-- Exercicis personalitzats generats a partir de les partides (verificats amb Stockfish al client)
create table public.user_exercises (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

-- Converses amb l'entrenador (Fase 3)
create table public.coach_conversations (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  context jsonb not null,
  messages jsonb not null default '[]'::jsonb,
  created_at timestamptz not null
);

-- Ús de l'entrenador IA, per limitar la despesa per usuari i dia (l'escriu la Edge Function)
create table public.coach_usage (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  input_tokens integer not null default 0,
  output_tokens integer not null default 0
);
create index on public.coach_usage (user_id, created_at desc);

-- Competències: domini per concepte, derivat dels intents (no es duplica la dada)
create view public.concept_mastery with (security_invoker = true) as
  select user_id, c.concept_id,
         avg(quality)::real as avg_quality,
         count(*)::int as attempts,
         count(distinct exercise_id)::int as distinct_exercises,
         max(started_at) as last_attempt_at
  from public.attempts, unnest(concepts) as c(concept_id)
  group by user_id, c.concept_id;

-- ===== Row Level Security =====
do $$
declare t text;
begin
  foreach t in array array['profiles','external_ratings','diagnostics','training_sessions','attempts','review_items',
                           'games','user_exercises','coach_conversations']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows: select" on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: insert" on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: update" on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
    execute format('create policy "own rows: delete" on public.%I for delete to authenticated using ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- coach_usage: l'usuari només el pot llegir; només la Edge Function (service role) hi escriu.
alter table public.coach_usage enable row level security;
create policy "own usage: select" on public.coach_usage for select to authenticated using ((select auth.uid()) = user_id);
