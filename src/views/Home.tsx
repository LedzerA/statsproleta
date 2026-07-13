import { useMemo, useState } from "react";
import { useStore } from "../state/store";
import { navigate } from "../lib/router";
import { TEAM } from "../config";
import { dec, fmtDate, fmtDateShort, pct, pts as ptsOf, result, sortMatches } from "../lib/format";
import { PERIOD_ALL, periodLabel } from "../lib/period";
import { EmptyState, ResultBadge } from "../components/ui";
import { LineChart } from "../components/LineChart";

type EvoMode = "aprov" | "forma" | "saldo";
const EVO_INFO: Record<EvoMode, { chip: string; sub: string }> = {
  aprov: { chip: "Aproveitamento", sub: "% dos pontos conquistados do primeiro jogo até cada partida" },
  forma: { chip: "Forma (últ. 5)", sub: "aproveitamento considerando só os 5 jogos anteriores a cada ponto" },
  saldo: { chip: "Saldo de gols", sub: "gols pró menos gols contra, acumulado jogo a jogo" },
};

export default function Home() {
  const { stats, matches, squadMatches, period, periodOn, setPeriod, isAdmin } = useStore();
  const t = stats.team;
  const [evoMode, setEvoMode] = useState<EvoMode>("aprov");

  const done = useMemo(
    () => sortMatches(matches).filter((m) => m.status === "encerrada" && !m.archived),
    [matches]
  );
  const evo = useMemo(() => {
    let soma = 0, sg = 0;
    const porJogo: number[] = [];
    const aprov: number[] = [], forma: number[] = [], saldo: number[] = [];
    for (const [i, m] of done.entries()) {
      const p = ptsOf(m);
      soma += p;
      porJogo.push(p);
      sg += m.goals_for - m.goals_against;
      aprov.push(soma / ((i + 1) * 3));
      const jan = porJogo.slice(-5);
      forma.push(jan.reduce((a, b) => a + b, 0) / (jan.length * 3));
      saldo.push(sg);
    }
    return { aprov, forma, saldo };
  }, [done]);

  if (t.J === 0 && !matches.length) {
    if (periodOn && squadMatches.length > 0) {
      return (
        <EmptyState
          icon="🔍"
          title="Nenhuma partida no período"
          sub="O filtro de período no topo está escondendo os jogos deste elenco."
          action={<button className="btn ghost-light" onClick={() => setPeriod(PERIOD_ALL)}>Mostrar tudo</button>}
        />
      );
    }
    return (
      <EmptyState
        title="Nenhuma partida ainda"
        sub="Cadastre o primeiro jogo para ver as estatísticas."
        action={isAdmin
          ? <button className="btn primary" onClick={() => navigate("#/partidas/nova")}>+ Nova partida</button>
          : <button className="btn ghost-light" onClick={() => navigate("#/partidas")}>Ver partidas</button>}
      />
    );
  }

  const recent = sortMatches(matches).filter((m) => m.status === "encerrada").slice(-5).reverse();
  const next = sortMatches(matches).find((m) => m.status === "agendada");
  const top = [...stats.players].filter((p) => p.part > 0)
    .sort((a, b) => b.part - a.part || b.gols - a.gols).slice(0, 5);
  const mg = t.maiorGoleada, pd = t.piorDerrota;

  return (
    <>
      <div className="section-title">
        <h2>
          {periodOn
            ? <>Visão geral <span className="hint">· {periodLabel(period)}</span></>
            : "Visão geral da temporada"}
        </h2>
        {isAdmin && (
          <button className="btn primary sm" onClick={() => navigate("#/partidas/nova")}>
            + Nova partida
          </button>
        )}
      </div>

      {next && (
        <button className="next-match" onClick={() => navigate(`#/partida/${next.id}`)}>
          <span className="nm-tag">Próximo jogo</span>
          <b>{TEAM.short} × {next.opponent}</b>
          <span className="muted">
            {fmtDate(next.date)}
            {next.kickoff ? ` · ${next.kickoff}` : ""}
            {next.venue ? ` · ${next.venue}` : ""}
          </span>
        </button>
      )}

      <div className="grid">
        <div className="card dark">
          <div className="stat-num num">{pct(t.aprov)}</div>
          <div className="stat-label">Aproveitamento</div>
          <div className="stat-sub">{t.pts} de {t.J * 3} pts possíveis</div>
          <div className="meter"><i style={{ width: `${Math.min(100, t.aprov * 100)}%` }} /></div>
        </div>
        <div className="card">
          <div className="stat-num num">{t.GP}<span className="sep"> : </span>{t.GC}</div>
          <div className="stat-label">Gols pró : contra</div>
          <div className="stat-sub">{dec(t.mgp)} feitos · {dec(t.mgc)} sofridos / jogo</div>
          {t.GP + t.GC > 0 && (
            <div className="duo-bar" title={`${t.GP} pró × ${t.GC} contra`}>
              <i className="gp" style={{ width: `${(t.GP / (t.GP + t.GC)) * 100}%` }} />
              <i className="gc" style={{ width: `${(t.GC / (t.GP + t.GC)) * 100}%` }} />
            </div>
          )}
        </div>
        <div className="card">
          <div className={`stat-num num ${t.SG > 0 ? "pos" : t.SG < 0 ? "neg" : ""}`}>
            {t.SG > 0 ? "+" : ""}{t.SG}
          </div>
          <div className="stat-label">Saldo de gols</div>
          <div className="stat-sub">{t.V}V · {t.E}E · {t.D}D em {t.J} jogos</div>
          {t.J > 0 && (
            <div className="ved-bar" title={`${t.V} vitórias, ${t.E} empates, ${t.D} derrotas`}>
              <i className="sv" style={{ width: `${(t.V / t.J) * 100}%` }} />
              <i className="se" style={{ width: `${(t.E / t.J) * 100}%` }} />
              <i className="sd" style={{ width: `${(t.D / t.J) * 100}%` }} />
            </div>
          )}
        </div>
        <div className="card">
          <div className="stat-num num">{dec(t.J ? (t.GP + t.GC) / t.J : 0, 1)}</div>
          <div className="stat-label">Gols por jogo</div>
          <div className="stat-sub">soma das duas equipes</div>
        </div>
      </div>

      {done.length >= 3 && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>📈 Evolução {periodOn ? "no período" : "da temporada"}</h3>
              <div className="sub">{EVO_INFO[evoMode].sub}</div>
            </div>
          </div>
          <div className="chart-chips">
            {(Object.keys(EVO_INFO) as EvoMode[]).map((k) => (
              <button
                key={k}
                className={`f-chip ${evoMode === k ? "on" : ""}`}
                onClick={() => setEvoMode(k)}
              >
                {EVO_INFO[k].chip}
              </button>
            ))}
          </div>
          <div className="chart-box">
            <LineChart
              series={[{
                name: EVO_INFO[evoMode].chip,
                color: "#1aa04a",
                values: evo[evoMode],
                fill: true,
              }]}
              tips={done.map((m, i) => ({
                title: `${fmtDateShort(m.date)} · ${m.goals_for}×${m.goals_against} ${m.opponent}`,
                lines: [
                  evoMode === "saldo"
                    ? `Saldo acumulado: ${evo.saldo[i] > 0 ? "+" : ""}${evo.saldo[i]}`
                    : `${EVO_INFO[evoMode].chip}: ${pct(evo[evoMode][i])}`,
                  `Jogo ${i + 1} de ${done.length}`,
                ],
              }))}
              tickIdx={[...new Set([0, Math.round((done.length - 1) / 3), Math.round(((done.length - 1) * 2) / 3), done.length - 1])]}
              tickLabel={(i) => fmtDateShort(done[i].date)}
              yDomain={evoMode === "saldo" ? undefined : [0, 1]}
              yFmt={(v) => evoMode === "saldo"
                ? `${v > 0 ? "+" : ""}${Math.round(v)}`
                : `${Math.round(v * 100)}%`}
              zeroLine={evoMode === "saldo"}
            />
          </div>
        </div>
      )}

      <div className="highlight-row">
        {stats.artilheiro && (
          <button className="hl" onClick={() => navigate(`#/atleta/${stats.artilheiro!.id}`)}>
            <div className="medal">⚽</div>
            <div>
              <div className="who">{stats.artilheiro.name}</div>
              <div className="role">Artilheiro</div>
            </div>
            <div className="val"><div className="n num">{stats.artilheiro.gols}</div><div className="u">gols</div></div>
          </button>
        )}
        {stats.garcom && (
          <button className="hl" onClick={() => navigate(`#/atleta/${stats.garcom!.id}`)}>
            <div className="medal">🅰️</div>
            <div>
              <div className="who">{stats.garcom.name}</div>
              <div className="role">Garçom</div>
            </div>
            <div className="val"><div className="n num">{stats.garcom.assist}</div><div className="u">assist.</div></div>
          </button>
        )}
      </div>

      {(mg || pd) && (
        <div className="grid">
          {mg && (
            <button className="card clickable" onClick={() => navigate(`#/partida/${mg.m.id}`)}>
              <div className="stat-label">Maior goleada</div>
              <div className="stat-num num pos" style={{ fontSize: 26, marginTop: 6 }}>
                {mg.m.goals_for}–{mg.m.goals_against}
              </div>
              <div className="stat-sub">vs {mg.m.opponent} · {fmtDate(mg.m.date)} →</div>
            </button>
          )}
          {pd && (
            <button className="card clickable" onClick={() => navigate(`#/partida/${pd.m.id}`)}>
              <div className="stat-label">Pior derrota</div>
              <div className="stat-num num neg" style={{ fontSize: 26, marginTop: 6 }}>
                {pd.m.goals_for}–{pd.m.goals_against}
              </div>
              <div className="stat-sub">vs {pd.m.opponent} · {fmtDate(pd.m.date)} →</div>
            </button>
          )}
        </div>
      )}

      {recent.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <h3>Últimas partidas</h3>
            <button className="btn sm ghost" onClick={() => navigate("#/partidas")}>Ver todas →</button>
          </div>
          <div className="mini-matches">
            {recent.map((m) => (
              <button key={m.id} className="mini-match" onClick={() => navigate(`#/partida/${m.id}`)}>
                <span className="mm-date">{fmtDateShort(m.date)}</span>
                <span className="mm-score num">{m.goals_for} × {m.goals_against}</span>
                <span className="mm-opp">{m.opponent}</span>
                <ResultBadge r={result(m)} />
              </button>
            ))}
          </div>
        </div>
      )}

      {top.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Destaques em participações</h3>
              <div className="sub">gols + assistências · top 5</div>
            </div>
            <button className="btn sm ghost" onClick={() => navigate("#/atletas")}>Ver todos →</button>
          </div>
          <div className="table-wrap">
            <table className="stats">
              <thead><tr><th>Atleta</th><th>J</th><th>G</th><th>A</th><th>Part.</th><th>Part./J</th></tr></thead>
              <tbody>
                {top.map((p, i) => (
                  <tr key={p.id} className="row-link" onClick={() => navigate(`#/atleta/${p.id}`)}>
                    <td className="name"><span className="rk">{i + 1}</span>{p.name}</td>
                    <td className="cell-num">{p.jogos}</td>
                    <td className="cell-num">{p.gols}</td>
                    <td className="cell-num">{p.assist}</td>
                    <td className="cell-num">{p.part}</td>
                    <td className="cell-num muted">{dec(p.ppj)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  );
}
