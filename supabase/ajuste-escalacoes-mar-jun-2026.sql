-- ============================================================
-- AJUSTE DE DADOS (parte 2) — fichas completas de mar–jun/2026
-- + Wellington no banco do Maque 07/02. Rode no SQL Editor do Supabase.
-- Shaktar (11/07) fica de fora: foi comandado ao vivo no app.
-- ============================================================

-- Maque 07/02 — Wellington no banco (ficha nova) — 2026-02-07 vs Maque FC
update public.matches set
  lineup    = '["a13","a49","a5","a4","a6","a1","a19","a7","a3","a8","a17","a50","a9","a10"]'::jsonb,
  updated_at = now()
where id = 'm7';

-- AD Ponte Grande 21/03 (ficha sem posições) — 2026-03-21 vs AD Ponte Grande
-- titulares (sem posição na ficha): Eloy, Meloni, Macapá, Hashi, Edu, Bibico, Vini França, André, Dudu, Fabiano, Gui Dantas
-- banco: Albano, Rosalvo, Lucas Vini, Lima, Rafael
update public.matches set
  starters  = '["a14","a12","a15","a5","a27","a1","a4","a7","a2","a8","a33"]'::jsonb,
  lineup    = '["a14","a12","a15","a5","a27","a1","a4","a7","a2","a8","a33","a20","a3","a40","a23","a17"]'::jsonb,
  kickoff   = '08:00',
  meet_time = '07:30',
  venue     = 'Av. Mariano Melliani, 270 — Ponte Grande',
  kit       = 'Verde antigo',
  lineup_complete = true,
  updated_at = now()
where id = 'm14';

-- Futnoia 29/03 (Copa TCA) — 2026-03-29 vs Futnoia · 4-3-3
-- titulares: GOL Eloy, LD Rosalvo, ZD Hashi, ZE Vini França, LE Caio, VOL Bibico, MC Wellington, MC Luis E., PE Rennan, PD Meloni, CA Fabiano
-- banco: Macapá (ZG), Belaz (LE/ZG), Siqueira (VOL/LE/ZG), Gzus (VOL/MC/LD), Brendon (VOL/MC), Digão (MEI/MC), Rafael (PD/PE/SA), Euller (PE/SA/CA)
update public.matches set
  starters  = '["a14","a3","a5","a4","a6","a1","a10","a19","a11","a12","a8"]'::jsonb,
  positions = '{"a14":"GOL","a3":"LD","a5":"ZD","a4":"ZE","a6":"LE","a1":"VOL","a10":"MC","a19":"MC","a11":"PE","a12":"PD","a8":"CA","a15":"ZG","a16":"LE/ZG","a18":"VOL/LE/ZG","a22":"VOL/MC/LD","a24":"VOL/MC","a9":"MEI/MC","a17":"PD/PE/SA","a26":"PE/SA/CA"}'::jsonb,
  lineup    = '["a14","a3","a5","a4","a6","a1","a10","a19","a12","a11","a8","a15","a16","a18","a22","a24","a9","a17","a26"]'::jsonb,
  tactics   = '{"com":{"formation":"4-3-3","slots":["a14","a3","a5","a4","a6","a1","a10","a19","a11","a12","a8"],"coords":null},"sem":{"formation":"4-3-3","slots":["a14","a3","a5","a4","a6","a1","a10","a19","a11","a12","a8"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  kickoff   = '14:00',
  meet_time = '13:30',
  venue     = 'CDC Julio Botelho',
  kit       = 'Verde claro (Diverso)',
  lineup_complete = true,
  updated_at = now()
where id = 'm15';

-- Al Phumaça 09/04 (amistoso Liga Ranking) — 2026-04-09 vs Al Phumaça · 4-3-3
-- titulares: GOL Eloy, LD Rosalvo, ZD Macapá, ZE Vini França, LE Caio, VOL Bibico, VOL Gzus, MEI André, PE Dudu, PD Meloni, CA Rennan
-- banco: Belaz (ZG/LE), Lima (VOL/MC/MEI), Rafael (PE/PD/SA/CA)
update public.matches set
  starters  = '["a14","a3","a15","a4","a6","a1","a22","a7","a2","a12","a11"]'::jsonb,
  positions = '{"a14":"GOL","a3":"LD","a15":"ZD","a4":"ZE","a6":"LE","a1":"VOL","a22":"VOL","a7":"MEI","a2":"PE","a12":"PD","a11":"CA","a16":"ZG/LE","a23":"VOL/MC/MEI","a17":"PE/PD/SA/CA"}'::jsonb,
  lineup    = '["a14","a3","a15","a4","a6","a1","a22","a7","a12","a2","a11","a16","a23","a17"]'::jsonb,
  tactics   = '{"com":{"formation":"4-3-3","slots":["a14","a3","a15","a4","a6","a1","a22","a7","a2","a12","a11"],"coords":null},"sem":{"formation":"4-3-3","slots":["a14","a3","a15","a4","a6","a1","a22","a7","a2","a12","a11"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  kickoff   = '20:30',
  meet_time = '20:00',
  venue     = 'Campo da Ford — Presidente Altino, Osasco',
  kit       = 'Verde Novo',
  lineup_complete = true,
  updated_at = now()
where id = 'm16';

-- Pinguim FC 11/04 (amistoso Liga Ranking) — 2026-04-11 vs Pinguim FC · 4-3-3
-- titulares: GOL Eloy, LD Diego, ZD Macapá, ZE Hashi, LE Siqueira, VOL Brendon, VOL Luis E., MEI Digão, PE Euller, PD Dudu, CA Fabiano
-- banco: Gzus (LD/MC), Caio (LE/PE), Bibico (VOL/MC), Lima (MC/MEI), Barone (PD/PE), Edu (PE/CA)
update public.matches set
  starters  = '["a14","a37","a15","a5","a18","a24","a19","a9","a26","a2","a8"]'::jsonb,
  positions = '{"a14":"GOL","a37":"LD","a15":"ZD","a5":"ZE","a18":"LE","a24":"VOL","a19":"VOL","a9":"MEI","a26":"PE","a2":"PD","a8":"CA","a22":"LD/MC","a6":"LE/PE","a1":"VOL/MC","a23":"MC/MEI","a34":"PD/PE","a27":"PE/CA"}'::jsonb,
  lineup    = '["a14","a37","a15","a5","a18","a24","a19","a9","a2","a26","a8","a22","a6","a1","a23","a34","a27"]'::jsonb,
  tactics   = '{"com":{"formation":"4-3-3","slots":["a14","a37","a15","a5","a18","a24","a19","a9","a26","a2","a8"],"coords":null},"sem":{"formation":"4-3-3","slots":["a14","a37","a15","a5","a18","a24","a19","a9","a26","a2","a8"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  kickoff   = '10:00',
  meet_time = '09:30',
  venue     = 'Parque da Mooca — Rua Taquari, 573',
  kit       = 'Branco',
  lineup_complete = true,
  updated_at = now()
where id = 'm17';

-- Formigueiro 15/04 (lista de presença, sem posições) — 2026-04-15 vs Formigueiro
update public.matches set
  lineup    = '["a23","a17","a12","a22","a11","a14","a2","a7","a32","a3","a5","a10","a15","a4","a9","a16","a1","a8","a26"]'::jsonb,
  updated_at = now()
where id = 'm18';

-- Libertários 26/04 (Supercopa 1º de Maio) — 2026-04-26 vs LIbertarios · 4-2-3-1
-- titulares: GOL Eloy, LD Rosalvo, ZD Hashi, ZE Belaz, LE Caio, VOL Bibico, VOL Wellington, MEI Luis E., PE Rennan, PD Dudu, CA Fabiano
-- banco: Gzus, Siqueira, Digão, Wez, Detona, Euller
update public.matches set
  starters  = '["a14","a3","a5","a16","a6","a1","a10","a19","a11","a2","a8"]'::jsonb,
  positions = '{"a14":"GOL","a3":"LD","a5":"ZD","a16":"ZE","a6":"LE","a1":"VOL","a10":"VOL","a19":"MEI","a11":"PE","a2":"PD","a8":"CA"}'::jsonb,
  lineup    = '["a14","a3","a5","a16","a6","a1","a10","a19","a2","a11","a8","a22","a18","a9","a21","a25","a26"]'::jsonb,
  tactics   = '{"com":{"formation":"4-2-3-1","slots":["a14","a3","a5","a16","a6","a1","a10","a19","a11","a2","a8"],"coords":null},"sem":{"formation":"4-2-3-1","slots":["a14","a3","a5","a16","a6","a1","a10","a19","a11","a2","a8"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  kickoff   = '14:00',
  meet_time = '13:15',
  venue     = 'CDC Julio Botelho',
  kit       = 'Verde Novo',
  lineup_complete = true,
  updated_at = now()
where id = 'm20';

-- Código Verde 05/05 (Supercopa 1º de Maio) — 2026-05-05 vs Código Verde · 4-2-3-1
-- titulares: GOL Renan, LD Rosalvo, ZD Hashi, ZE Belaz, LE Meloni, VOL Bibico, VOL Wellington, MEI Luis E., PE Rennan, PD Dudu, CA Fabiano
-- banco: Vini França, Gzus, André, Wez, Euller, Detona, Bruninho, Digão
update public.matches set
  starters  = '["a13","a3","a5","a16","a12","a1","a10","a19","a11","a2","a8"]'::jsonb,
  positions = '{"a13":"GOL","a3":"LD","a5":"ZD","a16":"ZE","a12":"LE","a1":"VOL","a10":"VOL","a19":"MEI","a11":"PE","a2":"PD","a8":"CA"}'::jsonb,
  lineup    = '["a13","a3","a5","a16","a12","a1","a10","a19","a2","a11","a8","a4","a22","a7","a21","a26","a25","a44","a9"]'::jsonb,
  tactics   = '{"com":{"formation":"4-2-3-1","slots":["a13","a3","a5","a16","a12","a1","a10","a19","a11","a2","a8"],"coords":null},"sem":{"formation":"4-2-3-1","slots":["a13","a3","a5","a16","a12","a1","a10","a19","a11","a2","a8"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  kickoff   = '21:00',
  meet_time = '20:30',
  venue     = 'CDC Julio Botelho',
  kit       = 'Verde Novo',
  lineup_complete = true,
  updated_at = now()
where id = 'm21';

-- Time do Gueto 09/05 (Supercopa 1º de Maio) — 2026-05-09 vs Time do Gueto · 4-4-2
-- titulares: GOL Eloy, LD Macapá, ZD Albano, ZE Vini França, LE Rosalvo, VOL Bibico, VOL Wellington, MEI André, MEI Digão, ATA Dudu, ATA Detona
-- banco: W. Felipe, Romario, Wez, Barone, Igor
update public.matches set
  starters  = '["a14","a15","a20","a4","a3","a1","a10","a7","a9","a2","a25"]'::jsonb,
  positions = '{"a14":"GOL","a15":"LD","a20":"ZD","a4":"ZE","a3":"LE","a1":"VOL","a10":"VOL","a7":"MEI","a9":"MEI","a2":"ATA","a25":"ATA"}'::jsonb,
  lineup    = '["a14","a15","a20","a4","a3","a1","a10","a7","a9","a2","a25","a32","a31","a21","a34","a35"]'::jsonb,
  tactics   = '{"com":{"formation":"4-4-2","slots":["a14","a15","a20","a4","a3","a1","a10","a7","a9","a2","a25"],"coords":null},"sem":{"formation":"4-4-2","slots":["a14","a15","a20","a4","a3","a1","a10","a7","a9","a2","a25"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  kickoff   = '10:30',
  meet_time = '10:00',
  venue     = 'Campo do União Gleba — R. Soveral, 99',
  kit       = 'Diverso',
  lineup_complete = true,
  updated_at = now()
where id = 'm22';

-- Samba São Jorge 16/05 — 2026-05-16 vs Samba São Jorge · 4-2-3-1
-- titulares: GOL Goleiro de Aluguel, LD Macapá, ZD Rufus, ZE Hashi, LE Rosalvo, VOL Vini França, VOL Bibico, MEI Luis E., PE Dudu, PD Meloni, CA Fabiano
-- banco: Wez (VOL/MEI), Gui Dantas (MEI/PD), Detona (CA/PD)
update public.matches set
  starters  = '["a45","a15","a28","a5","a3","a4","a1","a19","a2","a12","a8"]'::jsonb,
  positions = '{"a45":"GOL","a15":"LD","a28":"ZD","a5":"ZE","a3":"LE","a4":"VOL","a1":"VOL","a19":"MEI","a2":"PE","a12":"PD","a8":"CA","a21":"VOL/MEI","a33":"MEI/PD","a25":"CA/PD"}'::jsonb,
  lineup    = '["a45","a15","a28","a5","a3","a4","a1","a19","a12","a2","a8","a21","a33","a25"]'::jsonb,
  tactics   = '{"com":{"formation":"4-2-3-1","slots":["a45","a15","a28","a5","a3","a4","a1","a19","a2","a12","a8"],"coords":null},"sem":{"formation":"4-2-3-1","slots":["a45","a15","a28","a5","a3","a4","a1","a19","a2","a12","a8"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  kickoff   = '11:30',
  meet_time = '11:00',
  venue     = 'R. Ciriema, 120 — Ayrosa, Osasco',
  kit       = 'Verde antigo',
  lineup_complete = true,
  updated_at = now()
where id = 'm23';

-- XI De Setembro 24/05 (ficha sem posições) — 2026-05-24 vs XI De Setembro
-- titulares (sem posição na ficha): Renan, Macapá, Hashi, Vini França, Bibico, Belaz, Wellington, Luis E., Rennan, André, Fabiano
-- banco: Caio, Rosalvo, Siqueira, Eloy, Meloni
update public.matches set
  starters  = '["a13","a15","a5","a4","a1","a16","a10","a19","a11","a7","a8"]'::jsonb,
  lineup    = '["a13","a15","a5","a4","a1","a16","a10","a19","a11","a7","a8","a6","a3","a18","a14","a12"]'::jsonb,
  lineup_complete = true,
  updated_at = now()
where id = 'm24';

-- Corote Molotov 30/05 (Copa 1º de Maio) — Bruninho não jogou — 2026-05-30 vs Corote Molotov · 4-3-3
-- titulares: GOL Renan, LD Macapá, ZD Hashi, ZE Vini França, LE Belaz, VOL Bibico, MC Brendon, MC Wellington, PD Dudu, CA Fabiano
-- banco: Rosalvo (LD/LE/MC/PD), Caio (LE/PE), Wez (MC/VOL/MEI/PE), Digão (MEI/MC), Edu (PE/SA), Detona (CA/PD)
-- fora das estatísticas: Bruninho
update public.matches set
  starters  = '["a13","a15","a5","a4","a16","a1","a24","a10","a2","a8"]'::jsonb,
  positions = '{"a13":"GOL","a15":"LD","a5":"ZD","a4":"ZE","a16":"LE","a1":"VOL","a24":"MC","a10":"MC","a2":"PD","a8":"CA","a3":"LD/LE/MC/PD","a6":"LE/PE","a21":"MC/VOL/MEI/PE","a9":"MEI/MC","a27":"PE/SA","a25":"CA/PD"}'::jsonb,
  lineup    = '["a13","a15","a5","a4","a16","a1","a24","a10","a2","a8","a3","a6","a21","a9","a27","a25"]'::jsonb,
  tactics   = '{"com":{"formation":"4-3-3","slots":["a13","a15","a5","a4","a16","a1","a24","a10",null,"a2","a8"],"coords":null},"sem":{"formation":"4-3-3","slots":["a13","a15","a5","a4","a16","a1","a24","a10",null,"a2","a8"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  kickoff   = '11:30',
  meet_time = '11:00',
  venue     = 'Rua Taquari, 549 — Mooca',
  kit       = 'Diverso',
  lineup_complete = true,
  updated_at = now()
where id = 'm25';

-- Catadão 07/06 (Copa TCA) — 2026-06-07 vs Catadão · 4-3-3
-- titulares: GOL Eloy, LD Rosalvo, ZD Vini França, ZE Belaz, LE Caio, VOL Bibico, VOL Wellington, MEI André, PE Rennan, PD Meloni, CA Fabiano
-- banco: Renan (GOL), Siqueira (VOL/LE/ZG), Brendon (VOL), Gzus (VOL/LD/LE), Wez (MEI), Dudu (PD/PE), Edu (PE/SA), Detona (CA/PD/SA)
update public.matches set
  starters  = '["a14","a3","a4","a16","a6","a1","a10","a7","a11","a12","a8"]'::jsonb,
  positions = '{"a14":"GOL","a3":"LD","a4":"ZD","a16":"ZE","a6":"LE","a1":"VOL","a10":"VOL","a7":"MEI","a11":"PE","a12":"PD","a8":"CA","a13":"GOL","a18":"VOL/LE/ZG","a24":"VOL","a22":"VOL/LD/LE","a21":"MEI","a2":"PD/PE","a27":"PE/SA","a25":"CA/PD/SA"}'::jsonb,
  lineup    = '["a14","a3","a4","a16","a6","a1","a10","a7","a12","a11","a8","a13","a18","a24","a22","a21","a2","a27","a25"]'::jsonb,
  tactics   = '{"com":{"formation":"4-3-3","slots":["a14","a3","a4","a16","a6","a1","a10","a7","a11","a12","a8"],"coords":null},"sem":{"formation":"4-3-3","slots":["a14","a3","a4","a16","a6","a1","a10","a7","a11","a12","a8"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  kickoff   = '12:30',
  meet_time = '12:00',
  venue     = 'CDC Julio Botelho',
  kit       = 'Diverso',
  lineup_complete = true,
  updated_at = now()
where id = 'm26';

-- Só de Virada 20/06 (Supercopa, ficha sem posições) — 2026-06-20 vs Só de Virada
-- titulares (sem posição na ficha): Renan, Macapá, Hashi, Vini França, Caio, Bibico, Wez, André, Dudu, Fabiano, Rennan
-- banco: Albano, Rosalvo, Digão, Meloni, Rafael, Gzus
update public.matches set
  starters  = '["a13","a15","a5","a4","a6","a1","a21","a7","a2","a8","a11"]'::jsonb,
  lineup    = '["a13","a15","a5","a4","a6","a1","a21","a7","a2","a8","a11","a20","a3","a9","a12","a17","a22"]'::jsonb,
  kickoff   = '11:30',
  meet_time = '10:50',
  venue     = 'Parque do Tatuapé — R. Monte Serrat (metrô Carrão)',
  kit       = 'Branco',
  lineup_complete = true,
  updated_at = now()
where id = 'm27';

-- TAP 27/06 (Supercopa) — 2026-06-27 vs TAP · 4-3-3
-- titulares: GOL Renan, LD Rosalvo, ZD Hashi, ZE Vini França, LE Belaz, VOL Bibico, MC André, MEI Wez, PE Wellington, PD Dudu, CA Meloni
-- banco: Albano (ZG), Caio (LE/PE), Brendon (VOL), Gzus (MC/VOL/LD), Rafael (PD/PE), Detona (CA/PD)
update public.matches set
  starters  = '["a13","a3","a5","a4","a16","a1","a7","a21","a10","a2","a12"]'::jsonb,
  positions = '{"a1":"VOL","a2":"PD","a3":"LD","a4":"ZE","a5":"ZD","a6":"LE/PE","a7":"MC","a10":"PE","a12":"CA","a13":"GOL","a16":"LE","a17":"PD/PE","a20":"ZG","a21":"MEI","a22":"MC/VOL/LD","a24":"VOL","a25":"CA/PD"}'::jsonb,
  lineup    = '["a13","a3","a5","a4","a16","a7","a21","a2","a10","a12","a20","a6","a24","a22","a17","a25","a1"]'::jsonb,
  tactics   = '{"com":{"formation":"4-3-3","slots":["a13","a3","a5","a4","a16","a1","a7","a21","a10","a2","a12"],"coords":null},"sem":{"formation":"4-3-3","slots":["a13","a3","a5","a4","a16","a1","a7","a21","a10","a2","a12"],"coords":null},"bp":null,"cobradores":null}'::jsonb,
  kickoff   = '11:30',
  meet_time = '10:50',
  venue     = 'Parque da Mooca — Rua Taquari, 549',
  kit       = 'Diverso',
  lineup_complete = true,
  updated_at = now()
where id = 'm28';
