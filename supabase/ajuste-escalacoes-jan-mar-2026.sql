-- ============================================================
-- AJUSTE DE DADOS — escalações e posições das partidas de jan–mar/2026
-- (listas do grupo, 08/07/2026). Rode no SQL Editor do Supabase.
-- Regrava starters, positions (mescla com o que já existe — a lista nova
-- vence), lineup (união) e tactics (formação com bola; sem bola espelha).
-- Obs.: "Jota - PE" (banco do jogo vs Maque 07/02) não existe no elenco
-- e ficou de fora — cadastre o atleta e ajuste pela tela se precisar.
-- ============================================================

-- Juventude 03/02 — 2026-02-03 · 4-1-2-1-2
-- titulares: GOL Renan, LD Meloni, ZD Leone, ZE Rufus, LE Caio, VOL Bibico, MC Wellington, MC Vini França, MEI André, SA Rosalvo, CA Fabiano
-- banco: Belaz (LE/ZG), Siqueira (MC/VOL/ZG/LE), Hashi (VOL/MC), Digão (MEI), Rennan (PE/SA/CA), Dudu (PD/PE), Pelota (SA/CA)
update public.matches set
  starters  = '["a13","a12","a29","a28","a6","a1","a10","a4","a7","a3","a8"]'::jsonb,
  positions = '{"a13":"GOL","a12":"LD","a29":"ZD","a28":"ZE","a6":"LE","a1":"VOL","a10":"MC","a4":"MC","a7":"MEI","a3":"SA","a8":"CA","a16":"LE/ZG","a18":"MC/VOL/ZG/LE","a5":"VOL/MC","a9":"MEI","a11":"PE/SA/CA","a2":"PD/PE","a30":"SA/CA"}'::jsonb,
  lineup    = '["a13","a12","a29","a28","a6","a1","a10","a4","a7","a3","a8","a16","a18","a5","a9","a11","a2","a30"]'::jsonb,
  tactics   = '{"com":{"formation":"4-1-2-1-2","slots":["a13","a12","a29","a28","a6","a1","a10","a4","a7","a3","a8"],"coords":null},"sem":{"formation":"4-1-2-1-2","slots":["a13","a12","a29","a28","a6","a1","a10","a4","a7","a3","a8"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  updated_at = now()
where id = 'm6';

-- Explosão 07/03 — 2026-03-07 · 4-1-2-1-2
-- titulares: GOL W. Felipe, LD Rosalvo, ZD Hashi, ZE Vini França, LE Caio, VOL Bibico, MC Wellington, MC André, MEI Eloy, SA Rennan, CA Fabiano
-- banco: Macapá (ZG), Albano (ZG/LD), Lima (VOL/MC/MEI), Edu (PE/LE/MC), Dudu (PD/PE/SA)
update public.matches set
  starters  = '["a32","a3","a5","a4","a6","a1","a10","a7","a14","a11","a8"]'::jsonb,
  positions = '{"a32":"GOL","a3":"LD","a5":"ZD","a4":"ZE","a6":"LE","a1":"VOL","a10":"MC","a7":"MC","a14":"MEI","a11":"SA","a8":"CA","a15":"ZG","a20":"ZG/LD","a23":"VOL/MC/MEI","a27":"PE/LE/MC","a2":"PD/PE/SA"}'::jsonb,
  lineup    = '["a32","a3","a5","a4","a6","a1","a10","a7","a14","a11","a8","a15","a20","a23","a27","a2"]'::jsonb,
  tactics   = '{"com":{"formation":"4-1-2-1-2","slots":["a32","a3","a5","a4","a6","a1","a10","a7","a14","a11","a8"],"coords":null},"sem":{"formation":"4-1-2-1-2","slots":["a32","a3","a5","a4","a6","a1","a10","a7","a14","a11","a8"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  updated_at = now()
where id = 'm12';

-- Maque FC 31/01 (amistoso) — 2026-01-31 · 4-1-2-1-2
-- titulares: GOL Renan, LD Meloni, ZD Albano, ZE Leone, LE Caio, VOL Bibico, MC Vini França, MC Wellington, MEI André, SA Rosalvo, CA Fabiano
-- banco: Belaz (LE/ZG), Siqueira (VOL/ZG/LE), Hashi (MC/MEI), Digão (MEI), Dudu (PE/PD/SA)
update public.matches set
  starters  = '["a13","a12","a20","a29","a6","a1","a4","a10","a7","a3","a8"]'::jsonb,
  positions = '{"a13":"GOL","a12":"LD","a20":"ZD","a29":"ZE","a6":"LE","a1":"VOL","a4":"MC","a10":"MC","a7":"MEI","a3":"SA","a8":"CA","a16":"LE/ZG","a18":"VOL/ZG/LE","a5":"MC/MEI","a9":"MEI","a2":"PE/PD/SA"}'::jsonb,
  lineup    = '["a13","a12","a20","a29","a6","a1","a4","a10","a7","a3","a8","a16","a18","a5","a9","a2"]'::jsonb,
  tactics   = '{"com":{"formation":"4-1-2-1-2","slots":["a13","a12","a20","a29","a6","a1","a4","a10","a7","a3","a8"],"coords":null},"sem":{"formation":"4-1-2-1-2","slots":["a13","a12","a20","a29","a6","a1","a4","a10","a7","a3","a8"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  updated_at = now()
where id = 'm5';

-- Inker 20/01 (Copa Coruja) — 2026-01-20 · 4-2-3-1
-- titulares: GOL Renan, LD Meloni, ZD Rufus, ZE Vini França, LE Caio, VOL Bibico, VOL Siqueira, MEI Eloy, PE Rosalvo, PD Dudu, CA Rennan
-- banco: Albano (ZG), Hashi (MC/VOL/ZG), Wellington (MC/MEI/PE/PD), André (MEI/MC), Digão (MEI), Igor (MEI/PE/PD), Xande (CA/PD), Pelota (CA/SA/PE)
update public.matches set
  starters  = '["a13","a12","a28","a4","a6","a1","a18","a14","a3","a2","a11"]'::jsonb,
  positions = '{"a1":"VOL","a2":"PD","a3":"PE","a4":"ZE","a6":"LE","a11":"CA","a12":"LD","a14":"MEI","a18":"VOL","a20":"ZG","a28":"ZD","a13":"GOL","a5":"MC/VOL/ZG","a10":"MC/MEI/PE/PD","a7":"MEI/MC","a9":"MEI","a35":"MEI/PE/PD","a41":"CA/PD","a30":"CA/SA/PE"}'::jsonb,
  lineup    = '["a12","a28","a4","a6","a1","a18","a14","a2","a3","a11","a20","a5","a10","a7","a9","a35","a30","a13","a41"]'::jsonb,
  tactics   = '{"com":{"formation":"4-2-3-1","slots":["a13","a12","a28","a4","a6","a1","a18","a14","a3","a2","a11"],"coords":null},"sem":{"formation":"4-2-3-1","slots":["a13","a12","a28","a4","a6","a1","a18","a14","a3","a2","a11"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  updated_at = now()
where id = 'm3';

-- Atletico Mangalot 14/02 — 2026-02-14 · 4-3-3
-- titulares: GOL Renan, LD Meloni, ZD Rufus, ZE Belaz, LE Caio, VOL Bibico, MC André, MC Hashi, PE Dudu, PD Rosalvo, CA Fabiano
-- banco: Digão (MEI/MC), Rafael (PD/SA/LD), Rennan (CA/PE/SA)
update public.matches set
  starters  = '["a13","a12","a28","a16","a6","a1","a7","a5","a2","a3","a8"]'::jsonb,
  positions = '{"a13":"GOL","a12":"LD","a28":"ZD","a16":"ZE","a6":"LE","a1":"VOL","a7":"MC","a5":"MC","a2":"PE","a3":"PD","a8":"CA","a9":"MEI/MC","a17":"PD/SA/LD","a11":"CA/PE/SA"}'::jsonb,
  lineup    = '["a13","a12","a28","a16","a6","a1","a7","a5","a3","a2","a8","a9","a17","a11"]'::jsonb,
  tactics   = '{"com":{"formation":"4-3-3","slots":["a13","a12","a28","a16","a6","a1","a7","a5","a2","a3","a8"],"coords":null},"sem":{"formation":"4-3-3","slots":["a13","a12","a28","a16","a6","a1","a7","a5","a2","a3","a8"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  updated_at = now()
where id = 'm8';

-- Sufoco FC 21/02 — 2026-02-21 · 4-3-3
-- titulares: GOL Renan, LD Meloni, ZD Hashi, ZE Vini França, LE Caio, VOL Bibico, MC Luis E., MC André, ATA Rosalvo, ATA Rennan, ATA Eloy
-- banco: Albano (ZG), Digão (MEI/SA/MC), Rafael (PD/PE/SA/LD), Dudu (PE/PD)
update public.matches set
  starters  = '["a13","a12","a5","a4","a6","a1","a19","a7","a3","a11","a14"]'::jsonb,
  positions = '{"a13":"GOL","a12":"LD","a5":"ZD","a4":"ZE","a6":"LE","a1":"VOL","a19":"MC","a7":"MC","a3":"ATA","a11":"ATA","a14":"ATA","a20":"ZG","a9":"MEI/SA/MC","a17":"PD/PE/SA/LD","a2":"PE/PD"}'::jsonb,
  lineup    = '["a13","a12","a5","a4","a6","a1","a19","a7","a3","a11","a14","a20","a9","a17","a2"]'::jsonb,
  tactics   = '{"com":{"formation":"4-3-3","slots":["a13","a12","a5","a4","a6","a1","a19","a7","a3","a11","a14"],"coords":null},"sem":{"formation":"4-3-3","slots":["a13","a12","a5","a4","a6","a1","a19","a7","a3","a11","a14"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  updated_at = now()
where id = 'm9';

-- Catadão 24/02 (Copa Coruja) — 2026-02-24 · 4-3-3
-- titulares: GOL Renan, LD Meloni, ZD Vini França, ZE Hashi, LE Caio, VOL Bibico, VOL Luis E., MEI André, PE Dudu, PD Rosalvo, CA Rennan
-- banco: Macapá (ZG), Albano (ZG/LD), Belaz (LE/ZG), Siqueira (VOL/ZG/LE), Digão (MEI/MC), Eloy (MEI/SA), Rafael (PE/PD/CA)
update public.matches set
  starters  = '["a13","a12","a4","a5","a6","a1","a19","a7","a2","a3","a11"]'::jsonb,
  positions = '{"a1":"VOL","a2":"PE","a3":"PD","a4":"ZD","a5":"ZE","a6":"LE","a7":"MEI","a12":"LD","a13":"GOL","a14":"MEI/SA","a19":"VOL","a11":"CA","a15":"ZG","a20":"ZG/LD","a16":"LE/ZG","a18":"VOL/ZG/LE","a9":"MEI/MC","a17":"PE/PD/CA"}'::jsonb,
  lineup    = '["a13","a12","a4","a5","a6","a1","a19","a7","a3","a2","a14","a11","a15","a20","a16","a18","a9","a17"]'::jsonb,
  tactics   = '{"com":{"formation":"4-3-3","slots":["a13","a12","a4","a5","a6","a1","a19","a7","a2","a3","a11"],"coords":null},"sem":{"formation":"4-3-3","slots":["a13","a12","a4","a5","a6","a1","a19","a7","a2","a3","a11"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  updated_at = now()
where id = 'm10';

-- Das Antigas 28/02 — 2026-02-28 · 4-1-2-1-2
-- titulares: GOL W. Felipe, LD Rosalvo, ZD Bibico, ZE Macapá, LE Kauã, VOL Lima, MC Romario, MC Luis E., MEI Beto, ATA Dudu, ATA Rafael
-- banco: Alef (ATA)
update public.matches set
  starters  = '["a32","a3","a1","a15","a46","a23","a31","a19","a47","a2","a17"]'::jsonb,
  positions = '{"a32":"GOL","a3":"LD","a1":"ZD","a15":"ZE","a46":"LE","a23":"VOL","a31":"MC","a19":"MC","a47":"MEI","a2":"ATA","a17":"ATA","a48":"ATA"}'::jsonb,
  lineup    = '["a32","a3","a1","a15","a46","a23","a31","a19","a47","a2","a17","a48"]'::jsonb,
  tactics   = '{"com":{"formation":"4-1-2-1-2","slots":["a32","a3","a1","a15","a46","a23","a31","a19","a47","a2","a17"],"coords":null},"sem":{"formation":"4-1-2-1-2","slots":["a32","a3","a1","a15","a46","a23","a31","a19","a47","a2","a17"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  updated_at = now()
where id = 'm11';

-- De Primeira 14/03 — 2026-03-14 · 4-1-2-1-2
-- titulares: GOL Renan, LD Rosalvo, ZD Macapá, ZE Belaz, LE Caio, VOL Bibico, MC Wellington, MC André, MEI Eloy, SA Dudu, CA Fabiano
-- banco: Barone (LE/VOL/MC/PD), Lima (MC/MEI/VOL), Digão (MEI/MC), Euller (SA/PE)
update public.matches set
  starters  = '["a13","a3","a15","a16","a6","a1","a10","a7","a14","a2","a8"]'::jsonb,
  positions = '{"a13":"GOL","a3":"LD","a15":"ZD","a16":"ZE","a6":"LE","a1":"VOL","a10":"MC","a7":"MC","a14":"MEI","a2":"SA","a8":"CA","a34":"LE/VOL/MC/PD","a23":"MC/MEI/VOL","a9":"MEI/MC","a26":"SA/PE"}'::jsonb,
  lineup    = '["a13","a3","a15","a16","a6","a1","a10","a7","a14","a2","a8","a34","a23","a9","a26"]'::jsonb,
  tactics   = '{"com":{"formation":"4-1-2-1-2","slots":["a13","a3","a15","a16","a6","a1","a10","a7","a14","a2","a8"],"coords":null},"sem":{"formation":"4-1-2-1-2","slots":["a13","a3","a15","a16","a6","a1","a10","a7","a14","a2","a8"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  updated_at = now()
where id = 'm13';

-- EC Nacional Mooca 23/01 (amistoso) — 2026-01-23 · 4-1-2-1-2
-- titulares: GOL Renan, LD Rosalvo, ZD Albano, ZE Amaral, LE Caio, VOL Bibico, MC Vini França, MC Brendon, MEI André, SA Dudu, CA Fabiano
-- banco: Leone (ZG/LD), Romario (MC), Digão (MEI), Rafael (SA/CA), Pelota (SA/CA)
update public.matches set
  starters  = '["a13","a3","a20","a36","a6","a1","a4","a24","a7","a2","a8"]'::jsonb,
  positions = '{"a1":"VOL","a2":"SA","a3":"LD","a4":"MC","a6":"LE","a7":"MEI","a8":"CA","a9":"MEI","a13":"GOL","a17":"SA/CA","a20":"ZD","a24":"MC","a29":"ZG/LD","a30":"SA/CA","a31":"MC","a36":"ZE"}'::jsonb,
  lineup    = '["a13","a3","a20","a36","a6","a1","a4","a24","a7","a2","a8","a29","a31","a9","a17","a30"]'::jsonb,
  tactics   = '{"com":{"formation":"4-1-2-1-2","slots":["a13","a3","a20","a36","a6","a1","a4","a24","a7","a2","a8"],"coords":null},"sem":{"formation":"4-1-2-1-2","slots":["a13","a3","a20","a36","a6","a1","a4","a24","a7","a2","a8"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  updated_at = now()
where id = 'm4';

-- Maque 07/02 — 2026-02-07 · 4-3-3
-- titulares: GOL Renan, LD Lin, ZD Hashi, ZE Vini França, LE Caio, VOL Bibico, MC Luis E., MEI André, PE Rafael, PD Rosalvo, CA Fabiano
-- banco: Led (CA), Digão (MEI)
update public.matches set
  starters  = '["a13","a49","a5","a4","a6","a1","a19","a7","a17","a3","a8"]'::jsonb,
  positions = '{"a13":"GOL","a49":"LD","a5":"ZD","a4":"ZE","a6":"LE","a1":"VOL","a19":"MC","a7":"MEI","a17":"PE","a3":"PD","a8":"CA","a50":"CA","a9":"MEI"}'::jsonb,
  lineup    = '["a13","a49","a5","a4","a6","a1","a19","a7","a3","a8","a17","a50","a9","a10"]'::jsonb,
  tactics   = '{"com":{"formation":"4-3-3","slots":["a13","a49","a5","a4","a6","a1","a19","a7","a17","a3","a8"],"coords":null},"sem":{"formation":"4-3-3","slots":["a13","a49","a5","a4","a6","a1","a19","a7","a17","a3","a8"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  updated_at = now()
where id = 'm7';

-- Botafogo Vl Bela 17/01 — 2026-01-17 · 4-2-3-1
-- titulares: GOL Renan, LD Rosalvo, ZD Albano, ZE Siqueira, LE Caio, VOL Bibico, VOL Wellington, MEI Eloy, PE Rennan, PD Dudu, CA Fabiano
-- banco: Vini França (ZG/VOL), Belaz (LE/ZG), Hashi (VOL), Digão (MEI), André (MEI/VOL/PE)
update public.matches set
  starters  = '["a13","a3","a20","a18","a6","a1","a10","a14","a11","a2","a8"]'::jsonb,
  positions = '{"a1":"VOL","a2":"PD","a3":"LD","a4":"ZG/VOL","a5":"VOL","a6":"LE","a7":"MEI/VOL/PE","a8":"CA","a9":"MEI","a10":"VOL","a11":"PE","a13":"GOL","a14":"MEI","a16":"LE/ZG","a18":"ZE","a20":"ZD"}'::jsonb,
  lineup    = '["a3","a20","a18","a6","a1","a10","a14","a2","a11","a8","a4","a16","a5","a9","a7","a13"]'::jsonb,
  tactics   = '{"com":{"formation":"4-2-3-1","slots":["a13","a3","a20","a18","a6","a1","a10","a14","a11","a2","a8"],"coords":null},"sem":{"formation":"4-2-3-1","slots":["a13","a3","a20","a18","a6","a1","a10","a14","a11","a2","a8"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  updated_at = now()
where id = 'm2';

-- Pç Kant 07/01 — 2026-01-07 · 4-3-3
-- titulares: GOL Renan, LD Leone, ZD Rufus, ZE Albano, LE Caio, VOL Hashi, MC Brendon, MEI Wellington, PE Rosalvo, PD Meloni, CA Rennan
-- banco: Pelota (SA), Valts (PE), André (MEI), Digão (MEI), Siqueira (LE)
update public.matches set
  starters  = '["a13","a29","a28","a20","a6","a5","a24","a10","a3","a12","a11"]'::jsonb,
  positions = '{"a3":"PE","a5":"VOL","a6":"LE","a7":"MEI","a9":"MEI","a10":"MEI","a11":"CA","a12":"PD","a13":"GOL","a18":"LE","a20":"ZE","a24":"MC","a28":"ZD","a29":"LD","a30":"SA","a51":"PE"}'::jsonb,
  lineup    = '["a13","a6","a20","a28","a29","a5","a24","a10","a12","a3","a11","a30","a51","a7","a9","a18"]'::jsonb,
  tactics   = '{"com":{"formation":"4-3-3","slots":["a13","a29","a28","a20","a6","a5","a24","a10","a3","a12","a11"],"coords":null},"sem":{"formation":"4-3-3","slots":["a13","a29","a28","a20","a6","a5","a24","a10","a3","a12","a11"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  updated_at = now()
where id = 'm1';
