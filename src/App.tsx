import { useStore } from "./state/store";
import { useRoute, navigate } from "./lib/router";
import { TEAM } from "./config";
import { pct } from "./lib/format";
import { Spinner } from "./components/ui";
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
  const { loading, fatal, squads, squadId, setSquadId, stats, liveMatch, toastMsg } = useStore();
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

  return (
    <>
      <header className="app-header">
        <div className="wrap hd">
          <button className="crest" onClick={() => navigate("#/")}>
            <div className="mark">PA</div>
            <div className="txt">
              <h1>{TEAM.name}</h1>
              <div className="sub">
                {t.J} jogos · {t.V}V {t.E}E {t.D}D · {pct(t.aprov)}
              </div>
            </div>
          </button>
          {squads.length > 1 && (
            <div className="squad-picker" role="tablist" aria-label="Elenco">
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

      {liveMatch && !isLiveDetail(route, liveMatch.id) && (
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
          {route.view === "partidas" && <Matches />}
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

function isLiveDetail(route: ReturnType<typeof useRoute>, liveId: string): boolean {
  return route.view === "partida" && route.id === liveId;
}
