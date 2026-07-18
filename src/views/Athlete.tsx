import { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store";
import { navigate } from "../lib/router";
import { compute, matchGoalkeepers } from "../lib/stats";
import { dec, fmtDate, fmtDateShort, pct, result, sortMatches } from "../lib/format";
import { inPeriod, periodRange } from "../lib/period";
import { POSITIONS, athletePositions, posRank } from "../lib/positions";
import { athleteMarcos } from "../lib/records";
import { Modal, ResultBadge } from "../components/ui";
import { LineChart } from "../components/LineChart";

export default function Athlete({ id }: { id: string }) {
  const { athletes, allMatches, squads, period, periodOn, isAdmin, updateAthletePositions, updateAthleteName } = useStore();
  const athlete = athletes.find((a) => a.id === id);
  const [editPos, setEditPos] = useState<string[] | null>(null);
  const [editName, setEditName] = useState<string | null>(null);
  // filtro da lista de partidas pela posição em que ele atuou
  const [fPos, setFPos] = useState<string | null>(null);
  useEffect(() => { setFPos(null); }, [id]);

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
    // posições do perfil (curadas) ou derivadas do histórico completo
    const posList = athletePositions(athlete, all);
    // estatísticas de goleiro no período (posição GOL nas partidas)
    const gk = stats.goalkeepers.find((g) => g.id === id) || null;
    // marcos são da carreira COMPLETA — ignoram o filtro de período
    let jogosAll = 0, golsAll = 0, assistAll = 0, hats = 0, gkJogos = 0, gkSemSofrer = 0;
    for (const m of all) {
      if (m.status !== "encerrada" || m.archived) continue;
      if ((m.lineup || []).includes(id)) jogosAll++;
      const g = (m.scorers || []).find((s) => s.a === id)?.g || 0;
      golsAll += g;
      if (g >= 3) hats++;
      assistAll += (m.assists || []).find((s) => s.a === id)?.n || 0;
      if (matchGoalkeepers(m).includes(id)) {
        gkJogos++;
        if (m.goals_against === 0) gkSemSofrer++;
      }
    }
    const marcos = athleteMarcos({ jogos: jogosAll, gols: golsAll, assist: assistAll, gkJogos, gkSemSofrer });
    return { p, played, posList, gk, marcos, hats, temCarreira: jogosAll + golsAll + assistAll > 0 };
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

  /* posições em que ele atuou nas partidas listadas (composta "LE/ZG" conta
     nas duas) + quantas vezes — vira a régua de filtro da lista */
  const posJogadas = useMemo(() => {
    if (!data) return [];
    const map = new Map<string, number>();
    for (const m of data.played) {
      const raw = m.positions?.[id];
      if (!raw) continue;
      for (const part of raw.split("/")) {
        const p = part.trim().toUpperCase();
        if (p) map.set(p, (map.get(p) || 0) + 1);
      }
    }
    return [...map.entries()].sort((a, b) => posRank(a[0]) - posRank(b[0]) || b[1] - a[1]);
  }, [data, id]);

  const shown = useMemo(() => {
    if (!data) return [];
    if (!fPos) return data.played;
    return data.played.filter((m) =>
      (m.positions?.[id] || "").toUpperCase().split("/").map((s) => s.trim()).includes(fPos));
  }, [data, id, fPos]);

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
        <div className="sh-status">
          {squadName}{data.posList.length ? ` · ${data.posList.join(" · ")}` : ""}
        </div>
        <div className="sh-teams" style={{ gridTemplateColumns: "1fr" }}>
          <div className="sh-team" style={{ fontSize: 30 }}>{athlete.name}</div>
        </div>
        {isAdmin && (
          <div className="row-gap" style={{ marginTop: 10, justifyContent: "center" }}>
            <button
              className="btn sm ghost-light"
              onClick={() => setEditPos(athlete.positions?.length ? [...athlete.positions] : [...data.posList])}
            >
              ✎ Editar posições
            </button>
            <button className="btn sm ghost-light" onClick={() => setEditName(athlete.name)}>
              ✎ Renomear
            </button>
          </div>
        )}
      </div>

      {editPos && (
        <Modal
          title={`Posições · ${athlete.name}`}
          onClose={() => setEditPos(null)}
          footer={
            <>
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => setEditPos(null)}>Cancelar</button>
              <button
                className="btn primary" style={{ flex: 2 }}
                onClick={() => { updateAthletePositions(athlete.id, editPos); setEditPos(null); }}
              >
                Salvar posições
              </button>
            </>
          }
        >
          <div className="subhead"><div className="t">Em que posições ele atua?</div></div>
          <div className="chips">
            {POSITIONS.map((p) => (
              <button
                key={p}
                className={`chip ${editPos.includes(p) ? "on" : ""}`}
                onClick={() => setEditPos((old) =>
                  old!.includes(p) ? old!.filter((x) => x !== p) : [...POSITIONS.filter((x) => old!.includes(x) || x === p)]
                )}
              >
                {p}
              </button>
            ))}
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
            A primeira posição (na ordem GOL → CA) vira a principal — usada para agrupar
            a escalação e sugerir a posição nas partidas. Sem seleção, o app usa o histórico.
          </p>
        </Modal>
      )}

      {editName !== null && (
        <Modal
          title="Renomear atleta"
          onClose={() => setEditName(null)}
          footer={
            <>
              <button className="btn ghost" style={{ flex: 1 }} onClick={() => setEditName(null)}>Cancelar</button>
              <button
                className="btn primary" style={{ flex: 2 }}
                onClick={async () => { if (await updateAthleteName(athlete.id, editName)) setEditName(null); }}
              >
                Salvar nome
              </button>
            </>
          }
        >
          <div className="field">
            <label>Nome do atleta</label>
            <input
              type="text" value={editName} autoFocus autoComplete="off"
              onChange={(e) => setEditName(e.target.value)}
              onKeyDown={async (e) => {
                if (e.key === "Enter" && await updateAthleteName(athlete.id, editName)) setEditName(null);
              }}
            />
          </div>
          <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
            A correção vale para o histórico inteiro: partidas, gols, assistências e artes
            passam a mostrar o nome novo (os registros guardam o atleta, não o texto do nome).
          </p>
        </Modal>
      )}

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
          {data.gk && (
            <div className="card dark">
              <div className="stat-num num">{data.gk.semSofrer}</div>
              <div className="stat-label">🧤 Jogos sem sofrer</div>
              <div className="stat-sub">
                {data.gk.jogos} jogo{data.gk.jogos !== 1 ? "s" : ""} no gol · {dec(data.gk.media)} sofrido(s)/jogo
              </div>
            </div>
          )}
        </div>
      )}

      {data.temCarreira && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>🏅 Marcos da carreira</h3>
              <div className="sub">todos os tempos neste elenco — não segue o filtro de período</div>
            </div>
          </div>
          <div className="detail-body">
            <div className="chips">
              {data.marcos.filter((mc) => mc.atingido).map((mc) => (
                <span key={mc.tipo} className="chip static on">{mc.icon} {mc.atingido}+ {mc.tipo}</span>
              ))}
              {data.hats > 0 && (
                <span className="chip static on">🎩 {data.hats} hat-trick{data.hats > 1 ? "s" : ""}</span>
              )}
              {!data.marcos.some((mc) => mc.atingido) && data.hats === 0 && (
                <span className="muted" style={{ fontSize: 13 }}>Nenhum marco atingido ainda — o primeiro vem aí.</span>
              )}
            </div>
            {data.marcos.some((mc) => mc.proximo) && (
              <p className="marcos-next">
                Próximos:{" "}
                {data.marcos.filter((mc) => mc.proximo)
                  .map((mc) => `${mc.icon} ${mc.proximo!.falta} para ${mc.proximo!.alvo} ${mc.tipo}`)
                  .join(" · ")}
              </p>
            )}
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
              · {fPos ? `${shown.length} de ${data.played.length}` : data.played.length}
              {periodOn ? " no período" : ""}{fPos ? ` · de ${fPos}` : ""}
            </span>
          </h3>
        </div>
        {posJogadas.length > 1 && (
          <div className="chips" style={{ padding: "10px 18px 2px" }}>
            {posJogadas.map(([p, n]) => (
              <button
                key={p}
                className={`chip ${fPos === p ? "on" : ""}`}
                onClick={() => setFPos(fPos === p ? null : p)}
                title={`Partidas em que atuou de ${p}`}
              >
                {p} · {n}
              </button>
            ))}
          </div>
        )}
        {shown.length === 0 ? (
          <div className="ga-empty" style={{ padding: "14px 18px" }}>
            {fPos
              ? `Nenhuma partida de ${fPos} no recorte atual.`
              : periodOn
                ? "Nenhuma partida deste atleta no período selecionado no topo."
                : "Nenhuma partida registrada com este atleta."}
          </div>
        ) : (
          <div className="mini-matches">
            {shown.map((m) => {
              const g = (m.scorers || []).find((s) => s.a === id)?.g || 0;
              const a = (m.assists || []).find((s) => s.a === id)?.n || 0;
              const contrib = [
                g > 0 && `⚽${g > 1 ? ` ${g}` : ""}`,
                a > 0 && `🅰️${a > 1 ? ` ${a}` : ""}`,
                (m.starters || []).includes(id) && "★",
              ].filter(Boolean).join(" ");
              const pos = m.positions?.[id] || "";
              return (
                <button key={m.id} className="mini-match" onClick={() => navigate(`#/partida/${m.id}`)}>
                  <span className="mm-date">{fmtDate(m.date).slice(0, 5)}</span>
                  <span className="mm-score num">{m.goals_for} × {m.goals_against}</span>
                  <span className="mm-opp">{m.opponent}</span>
                  {pos && <span className="mm-pos">{pos}</span>}
                  {contrib && <span className="mm-contrib">{contrib}</span>}
                  <ResultBadge r={result(m)} />
                </button>
              );
            })}
          </div>
        )}
      </div>
      <div className="legend">★ = titular na partida · ⚽ gols · 🅰️ assistências · a sigla verde é a posição naquele jogo.</div>
    </>
  );
}
