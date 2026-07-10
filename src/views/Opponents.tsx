import { useStore } from "../state/store";
import { pct } from "../lib/format";
import { EmptyState } from "../components/ui";

export default function Opponents() {
  const { stats } = useStore();
  if (stats.opponents.length === 0) {
    return <EmptyState title="Sem adversários" sub="Cadastre partidas para ver o retrospecto." />;
  }
  const list = [...stats.opponents].sort(
    (a, b) => b.J - a.J || b.aprov - a.aprov || a.opponent.localeCompare(b.opponent, "pt")
  );
  const repetidos = list.filter((o) => o.J > 1).length;

  return (
    <>
      <div className="section-title">
        <h2>Retrospecto por adversário</h2>
        <span className="hint">{list.length} adversários · {repetidos} enfrentados mais de uma vez</span>
      </div>
      <div className="panel">
        <div className="table-wrap">
          <table className="stats">
            <thead>
              <tr>
                <th>Adversário</th><th>J</th><th>V</th><th>E</th><th>D</th>
                <th>GP</th><th>GC</th><th>SG</th><th>Aprov.</th>
              </tr>
            </thead>
            <tbody>
              {list.map((o) => {
                const rl = o.aprov >= 0.6 ? "v" : o.aprov >= 0.34 ? "e" : "d";
                return (
                  <tr key={o.opponent}>
                    <td className="name">{o.opponent}</td>
                    <td className="cell-num">{o.J}</td>
                    <td className="cell-num">{o.V}</td>
                    <td className="cell-num">{o.E}</td>
                    <td className="cell-num">{o.D}</td>
                    <td className="cell-num">{o.GP}</td>
                    <td className="cell-num">{o.GC}</td>
                    <td className="cell-num" style={{ color: o.SG > 0 ? "#137a3c" : o.SG < 0 ? "#a83f30" : "inherit" }}>
                      {o.SG > 0 ? "+" : ""}{o.SG}
                    </td>
                    <td><span className={`pill ${rl}`}>{pct(o.aprov)}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
