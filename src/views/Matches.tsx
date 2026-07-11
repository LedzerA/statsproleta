import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { navigate } from "../lib/router";
import { fmtDate, isLive, result, sortMatches, statusLabel } from "../lib/format";
import { EmptyState } from "../components/ui";
import MatchForm from "./MatchForm";
import type { Match } from "../lib/types";

export default function Matches({ openNew }: { openNew?: boolean }) {
  const { matches, roster, isAdmin, deleteMatch } = useStore();
  const [form, setForm] = useState<null | { match?: Match; schedule?: boolean }>(null);

  // rota #/partidas/nova (atalho do Início) abre o formulário direto
  useEffect(() => {
    if (openNew) {
      if (isAdmin) setForm({});
      navigate("#/partidas");
    }
  }, [openNew, isAdmin]);

  const nameOf = (id: string) => roster.find((a) => a.id === id)?.name || "?";
  const list = sortMatches(matches).reverse();
  const upcoming = list.filter((m) => m.status === "agendada");
  const played = list.filter((m) => m.status !== "agendada");

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
    const as = (m.assists || []).slice().sort((a, b) => b.n - a.n)
      .map((x) => `${nameOf(x.a)}${x.n > 1 ? ` (${x.n})` : ""}`).join(", ");
    const nRel = (m.lineup || []).length;
    const open = () => navigate(`#/partida/${m.id}`);
    return (
      <div
        key={m.id}
        className={`match-card ${rl}`}
        role="button"
        tabIndex={0}
        onClick={open}
        onKeyDown={(e) => { if (e.key === "Enter") open(); }}
      >
        <div className="mc-top">
          <div className="mc-date">{fmtDate(m.date)}</div>
          <div className="mc-main">
            <div className="mc-score">
              {scheduled
                ? <span className="opp">vs {m.opponent}</span>
                : <><span className="sc">{m.goals_for} – {m.goals_against}</span> <span className="opp">{m.opponent}</span></>}
            </div>
          </div>
          {scheduled
            ? <span className="mc-badge sched">Agendada</span>
            : live
              ? <span className="mc-badge live"><span className="pulse sm" />{statusLabel(m.status)}</span>
              : <span className={`mc-badge ${r.toLowerCase()}`}>{r}</span>}
        </div>
        {scheduled && (m.venue || m.kickoff || m.kit) && (
          <div className="mc-detail">
            <div>
              {[m.kickoff && `🕒 ${m.kickoff}`, m.venue && `📍 ${m.venue}`, m.kit && `👕 ${m.kit}`]
                .filter(Boolean).join("  ·  ")}
            </div>
          </div>
        )}
        {!scheduled && (
          <div className="mc-detail">
            {sc
              ? <div><span className="k">⚽ Gols:</span> {sc}</div>
              : <div className="muted">Sem gols registrados</div>}
            {as && <div><span className="k">🅰️ Assist.:</span> {as}</div>}
            <div className="mc-tags">
              <span className="tag n">{nRel} relacionado{nRel !== 1 ? "s" : ""}</span>
              {m.lineup_complete === false && <span className="tag">escalação parcial</span>}
              {live && <span className="tag live">ao vivo — toque para acompanhar</span>}
            </div>
          </div>
        )}
        {isAdmin && (
          <div className="mc-actions" onClick={(e) => e.stopPropagation()}>
            <button className="btn sm ghost" onClick={() => setForm({ match: m })}>Editar</button>
            <button
              className="btn sm danger"
              onClick={() => {
                if (confirm(`Excluir a partida contra ${m.opponent} (${fmtDate(m.date)})?\n\nEssa ação não pode ser desfeita.`)) {
                  deleteMatch(m.id);
                }
              }}
            >
              Excluir
            </button>
            {scheduled && <button className="btn sm primary" onClick={open}>Abrir / iniciar ao vivo →</button>}
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {header}
      {upcoming.length > 0 && (
        <>
          <div className="list-label">Agendadas</div>
          <div className="match-list">{upcoming.map(card)}</div>
          <div className="list-label">Realizadas</div>
        </>
      )}
      <div className="match-list">{played.map(card)}</div>
      {form && <MatchForm match={form.match} schedule={form.schedule} onClose={() => setForm(null)} />}
    </>
  );
}
