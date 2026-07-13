import { useLayoutEffect, useRef, useState } from "react";

/* Gráfico de linha SVG, sem dependências — feito para os painéis de evolução.
   Uma métrica por eixo; tooltip ao passar o dedo/mouse; grid discreto. */

export interface ChartSeries {
  name: string;
  color: string;
  values: number[];
  /** preenche a área sob a linha (usar só na primeira série) */
  fill?: boolean;
}

export interface ChartTip {
  title: string;
  lines: string[];
}

/** Passos "redondos" para as linhas de grade. */
function gridValues(y0: number, y1: number): number[] {
  const span = y1 - y0;
  if (span <= 0) return [y0];
  const raw = span / 4;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 5, 10].map((s) => s * mag).find((s) => s >= raw) || raw;
  const vals: number[] = [];
  for (let v = Math.ceil(y0 / step) * step; v <= y1 + 1e-9; v += step) {
    vals.push(Math.round(v * 1000) / 1000);
  }
  return vals;
}

export function LineChart({
  series, tips, tickIdx, tickLabel, yDomain, yFmt, zeroLine, endLabels, height = 232,
}: {
  series: ChartSeries[];
  /** conteúdo do tooltip por índice (mesmo comprimento das séries) */
  tips: ChartTip[];
  /** índices que ganham rótulo no eixo x */
  tickIdx: number[];
  tickLabel: (i: number) => string;
  /** domínio fixo do eixo y (ex.: [0, 1] para percentuais) */
  yDomain?: [number, number];
  yFmt: (v: number) => string;
  /** destaca a linha do zero (para métricas que cruzam o zero) */
  zeroLine?: boolean;
  /** escreve o nome da série no fim da linha */
  endLabels?: boolean;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    setW(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const n = series[0]?.values.length || 0;
  if (!n) return null;

  const PAD_L = 48, PAD_R = endLabels ? 74 : 16, PAD_T = 14, PAD_B = 28;
  const iw = Math.max(10, w - PAD_L - PAD_R);
  const ih = height - PAD_T - PAD_B;

  const all = series.flatMap((s) => s.values);
  let y0: number, y1: number;
  if (yDomain) {
    [y0, y1] = yDomain;
  } else {
    y0 = Math.min(...all); y1 = Math.max(...all);
    if (zeroLine) { y0 = Math.min(0, y0); y1 = Math.max(0, y1); }
    const pad = Math.max(1, (y1 - y0) * 0.12);
    const floorZero = !zeroLine && Math.min(...all) >= 0;
    y0 -= y0 === 0 && zeroLine ? 0 : pad;
    if (floorZero) y0 = Math.max(0, y0);
    y1 += pad;
    if (y0 === y1) { y0 -= 1; y1 += 1; }
  }

  const X = (i: number) => PAD_L + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const Y = (v: number) => PAD_T + ih - ((v - y0) / (y1 - y0)) * ih;

  const grid = yDomain ? [0, 0.25, 0.5, 0.75, 1].map((f) => y0 + f * (y1 - y0)) : gridValues(y0, y1);
  const showDots = n <= 40;

  function locate(clientX: number) {
    const rect = wrapRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = clientX - rect.left;
    const i = Math.round(((px - PAD_L) / iw) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, i)));
  }

  const tip = hover != null ? tips[hover] : null;
  const tipX = hover != null ? Math.max(84, Math.min(w - 84, X(hover))) : 0;

  return (
    <div className="chart-wrap" ref={wrapRef} style={{ height }}>
      {w > 0 && (
        <svg
          width={w} height={height} style={{ display: "block", touchAction: "pan-y" }}
          onPointerMove={(e) => locate(e.clientX)}
          onPointerDown={(e) => locate(e.clientX)}
          onPointerLeave={() => setHover(null)}
        >
          {/* grade horizontal + rótulos do eixo y */}
          {grid.map((v) => (
            <g key={v}>
              <line
                x1={PAD_L} x2={w - PAD_R} y1={Y(v)} y2={Y(v)}
                stroke={zeroLine && Math.abs(v) < 1e-9 ? "rgba(15,32,25,.35)" : "rgba(15,32,25,.08)"}
                strokeDasharray={zeroLine && Math.abs(v) < 1e-9 ? "4 3" : undefined}
              />
              <text x={PAD_L - 8} y={Y(v) + 3.5} textAnchor="end" fontSize={11} fill="rgba(50,75,64,.8)">
                {yFmt(v)}
              </text>
            </g>
          ))}

          {/* rótulos do eixo x */}
          {tickIdx.map((i) => (
            <text key={i} x={X(i)} y={height - 8} textAnchor="middle" fontSize={11} fill="rgba(50,75,64,.8)">
              {tickLabel(i)}
            </text>
          ))}

          {/* área + linhas + pontos */}
          {series.map((s) => {
            const path = s.values.map((v, i) => `${i === 0 ? "M" : "L"}${X(i)},${Y(v)}`).join(" ");
            return (
              <g key={s.name}>
                {s.fill && n > 1 && (
                  <path
                    d={`${path} L${X(n - 1)},${Y(y0)} L${X(0)},${Y(y0)} Z`}
                    fill={s.color} opacity={0.09}
                  />
                )}
                <path d={path} fill="none" stroke={s.color} strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
                {showDots && s.values.map((v, i) => (
                  <circle key={i} cx={X(i)} cy={Y(v)} r={3} fill={s.color} stroke="#fbf7ec" strokeWidth={1.4} />
                ))}
                {endLabels && (
                  <text
                    x={X(n - 1) + 9} y={Y(s.values[n - 1]) + 3.5}
                    fontSize={11.5} fontWeight={700} fill={s.color}
                  >
                    {s.name}
                  </text>
                )}
              </g>
            );
          })}

          {/* guia + destaque do ponto sob o cursor */}
          {hover != null && (
            <g>
              <line x1={X(hover)} x2={X(hover)} y1={PAD_T} y2={PAD_T + ih} stroke="rgba(15,32,25,.25)" />
              {series.map((s) => (
                <circle
                  key={s.name} cx={X(hover)} cy={Y(s.values[hover])} r={5.5}
                  fill={s.color} stroke="#fbf7ec" strokeWidth={2}
                />
              ))}
            </g>
          )}
        </svg>
      )}

      {tip && (
        <div className="chart-tip" style={{ left: tipX, top: 2 }}>
          <b>{tip.title}</b>
          {tip.lines.map((l) => <span key={l}>{l}</span>)}
        </div>
      )}
    </div>
  );
}
