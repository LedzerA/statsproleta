-- ============================================================
-- ATUALIZAÇÃO 4 — formações táticas (com bola / sem bola)
-- Rode este arquivo no SQL Editor do Supabase. Idempotente.
--
-- Guarda por partida a formação e a vaga de cada titular nas duas
-- fases do jogo:
--   {"com": {"formation": "4-3-3", "slots": ["a12", null, ...]},
--    "sem": {"formation": "4-4-2", "slots": [...]}}
-- slots[i] = id do atleta na vaga i da formação (ordem definida em
-- src/lib/formations.ts), ou null para vaga livre.
--
-- O app funciona sem esta coluna (titulares e posições continuam
-- sendo salvos) — só o desenho tático deixa de persistir; o console
-- do navegador avisa quando ela falta.
-- ============================================================

alter table public.matches
  add column if not exists tactics jsonb;
