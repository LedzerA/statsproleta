-- ============================================================
-- PROLETA STATS v2 — schema do Supabase
-- Rode este arquivo inteiro no SQL Editor do seu projeto.
-- Modelo de acesso:
--   • Qualquer visitante (sem login) LÊ tudo: elencos, atletas,
--     partidas e lances ao vivo.
--   • Só usuários listados na tabela `admins` podem ESCREVER.
--   • push_subscriptions: qualquer visitante pode registrar o
--     próprio aparelho; ninguém lê a lista pela API pública.
-- ============================================================

-- ---------- migração automática da v1 ----------
-- Se o projeto já tem as tabelas do app antigo (athletes/matches sem
-- squad_id), elas são renomeadas para *_v1 e os dados são copiados
-- para as tabelas novas mais abaixo. Nada é apagado.
do $$
begin
  if exists (select from information_schema.tables
             where table_schema = 'public' and table_name = 'athletes')
     and not exists (select from information_schema.columns
             where table_schema = 'public' and table_name = 'athletes'
               and column_name = 'squad_id') then
    alter table public.athletes rename to athletes_v1;
  end if;
  if exists (select from information_schema.tables
             where table_schema = 'public' and table_name = 'matches')
     and not exists (select from information_schema.columns
             where table_schema = 'public' and table_name = 'matches'
               and column_name = 'squad_id') then
    alter table public.matches rename to matches_v1;
  end if;
end $$;

-- ---------- tabelas ----------
create table if not exists public.squads (
  id         text primary key,
  name       text not null,
  position   int  not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.athletes (
  id         text primary key,
  squad_id   text not null references public.squads(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.matches (
  id              text primary key,
  squad_id        text not null references public.squads(id) on delete cascade,
  date            date not null,
  opponent        text not null,
  status          text not null default 'encerrada'
    check (status in ('agendada','ao_vivo_1t','intervalo','ao_vivo_2t','encerrada')),
  goals_for       int  not null default 0,
  goals_against   int  not null default 0,
  lineup          jsonb not null default '[]',
  scorers         jsonb not null default '[]',
  assists         jsonb not null default '[]',
  lineup_complete boolean not null default true,
  notes           text not null default '',
  started_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.match_events (
  id         text primary key,
  match_id   text not null references public.matches(id) on delete cascade,
  squad_id   text not null,
  type       text not null
    check (type in ('inicio','gol_pro','gol_contra','penalti_pro','penalti_contra','fim_1t','inicio_2t','fim_jogo')),
  minute     int,
  athlete_id text,
  assist_id  text,
  payload    jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  endpoint   text primary key,
  p256dh     text not null,
  auth       text not null,
  squad_id   text,
  created_at timestamptz not null default now()
);

create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  note       text,
  created_at timestamptz not null default now()
);

-- copia os dados da v1 (se existirem) para as tabelas novas
do $$
begin
  if exists (select from information_schema.tables
             where table_schema = 'public' and table_name = 'athletes_v1') then
    insert into public.squads (id, name, position) values ('esporte', 'Esporte', 1)
      on conflict (id) do nothing;
    insert into public.athletes (id, squad_id, name)
      select id, 'esporte', name from public.athletes_v1
      on conflict (id) do nothing;
  end if;
  if exists (select from information_schema.tables
             where table_schema = 'public' and table_name = 'matches_v1') then
    insert into public.squads (id, name, position) values ('esporte', 'Esporte', 1)
      on conflict (id) do nothing;
    insert into public.matches
      (id, squad_id, date, opponent, status, goals_for, goals_against,
       lineup, scorers, assists, lineup_complete, notes)
      select id, 'esporte', date::date, opponent, 'encerrada',
             coalesce(goals_for, 0), coalesce(goals_against, 0),
             coalesce(lineup, '[]'::jsonb), coalesce(scorers, '[]'::jsonb),
             coalesce(assists, '[]'::jsonb), coalesce(lineup_complete, true),
             coalesce(notes, '')
      from public.matches_v1
      on conflict (id) do nothing;
  end if;
end $$;

create index if not exists idx_matches_squad on public.matches(squad_id, date);
create index if not exists idx_events_match on public.match_events(match_id, created_at);
create index if not exists idx_athletes_squad on public.athletes(squad_id);

-- ---------- helper: sou admin? ----------
-- security definer para não esbarrar no RLS da própria tabela admins
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------- RLS ----------
alter table public.squads             enable row level security;
alter table public.athletes           enable row level security;
alter table public.matches            enable row level security;
alter table public.match_events       enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.admins             enable row level security;

-- leitura pública
drop policy if exists "read squads" on public.squads;
create policy "read squads" on public.squads for select using (true);
drop policy if exists "read athletes" on public.athletes;
create policy "read athletes" on public.athletes for select using (true);
drop policy if exists "read matches" on public.matches;
create policy "read matches" on public.matches for select using (true);
drop policy if exists "read events" on public.match_events;
create policy "read events" on public.match_events for select using (true);

-- escrita só de admins
drop policy if exists "write squads" on public.squads;
create policy "write squads" on public.squads for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "write athletes" on public.athletes;
create policy "write athletes" on public.athletes for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "write matches" on public.matches;
create policy "write matches" on public.matches for all
  using (public.is_admin()) with check (public.is_admin());
drop policy if exists "write events" on public.match_events;
create policy "write events" on public.match_events for all
  using (public.is_admin()) with check (public.is_admin());

-- push: qualquer aparelho registra/remove a própria assinatura;
-- sem policy de SELECT -> a lista não é legível pela API pública
-- (a Edge Function usa a service role, que ignora RLS).
drop policy if exists "insert push" on public.push_subscriptions;
create policy "insert push" on public.push_subscriptions for insert with check (true);
drop policy if exists "update push" on public.push_subscriptions;
create policy "update push" on public.push_subscriptions for update using (true) with check (true);
drop policy if exists "delete push" on public.push_subscriptions;
create policy "delete push" on public.push_subscriptions for delete using (true);

-- admins: cada um enxerga só a própria linha (o app usa isso para
-- saber se o usuário logado é admin). Inserções: via painel/SQL.
drop policy if exists "read own admin" on public.admins;
create policy "read own admin" on public.admins for select using (auth.uid() = user_id);

-- ---------- realtime ----------
do $$
begin
  alter publication supabase_realtime add table public.squads;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.athletes;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.matches;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.match_events;
exception when duplicate_object then null;
end $$;

-- ============================================================
-- Para promover um usuário a ADMIN (depois de criá-lo em
-- Authentication -> Users):
--
--   insert into public.admins (user_id, note)
--   values ('<uuid do usuário>', 'nome de quem é');
--
-- Ou por e-mail:
--
--   insert into public.admins (user_id, note)
--   select id, email from auth.users where email = 'email@do.admin';
-- ============================================================
