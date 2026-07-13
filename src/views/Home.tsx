import { useStore } from "../state/store";
import { navigate } from "../lib/router";
import { TEAM } from "../config";
import { dec, fmtDate, fmtDateShort, pct, result, sortMatches } from "../lib/format";
import { PERIOD_ALL, periodLabel } from "../lib/period";
import { EmptyState, ResultBadge } from "../components/ui";

export default function Home() {
  const { stats, matches, squadMatches, period, periodOn, setPeriod, isAdmin } = useStore();
  const t = stats.team;

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
        </div>
        <div className="card">
          <div className="stat-num num">{t.GP}<span className="sep"> : </span>{t.GC}</div>
          <div className="stat-label">Gols pró : contra</div>
          <div className="stat-sub">{dec(t.mgp)} feitos · {dec(t.mgc)} sofridos / jogo</div>
        </div>
        <div className="card">
          <div className={`stat-num num ${t.SG > 0 ? "pos" : t.SG < 0 ? "neg" : ""}`}>
            {t.SG > 0 ? "+" : ""}{t.SG}
          </div>
          <div className="stat-label">Saldo de gols</div>
          <div className="stat-sub">{t.V}V · {t.E}E · {t.D}D em {t.J} jogos</div>
        </div>
        <div className="card">
          <div className="stat-num num">{dec(t.J ? (t.GP + t.GC) / t.J : 0, 1)}</div>
          <div className="stat-label">Gols por jogo</div>
          <div className="stat-sub">soma das duas equipes</div>
        </div>
      </div>

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
