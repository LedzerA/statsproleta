-- ============================================================
-- ATUALIZAÇÃO 5 — logística da convocação
-- Rode este arquivo no SQL Editor do Supabase. Idempotente.
--
-- Três campos novos por partida, usados na legenda do compartilhamento
-- da convocação no WhatsApp e na página da partida:
--   meet_time    horário de apresentação (ex.: "10:30")
--   ball_holder  com quem estão as bolas da partida
--   kit_holder   com quem está o uniforme (jogo de camisas)
--
-- O app funciona sem estas colunas — os campos somem do formulário e a
-- legenda sai sem essas linhas; o console do navegador avisa quando faltam.
-- ============================================================

alter table public.matches
  add column if not exists meet_time   text,
  add column if not exists ball_holder text,
  add column if not exists kit_holder  text;
