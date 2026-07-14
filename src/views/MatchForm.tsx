import { useMemo, useState } from "react";
import { useStore } from "../state/store";
import { Modal, Stepper } from "../components/ui";
import { todayISO, uid } from "../lib/format";
import { POSITIONS, POS_GROUPS, athletePositions, lastPosition, posRank } from "../lib/positions";
import {
  FORMATIONS, getFormation, autoSlots, bestFreeSlot, inferFormation, remapPhase, reconcileSem,
} from "../lib/formations";
import { Pitch } from "../components/Pitch";
import type { Match, SetPieceTakers, TacticsPhase } from "../lib/types";

interface Props {
  match?: Match | null;       // editar existente
  schedule?: boolean;         // agendar jogo futuro (sem placar)
  onClose: () => void;
}

type PhaseKey = "com" | "sem" | "bp";

/* no formulário a fase bola parada sempre existe (espelhando a com bola);
   ela só é SALVA quando o admin personaliza vagas, pontos ou formação */
interface FormTactics {
  com: TacticsPhase;
  sem: TacticsPhase;
  bp: TacticsPhase;
}

/** Busca sem acento e sem caixa ("joao" encontra "João"). */
function fold(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Quantos atletas aparecem como sugestão de relacionados — o resto via busca. */
const SUGERIDOS = 20;

const COBRANCAS: { k: keyof SetPieceTakers; label: string }[] = [
  { k: "penalti", label: "Pênalti" },
  { k: "falta", label: "Falta" },
  { k: "escanteio_e", label: "Esc. esq." },
  { k: "escanteio_d", label: "Esc. dir." },
];

export default function MatchForm({ match, schedule, onClose }: Props) {
  const { roster, squadMatches, squadId, schemaLegacy, schemaTactics, schemaLogistics, upsertMatch, addAthlete, toast } = useStore();
  const isEdit = !!match;
  const scheduling = schedule || match?.status === "agendada";

  const [date, setDate] = useState(match?.date || todayISO());
  const [opponent, setOpponent] = useState(match?.opponent || "");
  const [venue, setVenue] = useState(match?.venue || "");
  const [kickoff, setKickoff] = useState(match?.kickoff || "");
  const [kit, setKit] = useState(match?.kit || "");
  const [meetTime, setMeetTime] = useState(match?.meet_time || "");
  const [ballHolder, setBallHolder] = useState(match?.ball_holder || "");
  const [kitHolder, setKitHolder] = useState(match?.kit_holder || "");
  const [gf, setGf] = useState(match?.goals_for ?? 0);
  const [ga, setGa] = useState(match?.goals_against ?? 0);

  // sugestão por atleta: a ÚLTIMA posição em que ele jogou até a data desta
  // partida (sem histórico, cai na primeira posição curada do perfil)
  const suggested = useMemo(() => {
    const ref = { id: match?.id, date: match?.date || todayISO() };
    const map: Record<string, string> = {};
    for (const a of roster) map[a.id] = lastPosition(a.id, squadMatches, ref) || a.positions?.[0] || "";
    return map;
  }, [roster, squadMatches, match]);

  // posições do perfil (curadas ou derivadas do histórico) — agrupa o elenco
  const profilePos = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const a of roster) map[a.id] = athletePositions(a, squadMatches);
    return map;
  }, [roster, squadMatches]);

  const [lineup, setLineup] = useState<string[]>(() => (match ? [...(match.lineup || [])] : []));
  // posições da partida; relacionado sem registro entra com a última que jogou
  const [positions, setPositions] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = { ...(match?.positions || {}) };
    for (const id of match?.lineup || []) {
      if (!init[id] && suggested[id]) init[id] = suggested[id];
    }
    return init;
  });
  // tática com/sem bola; partida antiga (sem tática salva) entra com a
  // formação inferida dos titulares e das posições já registradas
  const [tactics, setTactics] = useState<FormTactics>(() => {
    if (match?.tactics) {
      const inLineup = new Set(match.lineup || []);
      const fit = (p: TacticsPhase): TacticsPhase => {
        const f = getFormation(p.formation);
        return {
          formation: f.name,
          slots: f.slots.map((_, i) => {
            const id = p.slots[i];
            return id && inLineup.has(id) ? id : null;
          }),
          coords: p.coords ? f.slots.map((_, i) => p.coords![i] || null) : null,
        };
      };
      const com = fit(match.tactics.com);
      return {
        com,
        sem: fit(match.tactics.sem),
        bp: match.tactics.bp ? fit(match.tactics.bp) : remapPhase(com, com.formation),
      };
    }
    const st = (match?.starters || []).map((id) => ({ id, pos: match?.positions?.[id] || suggested[id] }));
    const f = inferFormation(st.map((x) => x.pos));
    const slots = autoSlots(f, st);
    const espelho = (): TacticsPhase => ({ formation: f.name, slots: [...slots], coords: null });
    return { com: { formation: f.name, slots, coords: null }, sem: espelho(), bp: espelho() };
  });
  const [phase, setPhase] = useState<PhaseKey>("com");
  // sem bola e bola parada espelham a com bola até o usuário mexer nelas
  const [semManual, setSemManual] = useState<boolean>(() => {
    const t = match?.tactics;
    return !!t && (t.com.formation !== t.sem.formation || t.com.slots.join() !== t.sem.slots.join());
  });
  const [bpManual, setBpManual] = useState<boolean>(() => !!match?.tactics?.bp);
  // titulares cuja posição foi ajustada à mão (ex.: ZC numa vaga ZG) — para
  // eles a posição salva NÃO é sobrescrita pelo rótulo da vaga
  const [posManual, setPosManual] = useState<Set<string>>(() => {
    const s = new Set<string>();
    if (match?.tactics) {
      const f = getFormation(match.tactics.com.formation);
      match.tactics.com.slots.forEach((id, i) => {
        const saved = id ? match.positions?.[id] : undefined;
        if (id && saved && saved !== f.slots[i]?.pos) s.add(id);
      });
    }
    return s;
  });
  const [cobradores, setCobradores] = useState<SetPieceTakers>(() => ({ ...(match?.tactics?.cobradores || {}) }));

  const [scorers, setScorers] = useState<Record<string, number>>(
    Object.fromEntries((match?.scorers || []).map((x) => [x.a, x.g]))
  );
  const [assists, setAssists] = useState<Record<string, number>>(
    Object.fromEntries((match?.assists || []).map((x) => [x.a, x.n]))
  );
  const [complete, setComplete] = useState(match ? match.lineup_complete !== false : true);
  const [busca, setBusca] = useState("");

  const gSum = useMemo(() => Object.values(scorers).reduce((a, b) => a + b, 0), [scorers]);
  const aSum = useMemo(() => Object.values(assists).reduce((a, b) => a + b, 0), [assists]);

  const nameOf = useMemo(() => {
    const m = Object.fromEntries(roster.map((a) => [a.id, a.name]));
    return (id: string) => m[id] || "?";
  }, [roster]);

  const active = tactics[phase];
  const activeF = getFormation(active.formation);
  const starters = useMemo(
    () => tactics.com.slots.filter((x): x is string => !!x),
    [tactics]
  );
  const startersSet = useMemo(() => new Set(starters), [starters]);
  const bench = useMemo(
    () => lineup.filter((id) => !startersSet.has(id)).sort((a, b) =>
      posRank(positions[a] || suggested[a]) - posRank(positions[b] || suggested[b]) ||
      nameOf(a).localeCompare(nameOf(b), "pt")),
    [lineup, startersSet, positions, suggested, nameOf]
  );
  // opções dos selects de vaga, em ordem de posição (com bola: todos os
  // relacionados; sem bola: só os 11 titulares, na ordem das vagas)
  const comOptions = useMemo(
    () => [...lineup].sort((a, b) =>
      posRank(positions[a] || suggested[a]) - posRank(positions[b] || suggested[b]) ||
      nameOf(a).localeCompare(nameOf(b), "pt")),
    [lineup, positions, suggested, nameOf]
  );
  const slotOptions = phase === "com" ? comOptions : starters;

  // sugestões: os últimos usados no elenco (quem nunca jogou fica por último);
  // quem já está nesta partida aparece sempre — o resto do elenco, pela busca
  const lastUsed = useMemo(() => {
    const map: Record<string, string> = {};
    for (const mt of squadMatches) {
      for (const id of mt.lineup || []) {
        if (!map[id] || mt.date > map[id]) map[id] = mt.date;
      }
    }
    return map;
  }, [squadMatches]);
  const visiveis = useMemo(() => {
    const q = fold(busca.trim());
    if (q) return new Set(roster.filter((a) => fold(a.name).includes(q)).map((a) => a.id));
    const recentes = roster.map((a) => a.id)
      .sort((x, y) => (lastUsed[y] || "").localeCompare(lastUsed[x] || ""));
    const set = new Set(recentes.slice(0, SUGERIDOS));
    for (const id of lineup) set.add(id);
    return set;
  }, [busca, roster, lastUsed, lineup]);

  // elenco visível agrupado por posição principal do perfil, na ordem convencional
  const grouped = useMemo(() => {
    const bucket = (a: { id: string }) => {
      const r = posRank(profilePos[a.id]?.[0]);
      if (r < 10) return "Goleiros";
      if (r < 20) return "Defesa";
      if (r < 30) return "Meio-campo";
      if (r < 40) return "Ataque";
      return "Sem posição definida";
    };
    const sorted = roster.filter((a) => visiveis.has(a.id)).sort((a, b) =>
      posRank(profilePos[a.id]?.[0]) - posRank(profilePos[b.id]?.[0]) ||
      a.name.localeCompare(b.name, "pt"));
    const out: { label: string; athletes: typeof roster }[] = [];
    for (const g of [...POS_GROUPS.map((g) => g.label), "Sem posição definida"]) {
      const list = sorted.filter((a) => bucket(a) === g);
      if (list.length) out.push({ label: g, athletes: list });
    }
    return out;
  }, [roster, profilePos, visiveis]);

  const listed = useMemo(() => {
    const ids = new Set([...lineup, ...Object.keys(scorers), ...Object.keys(assists)]);
    return roster.filter((a) => ids.has(a.id)).sort((a, b) =>
      posRank(positions[a.id] || suggested[a.id]) - posRank(positions[b.id] || suggested[b.id]) ||
      a.name.localeCompare(b.name, "pt"));
  }, [roster, lineup, scorers, assists, positions, suggested]);

  /* mantém sem bola e bola parada coerentes após mudanças na com bola;
     bola parada não tem formação própria — segue a da com bola */
  function syncFrom(com: TacticsPhase): FormTactics {
    return {
      com,
      sem: semManual ? reconcileSem(tactics.sem, com) : remapPhase(com, tactics.sem.formation),
      bp: bpManual ? reconcileSem(tactics.bp, com) : remapPhase(com, com.formation),
    };
  }

  function patchPhase(ph: PhaseKey, next: TacticsPhase): FormTactics {
    return ph === "com" ? { ...tactics, com: next }
      : ph === "sem" ? { ...tactics, sem: next }
      : { ...tactics, bp: next };
  }

  function markManual(ph: PhaseKey) {
    if (ph === "sem") setSemManual(true);
    else if (ph === "bp") setBpManual(true);
  }

  function toggle(id: string) {
    if (lineup.includes(id)) {
      setLineup((old) => old.filter((x) => x !== id));
      const com = { ...tactics.com, slots: tactics.com.slots.map((x) => (x === id ? null : x)) };
      setTactics(syncFrom(com));
      return;
    }
    setLineup((old) => [...old, id]);
    const sug = positions[id] || suggested[id];
    if (sug && !positions[id]) setPositions((p) => ({ ...p, [id]: sug }));
    // com posição conhecida, já ocupa a vaga livre mais parecida (vira titular)
    if (sug) {
      const i = bestFreeSlot(getFormation(tactics.com.formation), tactics.com.slots, sug);
      if (i >= 0) {
        const slots = [...tactics.com.slots];
        slots[i] = id;
        setTactics(syncFrom({ ...tactics.com, slots }));
      }
    }
  }

  function clearLineup() {
    setLineup([]);
    setTactics((t) => ({
      com: { ...t.com, slots: t.com.slots.map(() => null), coords: null },
      sem: { ...t.sem, slots: t.sem.slots.map(() => null), coords: null },
      bp: { ...t.bp, slots: t.bp.slots.map(() => null), coords: null },
    }));
    setSemManual(false);
    setBpManual(false);
    setCobradores({});
  }

  /** Arrasto no campinho: só muda o ponto da vaga na fase ativa. */
  function moveSlot(i: number, x: number, y: number) {
    const base = tactics[phase];
    const coords = base.coords
      ? [...base.coords]
      : getFormation(base.formation).slots.map(() => null as [number, number] | null);
    coords[i] = [x, y];
    markManual(phase);
    setTactics(patchPhase(phase, { ...base, coords }));
  }

  function resetCoords() {
    setTactics(patchPhase(phase, { ...tactics[phase], coords: null }));
  }

  function setFormation(ph: PhaseKey, name: string) {
    if (ph === "com") {
      setTactics(syncFrom(remapPhase(tactics.com, name)));
    } else {
      markManual(ph);
      setTactics(patchPhase(ph, remapPhase(tactics[ph], name)));
    }
  }

  function setSlot(ph: PhaseKey, idx: number, raw: string) {
    const id = raw || null;
    const base = tactics[ph];
    const slots = [...base.slots];
    const prev = slots[idx] ?? null;
    const dup = id ? slots.indexOf(id) : -1;
    if (dup >= 0) slots[dup] = prev; // já estava em outra vaga → troca
    slots[idx] = id;
    if (ph === "com") {
      setTactics(syncFrom({ ...base, slots }));
    } else {
      markManual(ph);
      setTactics(patchPhase(ph, { ...base, slots }));
    }
  }

  /** Ajuste pontual da posição de um titular; escolher o rótulo da vaga
      volta a herdar dele. */
  function setStarterPos(id: string, slotPos: string, v: string) {
    setPosManual((old) => {
      const cp = new Set(old);
      if (v && v !== slotPos) cp.add(id); else cp.delete(id);
      return cp;
    });
    setPositions((old) => ({ ...old, [id]: v || slotPos }));
  }

  function setPosition(id: string, v: string) {
    setPositions((old) => {
      const cp = { ...old };
      if (v.trim()) cp[id] = v; else delete cp[id];
      return cp;
    });
  }

  function setCount(kind: "g" | "a", id: string, v: number) {
    const set = kind === "g" ? setScorers : setAssists;
    set((old) => {
      const cp = { ...old };
      if (v <= 0) delete cp[id]; else cp[id] = v;
      return cp;
    });
    if (v > 0) {
      setLineup((old) => (old.includes(id) ? old : [...old, id]));
      setPositions((p) => (p[id] || !suggested[id] ? p : { ...p, [id]: suggested[id] }));
    }
  }

  async function handleAddAthlete() {
    const a = await addAthlete(busca);
    if (a) { setLineup((old) => [...old, a.id]); setBusca(""); }
  }

  async function save() {
    if (!opponent.trim()) { toast("Informe o adversário"); return; }
    const comF = getFormation(tactics.com.formation);
    const semF = getFormation(tactics.sem.formation);
    const bpF = getFormation(tactics.bp.formation);
    const comSlots = tactics.com.slots.map((id) => (id && lineup.includes(id) ? id : null));
    const st = comSlots.filter((x): x is string => !!x);
    const semSlots = tactics.sem.slots.map((id) => (id && st.includes(id) ? id : null));
    const bpSlots = tactics.bp.slots.map((id) => (id && st.includes(id) ? id : null));
    const fitCoords = (p: TacticsPhase, f: ReturnType<typeof getFormation>) =>
      p.coords && p.coords.some(Boolean) ? f.slots.map((_, i) => p.coords![i] || null) : null;
    const cb: SetPieceTakers = {};
    for (const { k } of COBRANCAS) {
      const v = cobradores[k];
      if (v && lineup.includes(v)) cb[k] = v;
    }
    const salvaBp = bpManual || !!tactics.bp.coords?.some(Boolean);
    // posição por relacionado; titular herda o rótulo da vaga (com bola)
    const cleanPositions: Record<string, string> = {};
    for (const id of lineup) {
      const v = (positions[id] || "").trim();
      if (v) cleanPositions[id] = v;
    }
    comSlots.forEach((id, i) => {
      if (!id) return;
      const manual = posManual.has(id) ? (positions[id] || "").trim() : "";
      cleanPositions[id] = manual || comF.slots[i].pos;
    });
    const rec: Match = {
      id: match?.id || uid("m"),
      squad_id: match?.squad_id || squadId,
      date,
      opponent: opponent.trim(),
      status: scheduling ? "agendada" : match?.status && match.status !== "agendada" ? match.status : "encerrada",
      goals_for: scheduling ? 0 : gf,
      goals_against: scheduling ? 0 : ga,
      lineup: [...lineup],
      starters: st,
      positions: cleanPositions,
      scorers: Object.entries(scorers).map(([a, g]) => ({ a, g })),
      assists: Object.entries(assists).map(([a, n]) => ({ a, n })),
      lineup_complete: complete,
      notes: match?.notes || "",
      venue: venue.trim() || null,
      kickoff: kickoff.trim() || null,
      kit: kit.trim() || null,
      meet_time: meetTime.trim() || null,
      ball_holder: ballHolder.trim() || null,
      kit_holder: kitHolder.trim() || null,
      archived: match?.archived === true,
      clock: match?.clock || null,
      started_at: match?.started_at || null,
      tactics: st.length
        ? {
            com: { formation: comF.name, slots: comSlots, coords: fitCoords(tactics.com, comF) },
            sem: { formation: semF.name, slots: semSlots, coords: fitCoords(tactics.sem, semF) },
            bp: salvaBp ? { formation: bpF.name, slots: bpSlots, coords: fitCoords(tactics.bp, bpF) } : null,
            cobradores: Object.keys(cb).length ? cb : null,
          }
        : null,
    };
    await upsertMatch(rec);
    toast(isEdit ? "Partida atualizada" : scheduling ? "Jogo agendado ✓" : "Partida salva ✓");
    onClose();
  }

  return (
    <Modal
      title={isEdit ? "Editar partida" : scheduling ? "Agendar jogo" : "Nova partida"}
      onClose={onClose}
      footer={
        <>
          <button className="btn ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn primary" style={{ flex: 2 }} onClick={save}>
            {isEdit ? "Salvar alterações" : "Salvar"}
          </button>
        </>
      }
    >
      <div className="field-row">
        <div className="field" style={{ flex: 1 }}>
          <label>Data</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {!schemaLegacy && (
          <div className="field" style={{ width: 110 }}>
            <label>Horário</label>
            <input type="time" value={kickoff} onChange={(e) => setKickoff(e.target.value)} />
          </div>
        )}
      </div>
      <div className="field">
        <label>Adversário</label>
        <input
          type="text" value={opponent} placeholder="Nome do adversário"
          autoComplete="off" autoFocus={!isEdit}
          onChange={(e) => setOpponent(e.target.value)}
        />
      </div>
      {!schemaLegacy && (
        <div className="field-row">
          <div className="field" style={{ flex: 1.4 }}>
            <label>Local</label>
            <input type="text" value={venue} placeholder="Ex.: Parque da Mooca"
              autoComplete="off" onChange={(e) => setVenue(e.target.value)} />
          </div>
          <div className="field" style={{ flex: 1 }}>
            <label>Uniforme</label>
            <input type="text" value={kit} placeholder="Ex.: Verde"
              autoComplete="off" onChange={(e) => setKit(e.target.value)} />
          </div>
        </div>
      )}
      {!schemaLegacy && schemaLogistics && (
        <>
          <div className="field-row">
            <div className="field" style={{ width: 110 }}>
              <label>Apresentação</label>
              <input type="time" value={meetTime} onChange={(e) => setMeetTime(e.target.value)} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Bolas com</label>
              <input type="text" value={ballHolder} placeholder="Quem leva as bolas"
                autoComplete="off" onChange={(e) => setBallHolder(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label>Uniforme com</label>
            <input type="text" value={kitHolder} placeholder="Quem leva o jogo de camisas"
              autoComplete="off" onChange={(e) => setKitHolder(e.target.value)} />
          </div>
        </>
      )}

      {!scheduling && (
        <div className="field">
          <label>Placar</label>
          <div className="placar">
            <div className="side">
              <div className="cap">Proleta</div>
              <input type="number" min={0} value={gf} onChange={(e) => setGf(parseInt(e.target.value) || 0)} />
            </div>
            <div className="x">×</div>
            <div className="side">
              <div className="cap">Adversário</div>
              <input type="number" min={0} value={ga} onChange={(e) => setGa(parseInt(e.target.value) || 0)} />
            </div>
          </div>
        </div>
      )}

      <div className="subhead">
        <div className="t">Relacionados <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· quem ganha vaga na formação vira titular (★)</span></div>
        <div className="mini">
          <button className="btn sm ghost" onClick={clearLineup}>Limpar</button>
        </div>
      </div>
      {grouped.map((g) => (
        <div key={g.label} className="pos-group">
          <div className="pg-label">{g.label}</div>
          <div className="chips">
            {g.athletes.map((a) => {
              const on = lineup.includes(a.id);
              const p = profilePos[a.id]?.[0];
              return (
                <button key={a.id} className={`chip ${on ? "on" : ""}`}
                  onClick={() => { toggle(a.id); if (busca) setBusca(""); }}>
                  {startersSet.has(a.id) && <span className="chip-ord num">★</span>}
                  {a.name}{p ? ` · ${p}` : ""}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      {busca.trim() && grouped.length === 0 && (
        <div className="ga-empty">Ninguém com esse nome no elenco — “Adicionar” cria um atleta novo.</div>
      )}
      {!busca.trim() && roster.length > visiveis.size && (
        <div className="tot-line">
          Sugestões: os {visiveis.size} usados mais recentemente · os outros {roster.length - visiveis.size} aparecem pela busca abaixo
        </div>
      )}
      <div className="add-athlete">
        <input
          type="text" placeholder="🔍 Buscar no elenco ou adicionar atleta" autoComplete="off"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            const first = busca.trim() ? grouped[0]?.athletes[0] : undefined;
            if (first) { toggle(first.id); setBusca(""); }
            else handleAddAthlete();
          }}
        />
        <button className="btn sm" onClick={handleAddAthlete}>Adicionar</button>
      </div>

      {!schemaLegacy && lineup.length > 0 && (
        <>
          <div className="subhead">
            <div className="t">
              Escalação{" "}
              <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
                · {starters.length} titular{starters.length !== 1 ? "es" : ""}
                {bench.length > 0 ? ` + ${bench.length} no banco` : ""}
              </span>
            </div>
          </div>
          {!schemaTactics && (
            <div className="warn show">
              ⚠ Este banco ainda não tem a coluna de formações — rode <b>supabase/atualizacao-4.sql</b>.
              Titulares e posições continuam sendo salvos; só o desenho tático não.
            </div>
          )}
          <div className="phase-tabs">
            <button type="button" className={`chip ${phase === "com" ? "on" : ""}`} onClick={() => setPhase("com")}>
              ⚽ Com bola
            </button>
            <button type="button" className={`chip ${phase === "sem" ? "on" : ""}`} onClick={() => setPhase("sem")}>
              🛡️ Sem bola
            </button>
            <button type="button" className={`chip ${phase === "bp" ? "on" : ""}`} onClick={() => setPhase("bp")}>
              🎯 Bola parada
            </button>
            {phase !== "bp" && (
              <select
                className="pos-sel formation-sel"
                value={active.formation}
                onChange={(e) => setFormation(phase, e.target.value)}
                aria-label="Formação"
              >
                {FORMATIONS.map((f) => <option key={f.name} value={f.name}>{f.name}</option>)}
              </select>
            )}
          </div>
          <Pitch
            formation={activeF}
            slots={active.slots}
            coords={active.coords}
            labels={active.slots.map((id) => (id && posManual.has(id) ? positions[id] || null : null))}
            nameOf={nameOf}
            onMove={moveSlot}
          />
          <div className="pitch-hint">
            Arraste os jogadores no campinho para ajustar o posicionamento — formação e posição não mudam.
            {active.coords?.some(Boolean) && (
              <>
                {" "}
                <button type="button" className="linklike" onClick={resetCoords}>Restaurar pontos da formação</button>
              </>
            )}
          </div>
          {phase === "sem" && !semManual && (
            <div className="tot-line">Sem bola está espelhando a com bola — mexa nas vagas para personalizar.</div>
          )}
          {phase === "bp" && !bpManual && (
            <div className="tot-line">
              Bola parada está espelhando a com bola — arraste os jogadores (ex.: todo mundo na área
              para o escanteio) ou troque vagas para personalizar e salvar.
            </div>
          )}
          <div className="st-list">
            {activeF.slots.map((s, i) => {
              const occ = active.slots[i];
              const editPos = phase === "com" && !!occ;
              const cur = occ && posManual.has(occ) ? positions[occ] || s.pos : s.pos;
              return (
                <div className="st-row slot" key={`${active.formation}-${i}`}>
                  {editPos ? (
                    <select
                      className="slot-pos-sel num"
                      value={cur}
                      onChange={(e) => setStarterPos(occ!, s.pos, e.target.value)}
                      aria-label="Posição do titular na partida"
                      title="Ajusta a posição salva deste titular (a vaga da formação não muda)"
                    >
                      {cur && !(POSITIONS as readonly string[]).includes(cur) && (
                        <option value={cur}>{cur}</option>
                      )}
                      {POSITIONS.map((p) => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="slot-pos num">{s.pos}</span>
                  )}
                  <select
                    className="slot-sel"
                    value={occ || ""}
                    onChange={(e) => setSlot(phase, i, e.target.value)}
                  >
                    <option value="">—</option>
                    {slotOptions.map((id) => {
                      const j = active.slots.indexOf(id);
                      return (
                        <option key={id} value={id}>
                          {nameOf(id)}{j >= 0 && j !== i ? ` ⇄ ${activeF.slots[j].pos}` : ""}
                        </option>
                      );
                    })}
                  </select>
                </div>
              );
            })}
          </div>
          {phase === "bp" && (
            <>
              <div className="subhead">
                <div className="t">Cobradores <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· aparecem na página da partida</span></div>
              </div>
              <div className="st-list">
                {COBRANCAS.map(({ k, label }) => (
                  <div className="st-row cob" key={k}>
                    <span className="slot-pos">{label}</span>
                    <select
                      className="slot-sel"
                      value={cobradores[k] || ""}
                      onChange={(e) => setCobradores((c) => ({ ...c, [k]: e.target.value || null }))}
                    >
                      <option value="">—</option>
                      {comOptions.map((id) => <option key={id} value={id}>{nameOf(id)}</option>)}
                    </select>
                  </div>
                ))}
              </div>
            </>
          )}
          {bench.length > 0 && (
            <>
              <div className="subhead">
                <div className="t">Banco <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· ordenado por posição</span></div>
              </div>
              <div className="st-list">
                {bench.map((id) => (
                  <div className="st-row bench" key={id}>
                    <div className="nm">
                      {nameOf(id)}
                      <select
                        className="pos-sel"
                        value={positions[id] || ""}
                        onChange={(e) => setPosition(id, e.target.value)}
                      >
                        <option value="">posição…</option>
                        {positions[id] && !(POSITIONS as readonly string[]).includes(positions[id]) && (
                          <option value={positions[id]}>{positions[id]}</option>
                        )}
                        {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                    <button type="button" className="ord-btn rm" onClick={() => toggle(id)} aria-label="Remover">×</button>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="tot-line">
            Titular = vaga preenchida na formação com bola · toque no rótulo verde da vaga
            para ajustar a posição de um titular · sem bola usa os mesmos 11
          </div>
        </>
      )}

      {!scheduling && (
        <>
          <div className="subhead"><div className="t">Gols e assistências</div></div>
          {listed.length === 0 ? (
            <div className="ga-empty">Marque os relacionados acima para lançar gols e assistências.</div>
          ) : (
            <div className="ga-list">
              <div className="ga-head"><span>Atleta</span><span>Gols</span><span>Assist.</span></div>
              {listed.map((a) => (
                <div key={a.id} className="ga-row">
                  <div className="nm">{a.name}</div>
                  <Stepper value={scorers[a.id] || 0} onChange={(v) => setCount("g", a.id, v)} />
                  <Stepper value={assists[a.id] || 0} onChange={(v) => setCount("a", a.id, v)} />
                </div>
              ))}
            </div>
          )}
          <div className="tot-line">
            Marcadores: {gSum} gol(s) · {aSum} assistência(s) · {lineup.length} relacionado(s)
          </div>
          {gSum > 0 && gf > 0 && gSum !== gf && (
            <div className="warn show">
              ⚠ Os marcadores somam {gSum} gol(s), mas o placar do Proleta é {gf}. Tudo bem se houve
              gol contra a favor — só confira.
            </div>
          )}
          <label className="complete-toggle">
            <input type="checkbox" checked={complete} onChange={(e) => setComplete(e.target.checked)} />
            <span>Escalação completa (todos os relacionados marcados) — deixa as presenças exatas</span>
          </label>
        </>
      )}
    </Modal>
  );
}
