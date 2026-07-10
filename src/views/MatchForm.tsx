import { useMemo, useState } from "react";
import { useStore } from "../state/store";
import { Modal, Stepper } from "../components/ui";
import { todayISO, uid } from "../lib/format";
import type { Match } from "../lib/types";

interface Props {
  match?: Match | null;       // editar existente
  schedule?: boolean;         // agendar jogo futuro (sem placar)
  onClose: () => void;
}

export default function MatchForm({ match, schedule, onClose }: Props) {
  const { roster, squadId, upsertMatch, addAthlete, toast } = useStore();
  const isEdit = !!match;
  const scheduling = schedule || match?.status === "agendada";

  const [date, setDate] = useState(match?.date || todayISO());
  const [opponent, setOpponent] = useState(match?.opponent || "");
  const [gf, setGf] = useState(match?.goals_for ?? 0);
  const [ga, setGa] = useState(match?.goals_against ?? 0);
  const [lineup, setLineup] = useState<Set<string>>(new Set(match?.lineup || []));
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

  const listed = useMemo(() => {
    const ids = new Set([...lineup, ...Object.keys(scorers), ...Object.keys(assists)]);
    return roster.filter((a) => ids.has(a.id));
  }, [roster, lineup, scorers, assists]);

  function toggle(id: string) {
    setLineup((old) => {
      const cp = new Set(old);
      if (cp.has(id)) cp.delete(id); else cp.add(id);
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
    if (v > 0) setLineup((old) => new Set(old).add(id));
  }

  async function handleAddAthlete() {
    const a = await addAthlete(newName);
    if (a) { setLineup((old) => new Set(old).add(a.id)); setNewName(""); }
  }

  async function save() {
    if (!opponent.trim()) { toast("Informe o adversário"); return; }
    const rec: Match = {
      id: match?.id || uid("m"),
      squad_id: match?.squad_id || squadId,
      date,
      opponent: opponent.trim(),
      status: scheduling ? "agendada" : match?.status && match.status !== "agendada" ? match.status : "encerrada",
      goals_for: scheduling ? 0 : gf,
      goals_against: scheduling ? 0 : ga,
      lineup: [...lineup],
      scorers: Object.entries(scorers).map(([a, g]) => ({ a, g })),
      assists: Object.entries(assists).map(([a, n]) => ({ a, n })),
      lineup_complete: complete,
      notes: match?.notes || "",
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
      <div className="field">
        <label>Data</label>
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div className="field">
        <label>Adversário</label>
        <input
          type="text" value={opponent} placeholder="Nome do adversário"
          autoComplete="off" autoFocus={!isEdit}
          onChange={(e) => setOpponent(e.target.value)}
        />
      </div>

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
        <div className="t">Relacionados</div>
        <div className="mini">
          <button className="btn sm ghost" onClick={() => setLineup(new Set(roster.map((a) => a.id)))}>Todos</button>
          <button className="btn sm ghost" onClick={() => setLineup(new Set())}>Limpar</button>
        </div>
      </div>
      <div className="chips">
        {roster.map((a) => (
          <button key={a.id} className={`chip ${lineup.has(a.id) ? "on" : ""}`} onClick={() => toggle(a.id)}>
            {a.name}
          </button>
        ))}
      </div>
      <div className="add-athlete">
        <input
          type="text" placeholder="+ Adicionar atleta ao elenco" autoComplete="off"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddAthlete(); } }}
        />
        <button className="btn sm" onClick={handleAddAthlete}>Adicionar</button>
      </div>

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
            Marcadores: {gSum} gol(s) · {aSum} assistência(s) · {lineup.size} relacionado(s)
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
