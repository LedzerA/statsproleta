-- ============================================================
-- SEED: elenco Esporte + histórico de partidas (migrado do app v1)
-- Rode DEPOIS do schema.sql. Idempotente e NÃO destrutivo: linhas já
-- existentes (ex.: migradas do banco v1) são mantidas como estão.
-- ============================================================

insert into public.squads (id, name, position) values
  ('esporte', 'Esporte', 1)
on conflict (id) do nothing;

insert into public.athletes (id, squad_id, name) values
  ('a1', 'esporte', 'Bibico'),
  ('a2', 'esporte', 'Dudu'),
  ('a3', 'esporte', 'Rosalvo'),
  ('a4', 'esporte', 'Vini França'),
  ('a5', 'esporte', 'Hashi'),
  ('a6', 'esporte', 'Caio'),
  ('a7', 'esporte', 'André'),
  ('a8', 'esporte', 'Fabiano'),
  ('a9', 'esporte', 'Digão'),
  ('a10', 'esporte', 'Wellington'),
  ('a11', 'esporte', 'Rennan'),
  ('a12', 'esporte', 'Meloni'),
  ('a13', 'esporte', 'Renan'),
  ('a14', 'esporte', 'Eloy'),
  ('a15', 'esporte', 'Macapá'),
  ('a16', 'esporte', 'Belaz'),
  ('a17', 'esporte', 'Rafael'),
  ('a18', 'esporte', 'Siqueira'),
  ('a19', 'esporte', 'Luis E.'),
  ('a20', 'esporte', 'Albano'),
  ('a21', 'esporte', 'Wez'),
  ('a22', 'esporte', 'Gzus'),
  ('a23', 'esporte', 'Lima'),
  ('a24', 'esporte', 'Brendon'),
  ('a25', 'esporte', 'Detona'),
  ('a26', 'esporte', 'Euller'),
  ('a27', 'esporte', 'Edu'),
  ('a28', 'esporte', 'Rufus'),
  ('a29', 'esporte', 'Leone'),
  ('a30', 'esporte', 'Pelota'),
  ('a31', 'esporte', 'Romario'),
  ('a32', 'esporte', 'W. Felipe'),
  ('a33', 'esporte', 'Gui Dantas'),
  ('a34', 'esporte', 'Barone'),
  ('a35', 'esporte', 'Igor'),
  ('a36', 'esporte', 'Amaral'),
  ('a37', 'esporte', 'Diego'),
  ('a38', 'esporte', 'Leodan'),
  ('a39', 'esporte', 'Lingo'),
  ('a40', 'esporte', 'Lucas Vini'),
  ('a41', 'esporte', 'Xande'),
  ('a42', 'esporte', 'PH'),
  ('a43', 'esporte', 'Salvador')
on conflict (id) do nothing;

insert into public.matches
  (id, squad_id, date, opponent, status, goals_for, goals_against, lineup, scorers, assists, lineup_complete, notes) values
  ('m1', 'esporte', '2026-01-07', 'Pç Kant', 'encerrada', 1, 3, '["a20"]', '[{"a":"a20","g":1}]', '[]', false, ''),
  ('m2', 'esporte', '2026-01-17', 'Botafogo Vl Bela', 'encerrada', 5, 3, '["a11","a2","a10","a7","a3"]', '[{"a":"a11","g":3},{"a":"a2","g":2}]', '[{"a":"a10","n":1},{"a":"a7","n":1},{"a":"a3","n":1}]', false, ''),
  ('m3', 'esporte', '2026-01-20', 'Inker', 'encerrada', 1, 4, '["a7"]', '[{"a":"a7","g":1}]', '[]', false, ''),
  ('m4', 'esporte', '2026-01-23', 'EC Nacional Mooca', 'encerrada', 2, 1, '["a8"]', '[{"a":"a8","g":2}]', '[]', false, ''),
  ('m5', 'esporte', '2026-01-31', 'Maque FC', 'encerrada', 1, 2, '["a3","a1"]', '[{"a":"a3","g":1}]', '[{"a":"a1","n":1}]', false, ''),
  ('m6', 'esporte', '2026-02-03', 'Juventude', 'encerrada', 1, 4, '["a16","a12"]', '[{"a":"a16","g":1}]', '[{"a":"a12","n":1}]', false, ''),
  ('m7', 'esporte', '2026-02-07', 'Maque FC', 'encerrada', 2, 3, '["a3","a8","a1"]', '[{"a":"a3","g":1},{"a":"a8","g":1}]', '[{"a":"a8","n":1},{"a":"a1","n":1}]', false, ''),
  ('m8', 'esporte', '2026-02-14', 'Atletico Mangalot', 'encerrada', 3, 2, '["a12","a11","a2","a8"]', '[{"a":"a12","g":1},{"a":"a11","g":1},{"a":"a2","g":1}]', '[{"a":"a8","n":1},{"a":"a11","n":1}]', false, ''),
  ('m9', 'esporte', '2026-02-21', 'Sufoco FC', 'encerrada', 1, 4, '["a19","a12"]', '[{"a":"a19","g":1}]', '[{"a":"a12","n":1}]', false, ''),
  ('m10', 'esporte', '2026-02-24', 'Catadão', 'encerrada', 1, 1, '["a14"]', '[{"a":"a14","g":1}]', '[]', false, ''),
  ('m11', 'esporte', '2026-02-28', 'Das Antigas', 'encerrada', 1, 2, '["a2"]', '[{"a":"a2","g":1}]', '[]', false, ''),
  ('m12', 'esporte', '2026-03-07', 'Explosão FC', 'encerrada', 3, 3, '["a8","a27","a11","a10","a4"]', '[{"a":"a8","g":1},{"a":"a27","g":1},{"a":"a11","g":1}]', '[{"a":"a10","n":1},{"a":"a4","n":1}]', false, ''),
  ('m13', 'esporte', '2026-03-14', 'De Primeira', 'encerrada', 3, 3, '["a10","a8","a23","a2"]', '[{"a":"a10","g":1},{"a":"a8","g":1},{"a":"a23","g":1}]', '[{"a":"a8","n":1},{"a":"a2","n":1}]', false, ''),
  ('m14', 'esporte', '2026-03-21', 'AD Ponte Grande', 'encerrada', 5, 4, '["a1","a8","a2","a4","a7","a33","a17"]', '[{"a":"a1","g":1},{"a":"a8","g":2},{"a":"a2","g":2}]', '[{"a":"a4","n":1},{"a":"a7","n":1},{"a":"a33","n":2},{"a":"a17","n":1}]', false, ''),
  ('m15', 'esporte', '2026-03-29', 'Futnoia', 'encerrada', 7, 0, '["a11","a8","a16","a4","a26","a3","a12","a24"]', '[{"a":"a11","g":3},{"a":"a8","g":1},{"a":"a16","g":1},{"a":"a4","g":1},{"a":"a26","g":1}]', '[{"a":"a3","n":1},{"a":"a8","n":1},{"a":"a11","n":2},{"a":"a12","n":1},{"a":"a24","n":1}]', false, ''),
  ('m16', 'esporte', '2026-04-09', 'Al Phumaça', 'encerrada', 0, 1, '[]', '[]', '[]', false, ''),
  ('m17', 'esporte', '2026-04-11', 'Pinguim FC', 'encerrada', 0, 2, '[]', '[]', '[]', false, ''),
  ('m18', 'esporte', '2026-04-15', 'Formigueiro', 'encerrada', 3, 6, '["a11","a8","a10"]', '[{"a":"a11","g":1},{"a":"a8","g":2}]', '[{"a":"a10","n":1},{"a":"a11","n":1}]', false, ''),
  ('m19', 'esporte', '2026-04-18', 'Proleta Vetera/Diverso', 'encerrada', 0, 1, '[]', '[]', '[]', false, ''),
  ('m20', 'esporte', '2026-04-26', 'LIbertarios', 'encerrada', 3, 1, '["a8","a11","a2","a3","a25"]', '[{"a":"a8","g":1},{"a":"a11","g":1},{"a":"a2","g":1}]', '[{"a":"a3","n":1},{"a":"a25","n":1}]', false, ''),
  ('m21', 'esporte', '2026-05-05', 'Código Verde', 'encerrada', 0, 0, '[]', '[]', '[]', false, ''),
  ('m22', 'esporte', '2026-05-09', 'Time do Gueto', 'encerrada', 2, 4, '["a10","a7","a2","a3"]', '[{"a":"a10","g":1},{"a":"a7","g":1}]', '[{"a":"a2","n":1},{"a":"a3","n":1}]', false, ''),
  ('m23', 'esporte', '2026-05-16', 'Samba São Jorge', 'encerrada', 1, 3, '[]', '[]', '[]', false, ''),
  ('m24', 'esporte', '2026-05-24', 'XI De Setembro', 'encerrada', 0, 1, '[]', '[]', '[]', false, ''),
  ('m25', 'esporte', '2026-05-30', 'Corote Molotov', 'encerrada', 1, 1, '["a8"]', '[{"a":"a8","g":1}]', '[]', false, ''),
  ('m26', 'esporte', '2026-06-07', 'Catadão', 'encerrada', 1, 1, '["a2","a11"]', '[{"a":"a2","g":1}]', '[{"a":"a11","n":1}]', false, ''),
  ('m27', 'esporte', '2026-06-20', 'Só de Virada', 'encerrada', 3, 0, '["a2","a11"]', '[{"a":"a2","g":2},{"a":"a11","g":1}]', '[{"a":"a2","n":1}]', false, ''),
  ('m28', 'esporte', '2026-06-27', 'TAP', 'encerrada', 1, 0, '["a12","a2"]', '[{"a":"a12","g":1}]', '[{"a":"a2","n":1}]', false, '')
on conflict (id) do nothing;
