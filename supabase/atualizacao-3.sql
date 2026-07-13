-- ============================================================
-- ATUALIZAÇÃO 3 — posições no perfil do atleta
-- Rode este arquivo no SQL Editor do Supabase. Idempotente.
-- Lista de posições do atleta (ex.: ["VOL","MC"]) usada para agrupar
-- a seleção de relacionados e sugerir a posição na partida.
-- ============================================================

alter table public.athletes
  add column if not exists positions jsonb not null default '[]'::jsonb;
