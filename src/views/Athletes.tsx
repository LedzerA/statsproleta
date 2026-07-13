import { useMemo, useState } from "react";
import { useStore } from "../state/store";
import { navigate } from "../lib/router";
import { dec, pct } from "../lib/format";
import type { PlayerStats } from "../lib/stats";

const COLS: { k: keyof PlayerStats; l: string; t: "txt" | "n" | "d" | "p"; tip?: string }[] = [
  { k: "name", l: "Atleta", t: "txt" },
  { k: "jogos", l: "J", t: "n", tip: "Presenças (jogos relacionados)" },
  { k: "gols", l: "G", t: "n" },
  { k: "assist", l: "A", t: "n" },
  { k: "part", l: "Part.", t: "n" },
  { k: "ppj", l: "Part./J", t: "d" },
  { k: "gpj", l: "G/J", t: "d" },
  { k: "v", l: "V", t: "n" },
  { k: "e", l: "E", t: "n" },
  { k: "d", l: "D", t: "n" },
  { k: "aprov", l: "Aprov.", t: "p" },
  { k: "share", l: "% Gols", t: "p" },
];

export default function Athletes() {
  // stats já vêm filtradas pelo período global (chips no topo da página)
  const { stats, periodOn, isAdmin, addAthlete } = useStore();
  const [sortKey, setSortKey] = useState<keyof PlayerStats>("part");
  const [sortDir, setSortDir] = useState(-1);
  const [newName, setNewName] = useState("");
  const [minJogos, setMinJogos] = useState(0);
  const [minGols, setMinGols] = useState(0);

  const filtering = minJogos > 0 || minGols > 0;

  const list = useMemo(() => {
    const cp = stats.players.filter((p) => p.jogos >= minJogos && p.gols >= minGols);
    cp.sort((a, b) => {
      if (sortKey === "name") return sortDir * a.name.localeCompare(b.name, "pt");
      const va = a[sortKey] as number, vb = b[sortKey] as number;
      return va === vb ? a.name.localeCompare(b.name, "pt") : sortDir * (va - vb);
    });
    return cp;
  }, [stats.players, sortKey, sortDir, minJogos, minGols]);

  function clickSort(k: keyof PlayerStats) {
    if (sortKey === k) setSortDir((d) => -d);
    else { setSortKey(k); setSortDir(k === "name" ? 1 : -1); }
  }

  return (
    <>
      <div className="section-title">
        <h2>Classificação de atletas</h2>
        <span className="hint">
          {filtering
            ? `${list.length} de ${stats.players.length} atletas`
            : `${stats.totalJogadores} atletas com registro`}
          {periodOn && ` · ${stats.team.J} jogo${stats.team.J !== 1 ? "s" : ""} no período`}
        </span>
      </div>

      <div className="filter-bar">
        <label>Mín. jogos
          <input
            type="number" className="fb-num" min={0} placeholder="0"
            value={minJogos || ""}
            onChange={(e) => setMinJogos(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </label>
        <label>Mín. gols
          <input
            type="number" className="fb-num" min={0} placeholder="0"
            value={minGols || ""}
            onChange={(e) => setMinGols(Math.max(0, parseInt(e.target.value) || 0))}
          />
        </label>
        {periodOn && <span className="fb-note">estatísticas do período selecionado no topo</span>}
        {filtering && (
          <button
            className="linklike light"
            onClick={() => { setMinJogos(0); setMinGols(0); }}
          >
            Limpar
          </button>
        )}
      </div>

      {stats.partialLineups > 0 && (
        <div className="banner">
          <span className="ic">ⓘ</span>
          <div>
            <b>{stats.partialLineups} jogo{stats.partialLineups > 1 ? "s" : ""} sem escalação completa.</b>{" "}
            Nesses jogos a presença registra só quem fez gol ou assistência. Edite a partida e marque
            os relacionados + "escalação completa" para deixar as presenças exatas.
          </div>
        </div>
      )}

      <div className="panel">
        <div className="table-wrap">
          <table className="stats">
            <thead>
              <tr>
                {COLS.map((c) => (
                  <th key={c.k} title={c.tip || c.l} onClick={() => clickSort(c.k)}>
                    {c.l}
                    <span className="arw">{sortKey === c.k ? (sortDir < 0 ? " ▼" : " ▲") : ""}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((p, i) => (
                <tr key={p.id} className="row-link" onClick={() => navigate(`#/atleta/${p.id}`)}>
                  {COLS.map((c) => {
                    if (c.k === "name") {
                      return <td key={c.k} className="name"><span className="rk">{i + 1}</span>{p.name}</td>;
                    }
                    const v = p[c.k] as number;
                    const disp = c.t === "n" ? v : c.t === "d" ? (v ? dec(v) : "–") : p.jogos || c.k === "share" ? pct(v) : "–";
                    return <td key={c.k} className={v === 0 ? "cell-num muted" : "cell-num"}>{disp}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && (
        <div className="add-athlete" style={{ marginBottom: 18 }}>
          <input
            type="text" placeholder="+ Adicionar atleta ao elenco" value={newName} autoComplete="off"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { addAthlete(newName).then((a) => a && setNewName("")); } }}
          />
          <button className="btn sm" onClick={() => addAthlete(newName).then((a) => a && setNewName(""))}>
            Adicionar
          </button>
        </div>
      )}

      <div className="legend">
        <b>J</b> presenças · <b>G</b> gols · <b>A</b> assistências · <b>Part.</b> participações (G+A) ·{" "}
        <b>Part./J</b> e <b>G/J</b> médias por jogo · <b>V/E/D</b> resultados com o atleta em campo ·{" "}
        <b>Aprov.</b> aproveitamento do time quando ele joga · <b>% Gols</b> fatia dos gols do time.
        Toque no título da coluna para ordenar.
      </div>
    </>
  );
}
