import { useMemo } from "react";
import { useStore } from "../state/store";
import { navigate } from "../lib/router";
import { compute } from "../lib/stats";
import { dec, fmtDate, fmtDateShort, pct, result, sortMatches } from "../lib/format";
import { inPeriod, periodRange } from "../lib/period";
import { ResultBadge } from "../components/ui";
import { LineChart } from "../components/LineChart";

export default function Athlete({ id }: { id: string }) {
  const { athletes, allMatches, squads, period, periodOn } = useStore();
  const athlete = athletes.find((a) => a.id === id);

  const data = useMemo(() => {
    if (!athlete) return null;
    const squadRoster = athletes.filter((a) => a.squad_id === athlete.squad_id);
    const all = allMatches.filter((m) => m.squad_id === athlete.squad_id);
    const range = periodRange(period);
    const squadMatches = all.filter((m) => inPeriod(m.date, range));
    const stats = compute(squadRoster, squadMatches);
    const p = stats.players.find((x) => x.id === id) || null;
    const played = sortMatches(squadMatches)
      .filter((m) => m.status === "encerrada" && !m.archived &&
        ((m.lineup || []).includes(id) ||
         (m.scorers || []).some((s) => s.a === id) ||
         (m.assists || []).some((s) => s.a === id)))
      .reverse();
    // posição mais recente registrada (independe do período)
    let position = "";
    const allPlayed = sortMatches(all).reverse();
    for (const m of allPlayed) {
      if (m.positions?.[id]) { position = m.positions[id]; break; }
    }
    return { p, played, position };
  }, [athlete, athletes, allMatches, period, id]);

  const evo = useMemo(() => {
    if (!data) return null;
    const jogos = [...data.played].reverse(); // ordem cronológica
    let g = 0, a = 0;
    const gols: number[] = [], assist: number[] = [];
    for (const m of jogos) {
      g += (m.scorers || []).find((s) => s.a === id)?.g || 0;
      a += (m.assists || []).find((s) => s.a === id)?.n || 0;
      gols.push(g);
      assist.push(a);
    }
    return { jogos, gols, assist };
  }, [data, id]);

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
            {p.jogos > 0 && (
              <div className="ved-bar" title={`${p.v} vitórias, ${p.e} empates, ${p.d} derrotas com ele`}>
                <i className="sv" style={{ width: `${(p.v / p.jogos) * 100}%` }} />
                <i className="se" style={{ width: `${(p.e / p.jogos) * 100}%` }} />
                <i className="sd" style={{ width: `${(p.d / p.jogos) * 100}%` }} />
              </div>
            )}
          </div>
          <div className="card">
            <div className="stat-num num">{p.jogos ? pct(p.aprov) : "–"}</div>
            <div className="stat-label">Aprov. do time</div>
            <div className="stat-sub">quando ele joga</div>
            {p.jogos > 0 && (
              <div className="meter"><i style={{ width: `${Math.min(100, p.aprov * 100)}%` }} /></div>
            )}
          </div>
          <div className="card">
            <div className="stat-num num">{p.jogos ? dec(p.ppj) : "–"}</div>
            <div className="stat-label">Part. por jogo</div>
            <div className="stat-sub">{p.jogos ? dec(p.gpj) : "–"} gol(s) por jogo</div>
          </div>
        </div>
      )}

      {p && p.part > 0 && evo && evo.jogos.length >= 2 && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>📈 Evolução do atleta</h3>
              <div className="sub">gols e assistências acumulados, jogo a jogo{periodOn ? " (período filtrado)" : ""}</div>
            </div>
          </div>
          <div className="chart-legend">
            <span><span className="sw" style={{ background: "#1aa04a" }} />Gols</span>
            <span><span className="sw" style={{ background: "#cf9d2b" }} />Assistências</span>
          </div>
          <div className="chart-box">
            <LineChart
              series={[
                { name: "Gols", color: "#1aa04a", values: evo.gols },
                { name: "Assist.", color: "#cf9d2b", values: evo.assist },
              ]}
              tips={evo.jogos.map((m, i) => ({
                title: `${fmtDateShort(m.date)} · ${m.goals_for}×${m.goals_against} ${m.opponent}`,
                lines: [`⚽ Gols: ${evo.gols[i]}`, `🅰️ Assistências: ${evo.assist[i]}`],
              }))}
              tickIdx={[...new Set([0, Math.round((evo.jogos.length - 1) / 3), Math.round(((evo.jogos.length - 1) * 2) / 3), evo.jogos.length - 1])]}
              tickLabel={(i) => fmtDateShort(evo.jogos[i].date)}
              yFmt={(v) => String(Math.round(v))}
              endLabels
            />
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-head">
          <h3>
            Partidas{" "}
            <span className="sub" style={{ display: "inline" }}>
              · {data.played.length}{periodOn ? " no período" : ""}
            </span>
          </h3>
        </div>
        {data.played.length === 0 ? (
          <div className="ga-empty" style={{ padding: "14px 18px" }}>
            {periodOn
              ? "Nenhuma partida deste atleta no período selecionado no topo."
              : "Nenhuma partida registrada com este atleta."}
          </div>
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
