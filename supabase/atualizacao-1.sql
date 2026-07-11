-- ============================================================
-- ATUALIZAÇÃO 1 — recupera TUDO da última versão do app antigo
-- Rode este arquivo inteiro no SQL Editor do Supabase (1 vez).
-- Pode rodar de novo sem medo: é idempotente e não apaga nada.
--
-- O que faz:
--  • Devolve a separação de ELENCOS (esporte / veterano)
--  • Recupera TITULARES, POSIÇÕES por atleta, local, horário,
--    uniforme, cronômetro e o flag de arquivada de cada partida
--  • Corrige a partida AGENDADA (estava contando como 0x0)
--  • Converte os lances antigos (gols, substituições, tempos)
--    para a linha do tempo do app novo
-- ============================================================

-- ---------- 1. novas colunas ----------
alter table public.matches
  add column if not exists starters  jsonb not null default '[]',
  add column if not exists positions jsonb not null default '{}',
  add column if not exists venue     text,
  add column if not exists kickoff   text,
  add column if not exists kit       text,
  add column if not exists archived  boolean not null default false,
  add column if not exists clock     jsonb;

-- aceita o evento de substituição na linha do tempo
alter table public.match_events drop constraint if exists match_events_type_check;
alter table public.match_events add constraint match_events_type_check
  check (type in ('inicio','gol_pro','gol_contra','penalti_pro','penalti_contra',
                  'fim_1t','inicio_2t','fim_jogo','sub'));

-- ---------- 2. elencos que existiam no banco antigo ----------
insert into public.squads (id, name, position)
select s.squad,
       upper(left(s.squad, 1)) || substring(s.squad from 2),
       s.rn + coalesce((select max(position) from public.squads), 0)
from (
  select squad, row_number() over (order by squad) as rn
  from (
    select distinct squad from public.athletes_v1 where squad is not null
    union
    select distinct squad from public.matches_v1 where squad is not null
  ) x
  where squad not in (select id from public.squads)
) s
on conflict (id) do nothing;

-- ---------- 3. devolve cada atleta ao seu elenco ----------
update public.athletes a
set    squad_id = v.squad
from   public.athletes_v1 v
where  a.id = v.id
  and  v.squad is not null
  and  a.squad_id is distinct from v.squad;

-- ---------- 4. devolve cada partida ao seu elenco + dados ----------
update public.matches m
set    squad_id  = coalesce(v.squad, m.squad_id),
       starters  = coalesce(v.starters, '[]'::jsonb),
       positions = coalesce(v.positions, '{}'::jsonb),
       venue     = coalesce(m.venue, v.venue),
       kickoff   = coalesce(m.kickoff, v.kickoff::text),
       kit       = coalesce(m.kit, v.kit),
       archived  = coalesce(v.archived, false),
       clock     = coalesce(m.clock, v.clock),
       status    = case
                     when v.status = 'scheduled' and m.status = 'encerrada' then 'agendada'
                     else m.status
                   end
from   public.matches_v1 v
where  m.id = v.id;

-- ---------- 4b. recupera partidas AGENDADAS apagadas por engano ----------
-- (a migração inicial mostrava a agendada como um falso "0x0 encerrado";
--  se ela foi excluída no app, volta aqui como agendada, com titulares,
--  posições, local, horário e uniforme. Jogos encerrados excluídos de
--  propósito NÃO voltam.)
insert into public.matches
  (id, squad_id, date, opponent, status, goals_for, goals_against,
   lineup, starters, positions, scorers, assists, lineup_complete, notes,
   venue, kickoff, kit, archived, clock)
select v.id, coalesce(v.squad, 'esporte'), v.date::date, v.opponent, 'agendada', 0, 0,
       coalesce(v.lineup, '[]'::jsonb), coalesce(v.starters, '[]'::jsonb),
       coalesce(v.positions, '{}'::jsonb), '[]'::jsonb, '[]'::jsonb,
       coalesce(v.lineup_complete, true), coalesce(v.notes, ''),
       v.venue, v.kickoff::text, v.kit, false, null
from public.matches_v1 v
where v.status = 'scheduled'
  and not exists (select 1 from public.matches m where m.id = v.id)
on conflict (id) do nothing;

-- ---------- 5. converte os lances antigos para a linha do tempo ----------
-- (só para partidas que ainda não têm lances no app novo)
insert into public.match_events
  (id, match_id, squad_id, type, minute, athlete_id, assist_id, payload, created_at)
select
  m.id || '-lg-' || e.ord,
  m.id,
  m.squad_id,
  case e.ev->>'type'
    when 'start' then 'inicio'
    when 'goal'  then 'gol_pro'
    when 'ga'    then 'gol_contra'
    when 'ht'    then 'fim_1t'
    when 'st'    then 'inicio_2t'
    when 'end'   then 'fim_jogo'
    when 'sub'   then 'sub'
  end,
  floor(coalesce((e.ev->>'t')::numeric, 0) / 60)::int,
  coalesce(e.ev->>'a', e.ev->>'in'),
  coalesce(e.ev->>'as', e.ev->>'out'),
  jsonb_build_object(
    'legacy', true,
    'period', coalesce((e.ev->>'p')::int, 1),
    'seconds', coalesce((e.ev->>'t')::numeric, 0)::int
  ),
  m.date::timestamptz
    + (coalesce((e.ev->>'p')::int, 1) - 1) * interval '1 hour'
    + coalesce((e.ev->>'t')::numeric, 0) * interval '1 second'
from public.matches_v1 v
join public.matches m on m.id = v.id
cross join lateral jsonb_array_elements(v.events) with ordinality as e(ev, ord)
where jsonb_array_length(coalesce(v.events, '[]'::jsonb)) > 0
  and e.ev->>'type' in ('start','goal','ga','ht','st','end','sub')
  and not exists (select 1 from public.match_events me where me.match_id = m.id)
on conflict (id) do nothing;

-- ---------- conferência (aparece no resultado) ----------
select 'elencos' as tabela, count(*)::text as total from public.squads
union all
select 'atletas esporte', count(*)::text from public.athletes where squad_id = 'esporte'
union all
select 'atletas veterano', count(*)::text from public.athletes where squad_id = 'veterano'
union all
select 'partidas agendadas', count(*)::text from public.matches where status = 'agendada'
union all
select 'partidas com titulares', count(*)::text from public.matches where jsonb_array_length(starters) > 0
union all
select 'lances convertidos', count(*)::text from public.match_events where payload->>'legacy' = 'true';
