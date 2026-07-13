-- ============================================================
-- ATUALIZAÇÃO 2 — novos elencos "Diverso" e "Feminino"
-- Rode este arquivo inteiro no SQL Editor do Supabase
-- (Database → SQL Editor → New query → colar → Run).
-- Pode rodar mais de uma vez: não duplica nem sobrescreve nada.
-- ============================================================

insert into public.squads (id, name, position)
select 'diverso', 'Diverso',
       coalesce((select max(position) from public.squads), 0) + 1
where not exists (
  select 1 from public.squads where id = 'diverso' or lower(name) = 'diverso'
);

insert into public.squads (id, name, position)
select 'feminino', 'Feminino',
       coalesce((select max(position) from public.squads), 0) + 1
where not exists (
  select 1 from public.squads where id = 'feminino' or lower(name) = 'feminino'
);
