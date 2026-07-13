import { TEAM } from "../config";
import { fmtDate, resWord, result } from "./format";
import type { Match } from "./types";

/* Gera a arte do resultado (1080×1350, formato de post) no navegador.
   Usa as mesmas fontes e cores do app; nada sai do aparelho. */

const W = 1080;
const H = 1350;
const CREME = "#f2ebd6";
const CREME_3 = "#fffdf6";
const VERDE_300 = "#5fd48f";
const RES_COLORS: Record<string, { bg: string; fg: string; word: string }> = {
  V: { bg: "#2fbf6b", fg: "#08240f", word: "VITÓRIA DO PROLETA" },
  E: { bg: "#e6b94b", fg: "#3d2f05", word: "EMPATE" },
  D: { bg: "#e0705f", fg: "#3d0f08", word: "DERROTA" },
};

function roundedRect(
  ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function zilla(weight: number, px: number): string {
  return `${weight} ${px}px "Zilla Slab", Georgia, serif`;
}
function inter(weight: number, px: number): string {
  return `${weight} ${px}px "Inter", system-ui, sans-serif`;
}

/** Reduz o tamanho da fonte até o texto caber em maxWidth. */
function fitFont(
  ctx: CanvasRenderingContext2D, text: string, px: number, maxWidth: number,
  font: (px: number) => string
): number {
  let size = px;
  ctx.font = font(size);
  while (size > 22 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = font(size);
  }
  return size;
}

/** Quebra o texto em linhas de até maxWidth (com limite de linhas + reticências). */
function wrapText(
  ctx: CanvasRenderingContext2D, text: string, maxWidth: number, maxLines: number
): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    const probe = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(probe).width <= maxWidth || !cur) {
      cur = probe;
    } else {
      lines.push(cur);
      cur = w;
      if (lines.length === maxLines) break;
    }
  }
  if (lines.length < maxLines && cur) lines.push(cur);
  else if (cur && lines.length === maxLines) {
    let last = lines[maxLines - 1] + "…";
    while (ctx.measureText(last).width > maxWidth && last.length > 2) {
      last = last.slice(0, -2) + "…";
    }
    lines[maxLines - 1] = last;
  }
  return lines;
}

export async function renderResultArt(
  m: Match,
  nameOf: (id: string) => string,
  squadName: string | null
): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([
      document.fonts.load(zilla(700, 200), "0"),
      document.fonts.load(zilla(600, 60), "A"),
      document.fonts.load(inter(600, 40), "A"),
      document.fonts.load(inter(700, 40), "A"),
    ]);
  } catch { /* segue com a fonte substituta */ }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  /* fundo + campo estilizado */
  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b4529");
  bg.addColorStop(1, "#062a1c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(242, 235, 214, .07)";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(W / 2, 660, 330, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 660); ctx.lineTo(W, 660); ctx.stroke();
  ctx.beginPath(); ctx.arc(W / 2, 660, 8, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(242, 235, 214, .12)"; ctx.fill();

  /* escudo */
  ctx.beginPath(); ctx.arc(W / 2, 148, 56, 0, Math.PI * 2);
  ctx.fillStyle = CREME; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = "#0b4529"; ctx.beginPath();
  ctx.arc(W / 2, 148, 47, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#0b4529";
  ctx.font = zilla(700, 44);
  ctx.fillText("PA", W / 2, 151);

  /* cabeçalho */
  ctx.fillStyle = CREME_3;
  ctx.font = zilla(700, 46);
  ctx.fillText(TEAM.name.toUpperCase(), W / 2, 254);
  ctx.fillStyle = VERDE_300;
  ctx.font = inter(600, 26);
  const meta = [squadName, fmtDate(m.date)].filter(Boolean).join("  ·  ");
  ctx.fillText(meta.toUpperCase(), W / 2, 300);

  /* selo do resultado */
  const r = result(m);
  const rc = RES_COLORS[r] || RES_COLORS.E;
  ctx.font = inter(700, 30);
  const word = r === "V" ? rc.word : `${resWord(r).toUpperCase()}`;
  const pw = ctx.measureText(word).width + 76;
  ctx.fillStyle = rc.bg;
  roundedRect(ctx, (W - pw) / 2, 352, pw, 62, 31);
  ctx.fill();
  ctx.fillStyle = rc.fg;
  ctx.fillText(word, W / 2, 385);

  /* nomes dos times */
  const colL = W * 0.27, colR = W * 0.73, colW = W * 0.42;
  ctx.fillStyle = CREME;
  const sizeL = fitFont(ctx, TEAM.short.toUpperCase(), 54, colW, (px) => zilla(600, px));
  ctx.font = zilla(600, sizeL);
  ctx.fillText(TEAM.short.toUpperCase(), colL, 505);
  const opp = m.opponent.toUpperCase();
  const sizeR = fitFont(ctx, opp, 54, colW, (px) => zilla(600, px));
  ctx.font = zilla(600, sizeR);
  ctx.fillText(opp, colR, 505);

  /* placar gigante */
  ctx.fillStyle = CREME_3;
  ctx.font = zilla(700, 210);
  ctx.fillText(String(m.goals_for), colL, 665);
  ctx.fillText(String(m.goals_against), colR, 665);
  ctx.fillStyle = "rgba(242, 235, 214, .55)";
  ctx.font = zilla(500, 90);
  ctx.fillText("×", W / 2, 660);

  /* gols e assistências */
  let y = 850;
  const scorers = (m.scorers || []).slice().sort((a, b) => b.g - a.g)
    .map((x) => `${nameOf(x.a)}${x.g > 1 ? ` (${x.g})` : ""}`).join(", ");
  const assists = (m.assists || []).slice().sort((a, b) => b.n - a.n)
    .map((x) => `${nameOf(x.a)}${x.n > 1 ? ` (${x.n})` : ""}`).join(", ");

  const block = (label: string, text: string) => {
    ctx.fillStyle = VERDE_300;
    ctx.font = inter(700, 25);
    ctx.fillText(label, W / 2, y);
    y += 46;
    ctx.fillStyle = CREME;
    ctx.font = zilla(600, 37);
    for (const line of wrapText(ctx, text, 900, 2)) {
      ctx.fillText(line, W / 2, y);
      y += 50;
    }
    y += 28;
  };
  if (scorers) block("⚽  GOLS DO PROLETA", scorers);
  if (assists) block("🅰️  ASSISTÊNCIAS", assists);
  if (!scorers && !assists) y += 30;

  /* local e horário */
  const bits = [m.venue && `📍 ${m.venue}`, m.kickoff && `🕒 ${m.kickoff}`]
    .filter(Boolean).join("   ·   ");
  if (bits) {
    ctx.fillStyle = "rgba(242, 235, 214, .75)";
    ctx.font = inter(500, 27);
    ctx.fillText(bits, W / 2, Math.max(y, 1150));
  }

  /* rodapé */
  ctx.fillStyle = "rgba(95, 212, 143, .8)";
  ctx.font = inter(600, 23);
  const site = `${location.host}${location.pathname}`.replace(/\/$/, "");
  ctx.fillText(`📊  estatísticas e jogos ao vivo:  ${site}`, W / 2, 1290);

  return canvas;
}
