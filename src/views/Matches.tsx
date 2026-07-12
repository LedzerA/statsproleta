import { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store";
import { navigate } from "../lib/router";
import { fmtDate, isLive, result, sortMatches, statusLabel } from "../lib/format";
import { EmptyState } from "../components/ui";
import MatchForm from "./MatchForm";
import type { Match, Result } from "../lib/types";

export default function Matches({ openNew }: { openNew?: boolean }) {
  const { matches, roster, isAdmin, deleteMatch } = useStore();
  const [form, setForm] = useState<null | { match?: Match; schedule?: boolean }>(null);
  const [fRes, setFRes] = useState<Set<Result>>(new Set());

  // rota #/partidas/nova (atalho do Início) abre o formulário direto
  useEffect(() => {
    if (openNew) {
      if (isAdmin) setForm({});
      navigate("#/partidas");
    }
  }, [openNew, isAdmin]);

  const nameOf = (id: string) => roster.find((a) => a.id === id)?.name || "?";
  const list = sortMatches(matches).reverse();
  const hasFilters = fRes.size > 0;

  const upcoming = useMemo(
    () => list.filter((m) => m.status === "agendada"),
    [list]
  );
  const played = useMemo(
    () => list.filter((m) =>
      m.status !== "agendada" &&
      // condições (V/E/D) valem para jogos encerrados; ao vivo sempre aparece
      (fRes.size === 0 || isLive(m.status) || fRes.has(result(m)))
    ),
    [list, fRes]
  );

  function toggleRes(r: Result) {
    setFRes((old) => {
      const cp = new Set(old);
      if (cp.has(r)) cp.delete(r); else cp.add(r);
      return cp;
    });
  }
  function clearFilters() { setFRes(new Set()); }

  const shown = upcoming.length + played.length;
  const header = (
    <>
      <div className="section-title">
        <h2>
          Partidas{" "}
          {list.length > 0 && (
            <span className="hint">
              · {hasFilters ? `${shown} de ${list.length}` : list.length} jogos
            </span>
          )}
        </h2>
        {isAdmin && (
          <div className="row-gap">
            <button className="btn sm ghost-light" onClick={() => setForm({ schedule: true })}>Agendar</button>
            <button className="btn primary sm" onClick={() => setForm({})}>+ Nova partida</button>
          </div>
        )}
      </div>
      {list.length > 0 && (
        <div className="filter-bar">
          <button className={`f-chip v ${fRes.has("V") ? "on" : ""}`} onClick={() => toggleRes("V")}>Vitórias</button>
          <button className={`f-chip e ${fRes.has("E") ? "on" : ""}`} onClick={() => toggleRes("E")}>Empates</button>
          <button className={`f-chip d ${fRes.has("D") ? "on" : ""}`} onClick={() => toggleRes("D")}>Derrotas</button>
          {hasFilters && (
            <button className="linklike light" onClick={clearFilters}>Limpar filtros</button>
          )}
        </div>
      )}
    </>
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
        {scheduled && (m.venue || m.kickoff || m.kit || nRel > 0) && (
          <div className="mc-detail">
            {(m.venue || m.kickoff || m.kit) && (
              <div>
                {[m.kickoff && `🕒 ${m.kickoff}`, m.venue && `📍 ${m.venue}`, m.kit && `👕 ${m.kit}`]
                  .filter(Boolean).join("  ·  ")}
              </div>
            )}
            {nRel > 0 && (
              <div className="mc-tags">
                <span className="tag n">{nRel} relacionado{nRel !== 1 ? "s" : ""}</span>
                {(m.starters || []).length > 0 && (
                  <span className="tag n">★ {m.starters.length} titulares</span>
                )}
              </div>
            )}
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
              {(m.starters || []).length > 0 && (
                <span className="tag n">★ {m.starters.length} titulares · {nRel - m.starters.length} banco</span>
              )}
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
      {shown === 0 ? (
        <EmptyState
          icon="🔍"
          title="Nenhum jogo com esses filtros"
          sub="Ajuste o período ou as condições acima."
          action={<button className="btn ghost-light" onClick={clearFilters}>Limpar filtros</button>}
        />
      ) : (
        <div className="match-list">{played.map(card)}</div>
      )}
      {form && <MatchForm match={form.match} schedule={form.schedule} onClose={() => setForm(null)} />}
    </>
  );
}
