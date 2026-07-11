import { useMemo } from "react";
import { useStore } from "../state/store";
import { navigate } from "../lib/router";
import { compute } from "../lib/stats";
import { dec, fmtDate, pct, result, sortMatches } from "../lib/format";
import { ResultBadge } from "../components/ui";

export default function Athlete({ id }: { id: string }) {
  const { athletes, allMatches, squads } = useStore();
  const athlete = athletes.find((a) => a.id === id);

  const data = useMemo(() => {
    if (!athlete) return null;
    const squadRoster = athletes.filter((a) => a.squad_id === athlete.squad_id);
    const squadMatches = allMatches.filter((m) => m.squad_id === athlete.squad_id);
    const stats = compute(squadRoster, squadMatches);
    const p = stats.players.find((x) => x.id === id) || null;
    const played = sortMatches(squadMatches)
      .filter((m) => m.status === "encerrada" && !m.archived &&
        ((m.lineup || []).includes(id) ||
         (m.scorers || []).some((s) => s.a === id) ||
         (m.assists || []).some((s) => s.a === id)))
      .reverse();
    // posição mais recente registrada
    let position = "";
    for (const m of played) {
      if (m.positions?.[id]) { position = m.positions[id]; break; }
    }
    return { p, played, position };
  }, [athlete, athletes, allMatches, id]);

  if (!athlete || !data) {
    return (
      <div className="empty">
        <h3>Atleta não encontrado</h3>
        <button className="btn" onClick={() => navigate("#/atletas")}>← Voltar aos atletas</button>
      </div>
    );
  }

  const squadName = squads.find((s) => s.id === athlete.squad_id)?.name || athlete.squad_id;
  const p = data.p;

  return (
    <>
      <button className="back-link" onClick={() => navigate("#/atletas")}>← Atletas</button>

      <div className="score-hero">
        <div className="sh-status">{squadName}{data.position ? ` · ${data.position}` : ""}</div>
        <div className="sh-teams" style={{ gridTemplateColumns: "1fr" }}>
          <div className="sh-team" style={{ fontSize: 30 }}>{athlete.name}</div>
        </div>
      </div>

      {p && (
        <div className="grid">
          <div className="card dark">
            <div className="stat-num num">{p.part}</div>
            <div className="stat-label">Participações</div>
            <div className="stat-sub">{p.gols} gols · {p.assist} assistências</div>
          </div>
          <div className="card">
            <div className="stat-num num">{p.jogos}</div>
            <div className="stat-label">Presenças</div>
            <div className="stat-sub">{p.v}V · {p.e}E · {p.d}D com ele em campo</div>
          </div>
          <div className="card">
            <div className="stat-num num">{p.jogos ? pct(p.aprov) : "–"}</div>
            <div className="stat-label">Aprov. do time</div>
            <div className="stat-sub">quando ele joga</div>
          </div>
          <div className="card">
            <div className="stat-num num">{p.jogos ? dec(p.ppj) : "–"}</div>
            <div className="stat-label">Part. por jogo</div>
            <div className="stat-sub">{p.jogos ? dec(p.gpj) : "–"} gol(s) por jogo</div>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h3>Partidas <span className="sub" style={{ display: "inline" }}>· {data.played.length}</span></h3>
        </div>
        {data.played.length === 0 ? (
          <div className="ga-empty" style={{ padding: "14px 18px" }}>Nenhuma partida registrada com este atleta.</div>
        ) : (
          <div className="mini-matches">
            {data.played.map((m) => {
              const g = (m.scorers || []).find((s) => s.a === id)?.g || 0;
              const a = (m.assists || []).find((s) => s.a === id)?.n || 0;
              const contrib = [
                g > 0 && `⚽${g > 1 ? ` ${g}` : ""}`,
                a > 0 && `🅰️${a > 1 ? ` ${a}` : ""}`,
                (m.starters || []).includes(id) && "★",
              ].filter(Boolean).join(" ");
              return (
                <button key={m.id} className="mini-match" onClick={() => navigate(`#/partida/${m.id}`)}>
                  <span className="mm-date">{fmtDate(m.date).slice(0, 5)}</span>
                  <span className="mm-score num">{m.goals_for} × {m.goals_against}</span>
                  <span className="mm-opp">{m.opponent}</span>
                  {contrib && <span className="mm-contrib">{contrib}</span>}
                  <ResultBadge r={result(m)} />
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="legend">★ = titular na partida · ⚽ gols · 🅰️ assistências.</div>
    </>
  );
}
