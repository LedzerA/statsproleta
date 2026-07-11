import { useStore } from "./state/store";
import { useRoute, navigate } from "./lib/router";
import { TEAM } from "./config";
import { pct } from "./lib/format";
import { FormDots, Spinner } from "./components/ui";
import Home from "./views/Home";
import Matches from "./views/Matches";
import MatchDetail from "./views/MatchDetail";
import Athletes from "./views/Athletes";
import Opponents from "./views/Opponents";
import More from "./views/More";

const NAV = [
  { path: "#/", view: "inicio", label: "Início", icon: "🏠" },
  { path: "#/partidas", view: "partidas", label: "Partidas", icon: "📅" },
  { path: "#/atletas", view: "atletas", label: "Atletas", icon: "👟" },
  { path: "#/adversarios", view: "adversarios", label: "Rivais", icon: "🛡️" },
  { path: "#/mais", view: "mais", label: "Mais", icon: "☰" },
] as const;

export default function App() {
  const { loading, fatal, squads, squadId, setSquadId, squad, stats, liveMatch, toastMsg } = useStore();
  const route = useRoute();

  if (loading) return <Spinner />;
  if (fatal) {
    return (
      <div className="boot">
        <p style={{ maxWidth: 420, textAlign: "center" }}>
          <b>Ops…</b> {fatal}<br />
          Verifique a conexão e recarregue a página. Se for a primeira vez,
          rode o <code>supabase/schema.sql</code> no projeto Supabase (ver README).
        </p>
      </div>
    );
  }

  const activeView = route.view === "partida" ? "partidas" : route.view;
  const t = stats.team;
  const streak = t.streak
    ? `${t.streak.n} ${t.streak.r === "V" ? "vitória" : t.streak.r === "E" ? "empate" : "derrota"}${t.streak.n > 1 ? "s" : ""}`
    : "—";

  return (
    <>
      <header className="app-header">
        <div className="wrap">
          <div className="hd">
            <button className="crest" onClick={() => navigate("#/")}>
              <div className="mark">PA</div>
              <div className="txt">
                <h1>{TEAM.name}</h1>
                <div className="sub">
                  {TEAM.short}{squad ? ` · ${squad.name}` : ""} · Sequência: {streak}
                </div>
              </div>
            </button>
            <div className="scoreboard">
              <div className="kpis">
                <div className="kpi"><div className="n num">{t.J}</div><div className="l">Jogos</div></div>
                <div className="kpi"><div className="n num" style={{ color: "var(--verde-300)" }}>{t.V}</div><div className="l">Vit</div></div>
                <div className="kpi"><div className="n num" style={{ color: "var(--e)" }}>{t.E}</div><div className="l">Emp</div></div>
                <div className="kpi"><div className="n num" style={{ color: "var(--d)" }}>{t.D}</div><div className="l">Der</div></div>
                <div className="kpi"><div className="n num">{t.SG > 0 ? "+" : ""}{t.SG}</div><div className="l">Saldo</div></div>
              </div>
              <FormDots form={t.form} label="Forma" />
              <div className="aprov">
                <div className="n num">{pct(t.aprov)}</div>
                <div className="l">Aproveitamento</div>
              </div>
            </div>
          </div>
          {squads.length > 1 && (
            <div className="squad-row" role="tablist" aria-label="Elenco">
              {squads.map((s) => (
                <button
                  key={s.id}
                  role="tab"
                  aria-selected={s.id === squadId}
                  className={`squad-chip ${s.id === squadId ? "on" : ""}`}
                  onClick={() => setSquadId(s.id)}
                >
                  {s.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </header>

      {liveMatch && !(route.view === "partida" && route.id === liveMatch.id) && (
        <button className="live-banner" onClick={() => navigate(`#/partida/${liveMatch.id}`)}>
          <span className="pulse" />
          <b>AO VIVO</b>
          <span className="lb-score">
            {TEAM.short} {liveMatch.goals_for} × {liveMatch.goals_against} {liveMatch.opponent}
          </span>
          <span className="lb-go">acompanhar →</span>
        </button>
      )}

      <nav className="topnav">
        <div className="wrap tabs">
          {NAV.map((n) => (
            <button
              key={n.view}
              className={`tab ${activeView === n.view ? "active" : ""}`}
              onClick={() => navigate(n.path)}
            >
              {n.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="content">
        <div className="wrap">
          {route.view === "inicio" && <Home />}
          {route.view === "partidas" && <Matches openNew={route.nova} />}
          {route.view === "partida" && <MatchDetail id={route.id} />}
          {route.view === "atletas" && <Athletes />}
          {route.view === "adversarios" && <Opponents />}
          {route.view === "mais" && <More />}
        </div>
      </main>

      <nav className="bottomnav">
        {NAV.map((n) => (
          <button
            key={n.view}
            className={`bn-item ${activeView === n.view ? "active" : ""}`}
            onClick={() => navigate(n.path)}
          >
            <span className="bn-ic">{n.icon}</span>
            <span className="bn-lb">{n.label}</span>
          </button>
        ))}
      </nav>

      <div className={`toast ${toastMsg ? "show" : ""}`}>{toastMsg}</div>
    </>
  );
}
