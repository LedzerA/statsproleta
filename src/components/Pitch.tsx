import type { Formation } from "../lib/formations";

/* Campinho tático: campo em pé, atacando para cima. Cores fixas da identidade
   (gramado verde, marcações e nomes em creme) — legível nos dois temas. */

const LINHA = "rgba(247, 242, 224, .5)";

export function Pitch({ formation, slots, nameOf }: {
  formation: Formation;
  slots: (string | null)[];
  nameOf: (id: string) => string;
}) {
  const W = 100, H = 140, M = 2;
  const px = (x: number) => M + (x / 100) * (W - 2 * M);
  const py = (y: number) => H - M - (y / 100) * (H - 2 * M);
  const faixaH = (H - 2 * M) / 7;
  return (
    <svg className="pitch" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Formação ${formation.name}`}>
      <rect x={0} y={0} width={W} height={H} rx={3} fill="#1c5e34" />
      {[0, 2, 4, 6].map((i) => (
        <rect key={i} x={M} y={M + i * faixaH} width={W - 2 * M} height={faixaH} fill="rgba(255,255,255,.05)" />
      ))}
      <rect x={M} y={M} width={W - 2 * M} height={H - 2 * M} fill="none" stroke={LINHA} strokeWidth={0.7} />
      <line x1={M} y1={H / 2} x2={W - M} y2={H / 2} stroke={LINHA} strokeWidth={0.7} />
      <circle cx={W / 2} cy={H / 2} r={11} fill="none" stroke={LINHA} strokeWidth={0.7} />
      <rect x={W / 2 - 22} y={H - M - 19} width={44} height={19} fill="none" stroke={LINHA} strokeWidth={0.7} />
      <rect x={W / 2 - 11} y={H - M - 7} width={22} height={7} fill="none" stroke={LINHA} strokeWidth={0.7} />
      <rect x={W / 2 - 22} y={M} width={44} height={19} fill="none" stroke={LINHA} strokeWidth={0.7} />
      <rect x={W / 2 - 11} y={M} width={22} height={7} fill="none" stroke={LINHA} strokeWidth={0.7} />
      {formation.slots.map((s, i) => {
        const id = slots[i];
        const cx = px(s.x), cy = py(s.y);
        if (!id) {
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={4.8} fill="none" stroke={LINHA} strokeWidth={0.5} strokeDasharray="1.6 1.2" />
              <text x={cx} y={cy + 1.1} textAnchor="middle" fontSize={3} fontWeight={700} fill={LINHA}>{s.pos}</text>
            </g>
          );
        }
        const nome = nameOf(id).split(" ")[0];
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={4.8} fill="#f7f2e0" stroke="#0f2019" strokeWidth={0.5} />
            <text x={cx} y={cy + 1.1} textAnchor="middle" fontSize={3} fontWeight={700} fill="#14532d">{s.pos}</text>
            <text x={cx} y={cy + 8.8} textAnchor="middle" fontSize={3.8} fontWeight={600} fill="#f7f2e0">
              {nome.length > 10 ? nome.slice(0, 9) + "…" : nome}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
