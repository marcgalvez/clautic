-- ChessLab — esquema inicial (es farà servir a la Fase 2).
-- Totes les taules d'usuari tenen Row Level Security: cada usuari només pot
-- llegir i modificar les seves files (auth.uid() = user_id).

create extension if not exists pgcrypto;

-- Perfil escaquístic (1:1 amb auth.users)
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 80),
  locale text not null default 'ca' check (locale in ('ca','es','en')),
  session_minutes smallint not null default 15 check (session_minutes in (10,15,20,30,45)),
  plays_regularly boolean,
  knows_rules boolean,
  goals text[] not null default '{}',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Classificacions externes declarades o importades. Mai es barregen plataformes ni ritmes.
create table public.external_ratings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null check (platform in ('lichess','chesscom','fide')),
  time_control text not null check (time_control in ('bullet','blitz','rapid','classical','correspondence','standard')),
  rating integer not null check (rating between 100 and 3500),
  source text not null check (source in ('self-reported','api')),
  recorded_at timestamptz not null default now()
);
create index on public.external_ratings (user_id, platform, time_control, recorded_at desc);

-- Competències / conceptes pedagògics (catàleg públic)
create table public.concepts (
  id text primary key,
  label_ca text not null,
  area text not null
);

-- Banc d'exercicis (catàleg públic; els personalitzats tenen owner_id)
create table public.exercises (
  id text primary key,
  owner_id uuid references auth.users(id) on delete cascade, -- null = exercici global
  category text not null check (category in ('tactics','strategy','endgame','opening')),
  theme text not null,
  title text not null,
  fen text not null,
  objective text not null,
  difficulty smallint not null check (difficulty between 1 and 5),
  solution text[] not null,
  alternatives jsonb not null default '{}'::jsonb,
  hints text[] not null check (array_length(hints,1) = 3),
  explanation text not null,
  concepts text[] not null default '{}',
  tags text[] not null default '{}',
  source_game_id uuid,                          -- exercicis generats a partir d'una partida
  verification jsonb not null,                  -- resultat de la verificació amb Stockfish
  created_at timestamptz not null default now()
);

-- Partides importades
create table public.games (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('pgn','lichess','chesscom')),
  external_id text,
  pgn text not null,
  headers jsonb not null default '{}'::jsonb,
  user_color char(1) check (user_color in ('w','b')),
  played_at timestamptz,
  imported_at timestamptz not null default now(),
  unique (user_id, source, external_id)
);

-- Anàlisi per jugada (dades objectives del motor + interpretació pedagògica separada)
create table public.game_moves (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  ply integer not null,
  fen_before text not null,
  move_uci text not null,
  best_uci text,
  eval_before jsonb,
  eval_after jsonb,
  engine_depth smallint,
  classification text check (classification in ('best','good','inaccuracy','mistake','blunder')),
  error_type text check (error_type in ('hanging-piece','missed-threat','calculation','opening','positional','endgame','rushed')),
  error_type_confidence text check (error_type_confidence in ('engine-verified','heuristic','needs-evidence')),
  unique (game_id, ply)
);

-- Sessions d'entrenament i intents
create table public.training_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  lesson_id text not null,
  planned_minutes smallint not null,
  plan jsonb not null,
  recall jsonb not null default '[]'::jsonb,
  reflection jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text not null references public.exercises(id),
  session_id uuid references public.training_sessions(id) on delete set null,
  context text not null check (context in ('session','free','diagnostic','review')),
  outcome text not null check (outcome in ('solved','solved-with-help','revealed','abandoned')),
  wrong_moves smallint not null default 0,
  hints_used smallint not null default 0,
  duration_ms integer not null,
  quality real not null check (quality between 0 and 1),
  reasoning text,
  started_at timestamptz not null default now()
);
create index on public.attempts (user_id, started_at desc);

-- Domini per competència i repassos espaiats (per concepte, no per posició)
create table public.concept_mastery (
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id text not null references public.concepts(id),
  avg_quality real not null,
  attempts integer not null,
  distinct_exercises integer not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, concept_id)
);

create table public.review_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  concept_id text not null references public.concepts(id),
  stage smallint not null,
  interval_days smallint not null,
  due_at timestamptz not null,
  last_reviewed_at timestamptz not null,
  last_quality real not null,
  reviews integer not null default 0,
  primary key (user_id, concept_id)
);
create index on public.review_items (user_id, due_at);

-- Pla personalitzat (generat i actualitzat a partir de les dades)
create table public.training_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  main_goal text not null,
  focus_concepts text[] not null default '{}',
  plan jsonb not null,
  valid_from timestamptz not null default now(),
  valid_to timestamptz
);

-- Converses amb l'entrenador (Fase 3)
create table public.coach_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  exercise_id text references public.exercises(id),
  game_id uuid references public.games(id) on delete set null,
  fen text,
  created_at timestamptz not null default now()
);
create table public.coach_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.coach_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant')),
  content text not null,
  engine_facts jsonb,           -- dades del motor en què es basa la resposta
  created_at timestamptz not null default now()
);

-- ===== Row Level Security =====
do $$
declare t text;
begin
  foreach t in array array['profiles','external_ratings','games','game_moves','training_sessions','attempts',
                           'concept_mastery','review_items','training_plans','coach_conversations','coach_messages']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "own rows: select" on public.%I for select using (auth.uid() = user_id)', t);
    execute format('create policy "own rows: insert" on public.%I for insert with check (auth.uid() = user_id)', t);
    execute format('create policy "own rows: update" on public.%I for update using (auth.uid() = user_id) with check (auth.uid() = user_id)', t);
    execute format('create policy "own rows: delete" on public.%I for delete using (auth.uid() = user_id)', t);
  end loop;
end $$;

-- Catàlegs: lectura per a usuaris autenticats; escriptura només amb service role.
alter table public.concepts enable row level security;
create policy "concepts readable" on public.concepts for select to authenticated using (true);

alter table public.exercises enable row level security;
create policy "global or own exercises readable" on public.exercises for select to authenticated
  using (owner_id is null or owner_id = auth.uid());
create policy "own exercises insert" on public.exercises for insert to authenticated with check (owner_id = auth.uid());
create policy "own exercises delete" on public.exercises for delete to authenticated using (owner_id = auth.uid());
