import { useStore } from "../state/store";
import { navigate } from "../lib/router";
import { TEAM } from "../config";
import { dec, fmtDate, fmtDateShort, pct, result, sortMatches } from "../lib/format";
import { EmptyState, FormDots, ResultBadge } from "../components/ui";

export default function Home() {
  const { stats, matches, isAdmin } = useStore();
  const t = stats.team;

  if (t.J === 0 && !matches.length) {
    return (
      <EmptyState
        title="Nenhuma partida ainda"
        sub="Cadastre o primeiro jogo para ver as estatísticas."
        action={isAdmin
          ? <button className="btn primary" onClick={() => navigate("#/partidas")}>+ Nova partida</button>
          : <button className="btn" onClick={() => navigate("#/partidas")}>Ver partidas</button>}
      />
    );
  }

  const streak = t.streak
    ? `${t.streak.n} ${t.streak.r === "V" ? "vitória" : t.streak.r === "E" ? "empate" : "derrota"}${t.streak.n > 1 ? "s" : ""} seguida${t.streak.n > 1 ? "s" : ""}`
    : "—";
  const recent = sortMatches(matches).filter((m) => m.status === "encerrada").slice(-5).reverse();
  const next = sortMatches(matches).find((m) => m.status === "agendada");
  const top = [...stats.players].filter((p) => p.part > 0)
    .sort((a, b) => b.part - a.part || b.gols - a.gols).slice(0, 5);

  return (
    <>
      <div className="hero">
        <div className="hero-main">
          <div className="hero-aprov">
            <div className="n num">{pct(t.aprov)}</div>
            <div className="l">Aproveitamento</div>
          </div>
          <div className="hero-form">
            <span className="l">Forma</span>
            <FormDots form={t.form} />
            <span className="hero-streak">{streak}</span>
          </div>
        </div>
        <div className="kpis">
          <div className="kpi"><div className="n num">{t.J}</div><div className="l">Jogos</div></div>
          <div className="kpi v"><div className="n num">{t.V}</div><div className="l">Vit</div></div>
          <div className="kpi e"><div className="n num">{t.E}</div><div className="l">Emp</div></div>
          <div className="kpi d"><div className="n num">{t.D}</div><div className="l">Der</div></div>
          <div className="kpi"><div className="n num">{t.GP}:{t.GC}</div><div className="l">Gols</div></div>
          <div className="kpi"><div className="n num">{t.SG > 0 ? "+" : ""}{t.SG}</div><div className="l">Saldo</div></div>
        </div>
      </div>

      {next && (
        <button className="next-match" onClick={() => navigate(`#/partida/${next.id}`)}>
          <span className="nm-tag">Próximo jogo</span>
          <b>{TEAM.short} × {next.opponent}</b>
          <span className="muted">{fmtDate(next.date)}</span>
        </button>
      )}

      <div className="highlight-row">
        {stats.artilheiro && (
          <div className="hl">
            <div className="medal">⚽</div>
            <div>
              <div className="who">{stats.artilheiro.name}</div>
              <div className="role">Artilheiro</div>
            </div>
            <div className="val"><div className="n num">{stats.artilheiro.gols}</div><div className="u">gols</div></div>
          </div>
        )}
        {stats.garcom && (
          <div className="hl">
            <div className="medal">🅰️</div>
            <div>
              <div className="who">{stats.garcom.name}</div>
              <div className="role">Garçom</div>
            </div>
            <div className="val"><div className="n num">{stats.garcom.assist}</div><div className="u">assist.</div></div>
          </div>
        )}
      </div>

      <div className="grid">
        <div className="card">
          <div className="stat-num num">{t.GP}<span className="sep">:</span>{t.GC}</div>
          <div className="stat-label">Gols pró : contra</div>
          <div className="stat-sub">{dec(t.mgp)} feitos · {dec(t.mgc)} sofridos / jogo</div>
        </div>
        {t.maiorGoleada && (
          <div className="card">
            <div className="stat-num num pos">{t.maiorGoleada.m.goals_for}–{t.maiorGoleada.m.goals_against}</div>
            <div className="stat-label">Maior goleada</div>
            <div className="stat-sub">vs {t.maiorGoleada.m.opponent} · {fmtDate(t.maiorGoleada.m.date)}</div>
          </div>
        )}
        {t.piorDerrota && (
          <div className="card">
            <div className="stat-num num neg">{t.piorDerrota.m.goals_for}–{t.piorDerrota.m.goals_against}</div>
            <div className="stat-label">Pior derrota</div>
            <div className="stat-sub">vs {t.piorDerrota.m.opponent} · {fmtDate(t.piorDerrota.m.date)}</div>
          </div>
        )}
      </div>

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
                  <tr key={p.id}>
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
