import { useMemo, useState } from "react";
import { useStore } from "../state/store";
import { navigate } from "../lib/router";
import { compute, type TeamStats } from "../lib/stats";
import { addDaysISO, monthsAgoISO } from "../lib/period";
import { dec, fmtDate, fmtDateShort, pct, result, sortMatches } from "../lib/format";
import { EmptyState, ResultBadge } from "../components/ui";
import type { Match } from "../lib/types";

type Mode = "meses" | "jogos";
const OPTS: Record<Mode, number[]> = { meses: [1, 2, 3, 6, 12], jogos: [3, 5, 10, 15] };

interface Interval {
  tag: "Anterior" | "Atual";
  label: string;
  sub: string;
  matches: Match[]; // encerradas, ordem cronológica
}

interface RowDef {
  label: string;
  sub: string;
  a: number | null; // anterior (null = sem jogos)
  b: number | null; // atual
  fmt: (v: number) => string;
  deltaKind: "pts" | "num";
  betterLower?: boolean;
}

function deltaInfo(row: RowDef): { cls: "up" | "down" | "flat"; txt: string } {
  if (row.a == null || row.b == null) return { cls: "flat", txt: "sem dados" };
  const diff = row.b - row.a;
  if (Math.abs(diff) < (row.deltaKind === "pts" ? 0.0005 : 0.005)) return { cls: "flat", txt: "igual" };
  const good = row.betterLower ? diff < 0 : diff > 0;
  const txt = row.deltaKind === "pts"
    ? `${diff > 0 ? "+" : ""}${dec(diff * 100, 1)} pts`
    : `${diff > 0 ? "+" : ""}${dec(diff)}`;
  return { cls: good ? "up" : "down", txt: `${txt} · ${good ? "melhor" : "pior"}` };
}

function HeadCard({ it, t, dark }: { it: Interval; t: TeamStats; dark?: boolean }) {
  return (
    <div className={`cmp-head ${dark ? "dark" : ""}`}>
      <div className="ch-tag">{it.tag}</div>
      <div className="ch-title">{it.label}</div>
      <div className="ch-sub">{it.sub}</div>
      <div className="ch-aprov num">{t.J ? pct(t.aprov) : "—"}</div>
      <div className="ch-aprov-l">Aproveitamento</div>
      <div className="ch-ved num">
        <span className="v">{t.V}V</span> · <span className="e">{t.E}E</span> · <span className="d">{t.D}D</span>
      </div>
      <div className="ved-bar">
        {t.J > 0 && (
          <>
            <i className="sv" style={{ width: `${(t.V / t.J) * 100}%` }} />
            <i className="se" style={{ width: `${(t.E / t.J) * 100}%` }} />
            <i className="sd" style={{ width: `${(t.D / t.J) * 100}%` }} />
          </>
        )}
      </div>
      <div className="ch-line">
        {t.J} jogo{t.J !== 1 ? "s" : ""} · gols {t.GP} × {t.GC} · saldo {t.SG > 0 ? "+" : ""}{t.SG}
      </div>
    </div>
  );
}

function GamesCol({ it }: { it: Interval }) {
  const list = [...it.matches].reverse();
  return (
    <div className="col">
      <div className="cd-head">{it.tag} · {list.length} jogo{list.length !== 1 ? "s" : ""}</div>
      {list.length === 0 ? (
        <div className="ga-empty" style={{ padding: "6px 18px 16px" }}>Sem jogos no intervalo.</div>
      ) : (
        <div className="mini-matches">
          {list.map((m) => (
            <button key={m.id} className="mini-match" onClick={() => navigate(`#/partida/${m.id}`)}>
              <span className="mm-date">{fmtDateShort(m.date)}</span>
              <span className="mm-score num">{m.goals_for} × {m.goals_against}</span>
              <span className="mm-opp">{m.opponent}</span>
              <ResultBadge r={result(m)} />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function BestRow({ role, unit, a, b }: {
  role: string; unit: string;
  a: { id: string; name: string; n: number } | null;
  b: { id: string; name: string; n: number } | null;
}) {
  const cell = (p: typeof a) => p
    ? (
      <span className="best-cell">
        <button className="linklike" onClick={() => navigate(`#/atleta/${p.id}`)}>{p.name}</button>{" "}
        <b className="num">{p.n}</b> <span className="best-u">{unit}</span>
      </span>
    )
    : <span className="best-cell muted">—</span>;
  return (
    <div className="best-row">
      <span className="best-role">{role}</span>
      {cell(a)}
      {cell(b)}
    </div>
  );
}

export default function Compare() {
  const { squadMatches, roster } = useStore();
  const [mode, setMode] = useState<Mode>("meses");
  const [nBy, setNBy] = useState<Record<Mode, number>>({ meses: 3, jogos: 5 });
  const n = nBy[mode];
  const setN = (v: number) => setNBy((old) => ({ ...old, [mode]: v }));

  const done = useMemo(
    () => sortMatches(squadMatches.filter((m) => m.status === "encerrada" && !m.archived)),
    [squadMatches]
  );

  const { anterior, atual } = useMemo((): { anterior: Interval; atual: Interval } => {
    if (mode === "meses") {
      const meio = monthsAgoISO(n);
      const inicio = monthsAgoISO(2 * n);
      const um = n === 1;
      return {
        atual: {
          tag: "Atual",
          label: um ? "Último mês" : `Últimos ${n} meses`,
          sub: `${fmtDate(meio)} — hoje`,
          matches: done.filter((m) => m.date >= meio),
        },
        anterior: {
          tag: "Anterior",
          label: um ? "Mês anterior" : `${n} meses anteriores`,
          sub: `${fmtDate(inicio)} — ${fmtDate(addDaysISO(meio, -1))}`,
          matches: done.filter((m) => m.date >= inicio && m.date < meio),
        },
      };
    }
    const at = done.slice(-n);
    const an = done.slice(Math.max(0, done.length - 2 * n), Math.max(0, done.length - n));
    const um = n === 1;
    const range = (l: Match[]) =>
      l.length ? `${fmtDate(l[0].date)} — ${fmtDate(l[l.length - 1].date)}` : "sem jogos no histórico";
    return {
      atual: { tag: "Atual", label: um ? "Último jogo" : `Últimos ${n} jogos`, sub: range(at), matches: at },
      anterior: { tag: "Anterior", label: um ? "Jogo anterior" : `${n} jogos anteriores`, sub: range(an), matches: an },
    };
  }, [mode, n, done]);

  const sA = useMemo(() => compute(roster, anterior.matches), [roster, anterior]);
  const sB = useMemo(() => compute(roster, atual.matches), [roster, atual]);
  const tA = sA.team, tB = sB.team;

  const rows: RowDef[] = useMemo(() => {
    const cleanA = anterior.matches.filter((m) => m.goals_against === 0).length;
    const cleanB = atual.matches.filter((m) => m.goals_against === 0).length;
    const scoredA = anterior.matches.filter((m) => m.goals_for > 0).length;
    const scoredB = atual.matches.filter((m) => m.goals_for > 0).length;
    return [
      {
        label: "% de vitórias", sub: "partidas vencidas sobre o total do intervalo",
        a: tA.J ? tA.V / tA.J : null, b: tB.J ? tB.V / tB.J : null, fmt: pct, deltaKind: "pts",
      },
      {
        label: "Gols marcados por jogo", sub: "força do ataque",
        a: tA.J ? tA.mgp : null, b: tB.J ? tB.mgp : null, fmt: (v) => dec(v), deltaKind: "num",
      },
      {
        label: "Gols sofridos por jogo", sub: "solidez da defesa — aqui, menor é melhor",
        a: tA.J ? tA.mgc : null, b: tB.J ? tB.mgc : null, fmt: (v) => dec(v), deltaKind: "num", betterLower: true,
      },
      {
        label: "Jogos sem sofrer gol", sub: "% de partidas com a defesa não vazada",
        a: tA.J ? cleanA / tA.J : null, b: tB.J ? cleanB / tB.J : null, fmt: pct, deltaKind: "pts",
      },
      {
        label: "Jogos marcando gol", sub: "% de partidas em que o time balançou a rede",
        a: tA.J ? scoredA / tA.J : null, b: tB.J ? scoredB / tB.J : null, fmt: pct, deltaKind: "pts",
      },
    ];
  }, [anterior, atual, tA, tB]);

  if (done.length === 0) {
    return (
      <>
        <div className="section-title"><h2>Comparativo</h2></div>
        <EmptyState
          title="Nada para comparar ainda"
          sub="O comparativo usa partidas encerradas — cadastre ou encerre jogos para ver a evolução do time."
        />
      </>
    );
  }

  const ready = tA.J > 0 && tB.J > 0;
  const judged = rows.map(deltaInfo);
  const withData = rows.filter((r) => r.a != null && r.b != null).length;
  const ups = judged.filter((d) => d.cls === "up").length;
  const aprovPts = (tB.aprov - tA.aprov) * 100;
  const verdict = aprovPts >= 3
    ? { emo: "📈", title: "Time em evolução" }
    : aprovPts <= -3
      ? { emo: "📉", title: "Rendimento em queda" }
      : { emo: "➖", title: "Rendimento estável" };

  const unidade = mode === "meses" ? (n === 1 ? "mês" : "meses") : (n === 1 ? "jogo" : "jogos");

  return (
    <>
      <div className="section-title">
        <h2>Comparativo</h2>
        <span className="hint">o time melhorou ou piorou? compare dois intervalos</span>
      </div>

      <div className="filter-bar">
        <button className={`f-chip ${mode === "meses" ? "on" : ""}`} onClick={() => setMode("meses")}>Por meses</button>
        <button className={`f-chip ${mode === "jogos" ? "on" : ""}`} onClick={() => setMode("jogos")}>Por jogos</button>
        <span className="fb-sep" />
        {OPTS[mode].map((o) => (
          <button key={o} className={`f-chip ${n === o ? "on" : ""}`} onClick={() => setN(o)}>
            {o} {mode === "meses" ? (o === 1 ? "mês" : "meses") : "jogos"}
          </button>
        ))}
        <label>Outro
          <input
            type="number" className="fb-num" min={1} max={99} value={n}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              if (!isNaN(v)) setN(Math.min(99, Math.max(1, v)));
            }}
          />
        </label>
      </div>
      <div className="cmp-note">
        Comparando os últimos {n} {unidade} com os {n} {unidade} logo antes.
        Só partidas encerradas contam — o filtro de período do topo não interfere aqui.
      </div>

      {ready ? (
        <div className="cmp-verdict">
          <span className="vg-emo">{verdict.emo}</span>
          <div>
            <div className="vg-title">{verdict.title}</div>
            <div className="vg-sub">
              Aproveitamento foi de {pct(tA.aprov)} para {pct(tB.aprov)}{" "}
              ({aprovPts > 0 ? "+" : ""}{dec(aprovPts, 1)} pts) · {ups} de {withData} indicadores melhoraram
            </div>
          </div>
        </div>
      ) : (
        <div className="banner">
          <span className="ic">ⓘ</span>
          <div>
            <b>Ainda não dá para comparar.</b> Um dos intervalos está sem jogos encerrados —
            diminua o tamanho do intervalo ou espere mais partidas.
          </div>
        </div>
      )}

      <div className="cmp-heads">
        <HeadCard it={anterior} t={tA} />
        <div className="cmp-vs num">vs</div>
        <HeadCard it={atual} t={tB} dark />
      </div>

      <div className="panel">
        <div className="panel-head">
          <div>
            <h3>Indicadores lado a lado</h3>
            <div className="sub">barra maior = valor maior no intervalo · o selo diz se ficou melhor ou pior</div>
          </div>
        </div>
        <div className="cmp-legend">
          <span><span className="sw ant" />Anterior</span>
          <span><span className="sw atu" />Atual</span>
        </div>
        {rows.map((row, i) => {
          const d = judged[i];
          const max = Math.max(row.a ?? 0, row.b ?? 0);
          const wa = max > 0 && row.a != null ? (row.a / max) * 100 : 0;
          const wb = max > 0 && row.b != null ? (row.b / max) * 100 : 0;
          return (
            <div key={row.label} className="cmp-row">
              <div className="cr-top">
                <span className="cr-label">{row.label}</span>
                <span className={`delta ${d.cls}`}>{d.txt}</span>
              </div>
              <div className="cr-bar">
                <span className="cr-val a num">{row.a == null ? "—" : row.fmt(row.a)}</span>
                <div className="cb">
                  <div className="cb-half left"><i style={{ width: `${wa}%` }} /></div>
                  <div className="cb-mid" />
                  <div className="cb-half right"><i style={{ width: `${wb}%` }} /></div>
                </div>
                <span className="cr-val b num">{row.b == null ? "—" : row.fmt(row.b)}</span>
              </div>
              <div className="cr-sub">{row.sub}</div>
            </div>
          );
        })}
      </div>

      {ready && (sA.artilheiro || sB.artilheiro || sA.garcom || sB.garcom) && (
        <div className="panel">
          <div className="panel-head">
            <div>
              <h3>Destaques de cada intervalo</h3>
              <div className="sub">quem carregou o time em cada fase</div>
            </div>
          </div>
          <div className="best-row head">
            <span />
            <span className="best-h">Anterior</span>
            <span className="best-h">Atual</span>
          </div>
          <BestRow
            role="⚽ Artilheiro" unit="gols"
            a={sA.artilheiro && { id: sA.artilheiro.id, name: sA.artilheiro.name, n: sA.artilheiro.gols }}
            b={sB.artilheiro && { id: sB.artilheiro.id, name: sB.artilheiro.name, n: sB.artilheiro.gols }}
          />
          <BestRow
            role="🅰️ Garçom" unit="assist."
            a={sA.garcom && { id: sA.garcom.id, name: sA.garcom.name, n: sA.garcom.assist }}
            b={sB.garcom && { id: sB.garcom.id, name: sB.garcom.name, n: sB.garcom.assist }}
          />
        </div>
      )}

      <div className="panel">
        <div className="panel-head"><h3>Jogos de cada intervalo</h3></div>
        <div className="cmp-duo">
          <GamesCol it={anterior} />
          <GamesCol it={atual} />
        </div>
      </div>
    </>
  );
}
