import { useState } from "react";
import { useStore } from "../state/store";
import { navigate } from "../lib/router";
import { fmtDate, isLive, result, sortMatches, statusLabel } from "../lib/format";
import { EmptyState } from "../components/ui";
import MatchForm from "./MatchForm";
import type { Match } from "../lib/types";

export default function Matches() {
  const { matches, roster, isAdmin } = useStore();
  const [form, setForm] = useState<null | { match?: Match; schedule?: boolean }>(null);

  const nameOf = (id: string) => roster.find((a) => a.id === id)?.name || "?";
  const list = sortMatches(matches).reverse();
  const upcoming = list.filter((m) => m.status === "agendada");
  const liveOrDone = list.filter((m) => m.status !== "agendada");

  const header = (
    <div className="section-title">
      <h2>Partidas {list.length > 0 && <span className="hint">· {list.length} jogos</span>}</h2>
      {isAdmin && (
        <div className="row-gap">
          <button className="btn sm ghost-light" onClick={() => setForm({ schedule: true })}>Agendar</button>
          <button className="btn primary sm" onClick={() => setForm({})}>+ Nova partida</button>
        </div>
      )}
    </div>
  );

  if (list.length === 0) {
    return (
      <>
        {header}
        <EmptyState
          title="Nenhuma partida"
          sub={isAdmin ? "Cadastre o primeiro jogo do Proleta." : "Ainda não há jogos registrados neste elenco."}
          action={isAdmin && <button className="btn primary" onClick={() => setForm({})}>+ Nova partida</button>}
        />
        {form && <MatchForm match={form.match} schedule={form.schedule} onClose={() => setForm(null)} />}
      </>
    );
  }

  function card(m: Match) {
    const live = isLive(m.status);
    const scheduled = m.status === "agendada";
    const r = result(m);
    const rl = scheduled ? "" : live ? "live" : r.toLowerCase();
    const sc = (m.scorers || []).slice().sort((a, b) => b.g - a.g)
      .map((x) => `${nameOf(x.a)}${x.g > 1 ? ` (${x.g})` : ""}`).join(", ");
    return (
      <button key={m.id} className={`match-card ${rl}`} onClick={() => navigate(`#/partida/${m.id}`)}>
        <div className="mc-top">
          <div className="mc-date">{fmtDate(m.date)}</div>
          <div className="mc-main">
            <div className="mc-score">
              {scheduled
                ? <span className="opp">vs {m.opponent}</span>
                : <><span className="sc">{m.goals_for} – {m.goals_against}</span> <span className="opp">{m.opponent}</span></>}
            </div>
            {sc && <div className="mc-scorers">⚽ {sc}</div>}
          </div>
          {scheduled
            ? <span className="mc-badge sched">Agendada</span>
            : live
              ? <span className="mc-badge live"><span className="pulse sm" />{statusLabel(m.status)}</span>
              : <span className={`mc-badge ${r.toLowerCase()}`}>{r}</span>}
        </div>
      </button>
    );
  }

  return (
    <>
      {header}
      {upcoming.length > 0 && (
        <>
          <div className="list-label">Agendadas</div>
          <div className="match-list">{upcoming.map(card)}</div>
        </>
      )}
      {upcoming.length > 0 && <div className="list-label">Realizadas</div>}
      <div className="match-list">{liveOrDone.map(card)}</div>
      {form && <MatchForm match={form.match} schedule={form.schedule} onClose={() => setForm(null)} />}
    </>
  );
}
