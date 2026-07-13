import { useMemo, useState } from "react";
import { useStore } from "../state/store";
import { Modal, Stepper } from "../components/ui";
import { todayISO, uid } from "../lib/format";
import { POSITIONS, POS_GROUPS, athletePositions, posRank } from "../lib/positions";
import type { Match } from "../lib/types";

const TITULARES = 11;

interface Props {
  match?: Match | null;       // editar existente
  schedule?: boolean;         // agendar jogo futuro (sem placar)
  onClose: () => void;
}

export default function MatchForm({ match, schedule, onClose }: Props) {
  const { roster, squadMatches, squadId, schemaLegacy, upsertMatch, addAthlete, updateAthletePositions, toast } = useStore();
  const isEdit = !!match;
  const scheduling = schedule || match?.status === "agendada";

  const [date, setDate] = useState(match?.date || todayISO());
  const [opponent, setOpponent] = useState(match?.opponent || "");
  const [venue, setVenue] = useState(match?.venue || "");
  const [kickoff, setKickoff] = useState(match?.kickoff || "");
  const [kit, setKit] = useState(match?.kit || "");
  const [gf, setGf] = useState(match?.goals_for ?? 0);
  const [ga, setGa] = useState(match?.goals_against ?? 0);
  // lista ORDENADA: os 11 primeiros são os titulares, o resto é banco
  const [lineup, setLineup] = useState<string[]>(() => {
    if (!match) return [];
    const st = match.starters || [];
    return [...st, ...(match.lineup || []).filter((id) => !st.includes(id))];
  });
  const [positions, setPositions] = useState<Record<string, string>>({ ...(match?.positions || {}) });

  // posições do perfil (curadas ou derivadas do histórico), para agrupar e sugerir
  const profilePos = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const a of roster) map[a.id] = athletePositions(a, squadMatches);
    return map;
  }, [roster, squadMatches]);
  const [scorers, setScorers] = useState<Record<string, number>>(
    Object.fromEntries((match?.scorers || []).map((x) => [x.a, x.g]))
  );
  const [assists, setAssists] = useState<Record<string, number>>(
    Object.fromEntries((match?.assists || []).map((x) => [x.a, x.n]))
  );
  const [complete, setComplete] = useState(match ? match.lineup_complete !== false : true);
  const [newName, setNewName] = useState("");

  const gSum = useMemo(() => Object.values(scorers).reduce((a, b) => a + b, 0), [scorers]);
  const aSum = useMemo(() => Object.values(assists).reduce((a, b) => a + b, 0), [assists]);

  const nameOf = useMemo(() => {
    const m = Object.fromEntries(roster.map((a) => [a.id, a.name]));
    return (id: string) => m[id] || "?";
  }, [roster]);

  // elenco agrupado por posição principal do perfil, na ordem convencional
  const grouped = useMemo(() => {
    // agrupa pela faixa do posRank (normaliza apelidos: GK→GOL, ZAG→ZG…)
    const bucket = (a: { id: string }) => {
      const r = posRank(profilePos[a.id]?.[0]);
      if (r < 10) return "Goleiros";
      if (r < 20) return "Defesa";
      if (r < 30) return "Meio-campo";
      if (r < 40) return "Ataque";
      return "Sem posição definida";
    };
    const sorted = [...roster].sort((a, b) =>
      posRank(profilePos[a.id]?.[0]) - posRank(profilePos[b.id]?.[0]) ||
      a.name.localeCompare(b.name, "pt"));
    const out: { label: string; athletes: typeof roster }[] = [];
    for (const g of [...POS_GROUPS.map((g) => g.label), "Sem posição definida"]) {
      const list = sorted.filter((a) => bucket(a) === g);
      if (list.length) out.push({ label: g, athletes: list });
    }
    return out;
  }, [roster, profilePos]);

  const listed = useMemo(() => {
    const ids = new Set([...lineup, ...Object.keys(scorers), ...Object.keys(assists)]);
    return roster.filter((a) => ids.has(a.id));
  }, [roster, lineup, scorers, assists]);

  function toggle(id: string) {
    setLineup((old) => {
      if (old.includes(id)) return old.filter((x) => x !== id);
      // ao entrar na lista, sugere a posição do perfil se a partida ainda não tiver
      const sug = profilePos[id]?.[0];
      if (sug) setPositions((p) => (p[id] ? p : { ...p, [id]: sug }));
      return [...old, id];
    });
  }

  function move(id: string, dir: -1 | 1) {
    setLineup((old) => {
      const i = old.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= old.length) return old;
      const cp = [...old];
      [cp[i], cp[j]] = [cp[j], cp[i]];
      return cp;
    });
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
    if (v > 0) setLineup((old) => (old.includes(id) ? old : [...old, id]));
  }

  async function handleAddAthlete() {
    const a = await addAthlete(newName);
    if (a) { setLineup((old) => [...old, a.id]); setNewName(""); }
  }

  async function save() {
    if (!opponent.trim()) { toast("Informe o adversário"); return; }
    const cleanPositions = Object.fromEntries(
      Object.entries(positions).filter(([id, v]) => lineup.includes(id) && v.trim())
    );
    const rec: Match = {
      id: match?.id || uid("m"),
      squad_id: match?.squad_id || squadId,
      date,
      opponent: opponent.trim(),
      status: scheduling ? "agendada" : match?.status && match.status !== "agendada" ? match.status : "encerrada",
      goals_for: scheduling ? 0 : gf,
      goals_against: scheduling ? 0 : ga,
      lineup: [...lineup],
      starters: lineup.slice(0, TITULARES),
      positions: cleanPositions,
      scorers: Object.entries(scorers).map(([a, g]) => ({ a, g })),
      assists: Object.entries(assists).map(([a, n]) => ({ a, n })),
      lineup_complete: complete,
      notes: match?.notes || "",
      venue: venue.trim() || null,
      kickoff: kickoff.trim() || null,
      kit: kit.trim() || null,
      archived: match?.archived === true,
      clock: match?.clock || null,
      started_at: match?.started_at || null,
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
        <div className="t">Relacionados <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>· toque na ordem: 1º ao 11º viram titulares</span></div>
        <div className="mini">
          <button className="btn sm ghost" onClick={() => { setLineup([]); }}>Limpar</button>
        </div>
      </div>
      {grouped.map((g) => (
        <div key={g.label} className="pos-group">
          <div className="pg-label">{g.label}</div>
          <div className="chips">
            {g.athletes.map((a) => {
              const i = lineup.indexOf(a.id);
              const p = profilePos[a.id]?.[0];
              return (
                <button key={a.id} className={`chip ${i >= 0 ? "on" : ""}`} onClick={() => toggle(a.id)}>
                  {i >= 0 && <span className="chip-ord num">{i + 1}</span>}
                  {a.name}{p ? ` · ${p}` : ""}
                </button>
              );
            })}
          </div>
        </div>
      ))}
      <div className="add-athlete">
        <input
          type="text" placeholder="+ Adicionar atleta ao elenco" autoComplete="off"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddAthlete(); } }}
        />
        <button className="btn sm" onClick={handleAddAthlete}>Adicionar</button>
      </div>

      {!schemaLegacy && lineup.length > 0 && (
        <>
          <div className="subhead">
            <div className="t">
              Escalação na ordem{" "}
              <span className="muted" style={{ fontWeight: 400, fontSize: 12 }}>
                · {Math.min(lineup.length, TITULARES)} titular{Math.min(lineup.length, TITULARES) !== 1 ? "es" : ""}
                {lineup.length > TITULARES ? ` + ${lineup.length - TITULARES} no banco` : ""}
              </span>
            </div>
          </div>
          <div className="st-list">
            {lineup.map((id, i) => (
              <div key={id}>
                {i === TITULARES && <div className="bench-divider">— banco a partir daqui —</div>}
                <div className="st-row">
                  <span className={`st-ord num ${i < TITULARES ? "tit" : ""}`}>
                    {i < TITULARES ? "★" : ""}{i + 1}
                  </span>
                  <div className="nm">
                    {nameOf(id)}
                    {positions[id]
                      ? <span className="muted"> · {positions[id]}</span>
                      : (
                        <select
                          className="pos-sel" value=""
                          onChange={(e) => {
                            const v = e.target.value;
                            if (!v) return;
                            setPosition(id, v);
                            // registra no perfil de quem ainda não tem posição
                            if (!profilePos[id]?.length) updateAthletePositions(id, [v]);
                          }}
                        >
                          <option value="">posição…</option>
                          {POSITIONS.map((p) => <option key={p} value={p}>{p}</option>)}
                        </select>
                      )}
                  </div>
                  <button type="button" className="ord-btn" disabled={i === 0} onClick={() => move(id, -1)} aria-label="Subir">↑</button>
                  <button type="button" className="ord-btn" disabled={i === lineup.length - 1} onClick={() => move(id, 1)} aria-label="Descer">↓</button>
                  <button type="button" className="ord-btn rm" onClick={() => toggle(id)} aria-label="Remover">×</button>
                </div>
              </div>
            ))}
          </div>
          <div className="tot-line">★ 11 primeiros = titulares · ↑ ↓ ajustam a ordem · posição vem do perfil do atleta</div>
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
