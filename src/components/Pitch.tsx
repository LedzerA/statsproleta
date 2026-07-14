import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { Formation } from "../lib/formations";

/* Campinho tático: campo em pé, atacando para cima. Cores fixas da identidade
   (gramado verde, marcações e nomes em creme) — legível nos dois temas.
   Com onMove, os jogadores podem ser arrastados (mouse ou dedo) para ajustar
   o posicionamento da vaga sem mudar formação nem posição. */

const LINHA = "rgba(247, 242, 224, .5)";
const W = 100, H = 140, M = 2;

export function Pitch({ formation, slots, nameOf, coords, labels, onMove }: {
  formation: Formation;
  slots: (string | null)[];
  nameOf: (id: string) => string;
  /** ajuste fino por vaga ([x,y] em % do campo); null = padrão da formação */
  coords?: ([number, number] | null)[] | null;
  /** rótulo de posição por vaga (ajuste pontual); null = rótulo da formação */
  labels?: (string | null)[] | null;
  /** presente = arrastável; recebe a vaga e a nova coordenada em % do campo */
  onMove?: (slot: number, x: number, y: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const draggable = !!onMove;

  /* No celular o navegador transforma o gesto em rolagem da página e cancela
     o arrasto (iOS ignora touch-action em elemento interno de SVG). Um
     listener touchmove NÃO-passivo bloqueia a rolagem apenas enquanto um
     jogador está seguro — tocar na grama continua rolando a página. */
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !draggable) return;
    const block = (e: TouchEvent) => {
      if (dragRef.current != null) e.preventDefault();
    };
    svg.addEventListener("touchmove", block, { passive: false });
    return () => svg.removeEventListener("touchmove", block);
  }, [draggable]);

  const px = (x: number) => M + (x / 100) * (W - 2 * M);
  const py = (y: number) => H - M - (y / 100) * (H - 2 * M);
  const faixaH = (H - 2 * M) / 7;

  function toField(e: ReactPointerEvent): { x: number; y: number } {
    const r = svgRef.current!.getBoundingClientRect();
    const vx = ((e.clientX - r.left) / r.width) * W;
    const vy = ((e.clientY - r.top) / r.height) * H;
    const x = ((vx - M) / (W - 2 * M)) * 100;
    const y = ((H - M - vy) / (H - 2 * M)) * 100;
    return {
      x: Math.min(97, Math.max(3, Math.round(x * 10) / 10)),
      y: Math.min(97, Math.max(1.5, Math.round(y * 10) / 10)),
    };
  }

  function grab(i: number, e: ReactPointerEvent) {
    if (!onMove || !slots[i]) return;
    e.preventDefault();
    dragRef.current = i;
    setDragIdx(i);
    svgRef.current?.setPointerCapture(e.pointerId);
  }

  function move(e: ReactPointerEvent) {
    if (dragRef.current == null || !onMove) return;
    e.preventDefault();
    const { x, y } = toField(e);
    onMove(dragRef.current, x, y);
  }

  const drop = () => { dragRef.current = null; setDragIdx(null); };

  return (
    <svg
      ref={svgRef}
      className="pitch"
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`Formação ${formation.name}`}
      onPointerMove={draggable ? move : undefined}
      onPointerUp={draggable ? drop : undefined}
      onPointerCancel={draggable ? drop : undefined}
    >
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
        const c = coords?.[i];
        const cx = px(c ? c[0] : s.x), cy = py(c ? c[1] : s.y);
        if (!id) {
          return (
            <g key={i}>
              <circle cx={cx} cy={cy} r={4.8} fill="none" stroke={LINHA} strokeWidth={0.5} strokeDasharray="1.6 1.2" />
              <text x={cx} y={cy + 1.1} textAnchor="middle" fontSize={3} fontWeight={700} fill={LINHA}>{s.pos}</text>
            </g>
          );
        }
        const nome = nameOf(id).split(" ")[0];
        // rótulo pontual da vaga; posição composta ("LE/ZG") mostra a primeira
        const pos = (labels?.[i] || s.pos).split("/")[0].trim().toUpperCase();
        const ativo = dragIdx === i;
        return (
          <g
            key={i}
            onPointerDown={draggable ? (e) => grab(i, e) : undefined}
            style={draggable ? { touchAction: "none", cursor: ativo ? "grabbing" : "grab" } : undefined}
          >
            {/* alvo de toque generoso para o dedo — invisível */}
            {draggable && <circle cx={cx} cy={cy} r={10} fill="transparent" stroke="none" />}
            <circle
              cx={cx} cy={cy} r={ativo ? 5.6 : 4.8}
              fill="#f7f2e0" stroke="#0f2019" strokeWidth={ativo ? 0.8 : 0.5}
            />
            <text x={cx} y={cy + 1.1} textAnchor="middle" fontSize={3} fontWeight={700} fill="#14532d">{pos}</text>
            <text x={cx} y={cy + (ativo ? 9.6 : 8.8)} textAnchor="middle" fontSize={3.8} fontWeight={600} fill="#f7f2e0">
              {nome.length > 10 ? nome.slice(0, 9) + "…" : nome}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
