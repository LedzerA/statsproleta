import { TEAM } from "../config";
import { fmtDate, pct, resWord, result } from "./format";
import { getFormation } from "./formations";
import { sortLineup } from "./positions";
import type { Match, TacticsPhase } from "./types";

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

/** Arte de convocação do próximo jogo: data, horário, local, uniforme,
    titulares (na ordem convencional das posições) e banco. */
export async function renderLineupArt(
  m: Match,
  nameOf: (id: string) => string,
  squadName: string | null
): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([
      document.fonts.load(zilla(700, 90), "0"),
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

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b4529");
  bg.addColorStop(1, "#062a1c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(242, 235, 214, .07)";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(W / 2, 620, 330, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, 620); ctx.lineTo(W, 620); ctx.stroke();

  /* escudo + cabeçalho */
  ctx.beginPath(); ctx.arc(W / 2, 148, 56, 0, Math.PI * 2);
  ctx.fillStyle = CREME; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = "#0b4529"; ctx.beginPath();
  ctx.arc(W / 2, 148, 47, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#0b4529";
  ctx.font = zilla(700, 44);
  ctx.fillText("PA", W / 2, 151);

  ctx.fillStyle = CREME_3;
  ctx.font = zilla(700, 46);
  ctx.fillText(TEAM.name.toUpperCase(), W / 2, 254);
  if (squadName) {
    ctx.fillStyle = VERDE_300;
    ctx.font = inter(600, 26);
    ctx.fillText(squadName.toUpperCase(), W / 2, 300);
  }

  /* selo */
  ctx.font = inter(700, 30);
  const word = "PRÓXIMO JOGO";
  const pw = ctx.measureText(word).width + 76;
  ctx.fillStyle = "#e6b94b";
  roundedRect(ctx, (W - pw) / 2, 344, pw, 62, 31);
  ctx.fill();
  ctx.fillStyle = "#3d2f05";
  ctx.fillText(word, W / 2, 377);

  /* confronto */
  const colL = W * 0.27, colR = W * 0.73, colW = W * 0.42;
  ctx.fillStyle = CREME_3;
  const sizeL = fitFont(ctx, TEAM.short.toUpperCase(), 62, colW, (px) => zilla(700, px));
  ctx.font = zilla(700, sizeL);
  ctx.fillText(TEAM.short.toUpperCase(), colL, 496);
  const opp = m.opponent.toUpperCase();
  const sizeR = fitFont(ctx, opp, 62, colW, (px) => zilla(700, px));
  ctx.font = zilla(700, sizeR);
  ctx.fillText(opp, colR, 496);
  ctx.fillStyle = "rgba(242, 235, 214, .55)";
  ctx.font = zilla(500, 56);
  ctx.fillText("×", W / 2, 494);

  /* data, hora, local, uniforme */
  let y = 578;
  const info = (txt: string) => {
    ctx.fillStyle = CREME;
    ctx.font = inter(600, 30);
    ctx.fillText(txt, W / 2, y);
    y += 48;
  };
  info(`📅 ${fmtDate(m.date)}${m.kickoff ? `   ·   🕒 ${m.kickoff}` : ""}`);
  if (m.venue) info(`📍 ${m.venue}`);
  if (m.kit) info(`👕 ${m.kit}`);
  y += 26;

  /* escalação */
  const starters = sortLineup(m.starters || [], m.positions, nameOf);
  const bench = sortLineup(
    (m.lineup || []).filter((id) => !(m.starters || []).includes(id)),
    m.positions, nameOf
  );

  const label = (txt: string) => {
    ctx.fillStyle = VERDE_300;
    ctx.font = inter(700, 25);
    ctx.fillText(txt, W / 2, y);
    y += 50;
  };

  if (starters.length > 0) {
    label(`★  TITULARES (${starters.length})`);
    const shown = starters.slice(0, 12);
    const rows = Math.ceil(shown.length / 2);
    const rowH = 46;
    const x1 = 150, x2 = W / 2 + 60;
    ctx.textAlign = "left";
    shown.forEach((id, i) => {
      const col = i < rows ? x1 : x2;
      const yy = y + (i % rows) * rowH;
      // posição composta ("LE/ZG") mostra só a primeira — cartaz limpo
      const p = (m.positions?.[id] || "").split("/")[0].trim().toUpperCase();
      if (p) {
        ctx.fillStyle = VERDE_300;
        ctx.font = inter(700, 21);
        ctx.fillText(p, col, yy);
      }
      ctx.fillStyle = CREME;
      ctx.font = zilla(600, 33);
      let name = nameOf(id);
      const maxW = W / 2 - 210;
      while (ctx.measureText(name).width > maxW && name.length > 3) name = name.slice(0, -2) + "…";
      ctx.fillText(name, col + 78, yy);
    });
    ctx.textAlign = "center";
    y += rows * rowH + 26;

    if (bench.length > 0) {
      label(`BANCO (${bench.length})`);
      ctx.fillStyle = "rgba(242, 235, 214, .85)";
      ctx.font = zilla(600, 29);
      for (const line of wrapText(ctx, bench.map(nameOf).join(", "), 900, 3)) {
        ctx.fillText(line, W / 2, y);
        y += 42;
      }
    }
  } else if ((m.lineup || []).length > 0) {
    label(`RELACIONADOS (${m.lineup.length})`);
    ctx.fillStyle = CREME;
    ctx.font = zilla(600, 31);
    const nomes = sortLineup(m.lineup, m.positions, nameOf).map(nameOf).join(", ");
    for (const line of wrapText(ctx, nomes, 900, 5)) {
      ctx.fillText(line, W / 2, y);
      y += 46;
    }
  } else {
    ctx.fillStyle = "rgba(242, 235, 214, .6)";
    ctx.font = inter(600, 27);
    ctx.fillText("Escalação a definir — bora, Proleta! 💪", W / 2, y + 20);
  }

  /* rodapé */
  ctx.fillStyle = "rgba(95, 212, 143, .8)";
  ctx.font = inter(600, 23);
  const site = `${location.host}${location.pathname}`.replace(/\/$/, "");
  ctx.fillText(`📊  acompanhe ao vivo:  ${site}`, W / 2, 1290);

  return canvas;
}

/** Arte do campinho tático de uma fase (com/sem bola): formação, jogadores
    nas vagas (com os ajustes arrastados no app) e o confronto no cabeçalho. */
export async function renderTacticsArt(
  m: Match,
  phaseKey: "com" | "sem",
  nameOf: (id: string) => string,
  squadName: string | null
): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([
      document.fonts.load(zilla(700, 46), "A"),
      document.fonts.load(zilla(600, 31), "A"),
      document.fonts.load(inter(700, 30), "A"),
      document.fonts.load(inter(600, 26), "A"),
    ]);
  } catch { /* segue com a fonte substituta */ }

  const phase: TacticsPhase = m.tactics![phaseKey];
  const f = getFormation(phase.formation);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b4529");
  bg.addColorStop(1, "#062a1c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  /* escudo + cabeçalho */
  ctx.beginPath(); ctx.arc(W / 2, 148, 56, 0, Math.PI * 2);
  ctx.fillStyle = CREME; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = "#0b4529"; ctx.beginPath();
  ctx.arc(W / 2, 148, 47, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#0b4529";
  ctx.font = zilla(700, 44);
  ctx.fillText("PA", W / 2, 151);

  ctx.fillStyle = CREME_3;
  ctx.font = zilla(700, 46);
  ctx.fillText(TEAM.name.toUpperCase(), W / 2, 254);
  ctx.fillStyle = VERDE_300;
  ctx.font = inter(600, 26);
  const meta = [squadName, fmtDate(m.date)].filter(Boolean).join("  ·  ");
  ctx.fillText(meta.toUpperCase(), W / 2, 300);

  /* selo da fase */
  ctx.font = inter(700, 30);
  const word = `${phaseKey === "com" ? "COM BOLA" : "SEM BOLA"}  ·  ${f.name}`;
  const pw = ctx.measureText(word).width + 76;
  ctx.fillStyle = phaseKey === "com" ? "#2fbf6b" : "#e6b94b";
  roundedRect(ctx, (W - pw) / 2, 344, pw, 62, 31);
  ctx.fill();
  ctx.fillStyle = phaseKey === "com" ? "#08240f" : "#3d2f05";
  ctx.fillText(word, W / 2, 377);

  /* confronto */
  ctx.fillStyle = CREME;
  const versus = `${TEAM.short.toUpperCase()}  ×  ${m.opponent.toUpperCase()}`;
  const vs = fitFont(ctx, versus, 40, 900, (px) => zilla(600, px));
  ctx.font = zilla(600, vs);
  ctx.fillText(versus, W / 2, 460);

  /* campo */
  const fh = 720, fw = 540;
  const fx = (W - fw) / 2, fy = 510;
  roundedRect(ctx, fx, fy, fw, fh, 20);
  ctx.fillStyle = "#1c5e34";
  ctx.fill();
  ctx.save();
  roundedRect(ctx, fx, fy, fw, fh, 20);
  ctx.clip();
  ctx.fillStyle = "rgba(255,255,255,.05)";
  for (const i of [0, 2, 4, 6]) ctx.fillRect(fx, fy + (i * fh) / 7, fw, fh / 7);
  ctx.restore();

  const pad = 14; // margem entre a moldura e as linhas do campo
  const ix = fx + pad, iy = fy + pad, iw = fw - 2 * pad, ih = fh - 2 * pad;
  ctx.strokeStyle = "rgba(242, 235, 214, .5)";
  ctx.lineWidth = 3;
  ctx.strokeRect(ix, iy, iw, ih);
  ctx.beginPath(); ctx.moveTo(ix, iy + ih / 2); ctx.lineTo(ix + iw, iy + ih / 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(ix + iw / 2, iy + ih / 2, iw * 0.16, 0, Math.PI * 2); ctx.stroke();
  /* áreas (mesmas proporções do campinho do app) */
  const gaW = iw * 0.458, gaH = ih * 0.14, pqW = iw * 0.229, pqH = ih * 0.051;
  ctx.strokeRect(ix + (iw - gaW) / 2, iy + ih - gaH, gaW, gaH);
  ctx.strokeRect(ix + (iw - pqW) / 2, iy + ih - pqH, pqW, pqH);
  ctx.strokeRect(ix + (iw - gaW) / 2, iy, gaW, gaH);
  ctx.strokeRect(ix + (iw - pqW) / 2, iy, pqW, pqH);

  /* jogadores */
  const px2 = (x: number) => ix + (x / 100) * iw;
  const py2 = (y: number) => iy + ih - (y / 100) * ih;
  f.slots.forEach((s, i) => {
    const id = phase.slots[i];
    const c = phase.coords?.[i];
    const cx = px2(c ? c[0] : s.x), cy = py2(c ? c[1] : s.y);
    if (!id) {
      ctx.strokeStyle = "rgba(242, 235, 214, .45)";
      ctx.lineWidth = 2.5;
      ctx.setLineDash([9, 7]);
      ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "rgba(242, 235, 214, .55)";
      ctx.font = inter(700, 18);
      ctx.fillText(s.pos, cx, cy + 1);
      return;
    }
    ctx.beginPath(); ctx.arc(cx, cy, 30, 0, Math.PI * 2);
    ctx.fillStyle = "#f7f2e0"; ctx.fill();
    ctx.lineWidth = 3; ctx.strokeStyle = "#0f2019"; ctx.stroke();
    ctx.fillStyle = "#14532d";
    ctx.font = inter(700, 18);
    ctx.fillText(s.pos, cx, cy + 1);
    let nome = nameOf(id).split(" ")[0];
    ctx.font = zilla(600, 28);
    while (ctx.measureText(nome).width > 150 && nome.length > 3) nome = nome.slice(0, -2) + "…";
    ctx.fillStyle = CREME_3;
    /* leve sombra para o nome não sumir na linha do campo */
    ctx.save();
    ctx.shadowColor = "rgba(6, 42, 28, .9)";
    ctx.shadowBlur = 8;
    ctx.fillText(nome, cx, cy + 52);
    ctx.restore();
  });

  /* rodapé */
  ctx.fillStyle = "rgba(95, 212, 143, .8)";
  ctx.font = inter(600, 23);
  const site = `${location.host}${location.pathname}`.replace(/\/$/, "");
  ctx.fillText(`📊  acompanhe ao vivo:  ${site}`, W / 2, 1290);

  return canvas;
}

export interface WrappedData {
  squadName: string | null;
  periodo: string; // ex.: "1º SEMESTRE DE 2026"
  J: number; V: number; E: number; D: number;
  GP: number; GC: number;
  aprov: number; // 0..1
  artilheiro: { name: string; n: number } | null;
  garcom: { name: string; n: number } | null;
  goleiro: { name: string; semSofrer: number; jogos: number } | null;
  goleada: { placar: string; opp: string } | null;
  invicto: number | null; // maior sequência sem perder no recorte
  hats: number;
}

/** Retrospectiva do semestre (1080×1350): números do time + destaques. */
export async function renderWrappedArt(w: WrappedData): Promise<HTMLCanvasElement> {
  try {
    await Promise.all([
      document.fonts.load(zilla(700, 150), "0"),
      document.fonts.load(zilla(600, 37), "A"),
      document.fonts.load(inter(700, 30), "A"),
      document.fonts.load(inter(600, 26), "A"),
    ]);
  } catch { /* segue com a fonte substituta */ }

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const bg = ctx.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, "#0b4529");
  bg.addColorStop(1, "#062a1c");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.strokeStyle = "rgba(242, 235, 214, .07)";
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(W / 2, 560, 330, 0, Math.PI * 2); ctx.stroke();

  /* escudo + cabeçalho */
  ctx.beginPath(); ctx.arc(W / 2, 148, 56, 0, Math.PI * 2);
  ctx.fillStyle = CREME; ctx.fill();
  ctx.lineWidth = 6; ctx.strokeStyle = "#0b4529"; ctx.beginPath();
  ctx.arc(W / 2, 148, 47, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = "#0b4529";
  ctx.font = zilla(700, 44);
  ctx.fillText("PA", W / 2, 151);

  ctx.fillStyle = CREME_3;
  ctx.font = zilla(700, 46);
  ctx.fillText(TEAM.name.toUpperCase(), W / 2, 254);
  if (w.squadName) {
    ctx.fillStyle = VERDE_300;
    ctx.font = inter(600, 26);
    ctx.fillText(w.squadName.toUpperCase(), W / 2, 300);
  }

  /* selo do período */
  ctx.font = inter(700, 30);
  const word = `RETROSPECTIVA  ·  ${w.periodo}`;
  const pw = ctx.measureText(word).width + 76;
  ctx.fillStyle = "#e6b94b";
  roundedRect(ctx, (W - pw) / 2, 344, pw, 62, 31);
  ctx.fill();
  ctx.fillStyle = "#3d2f05";
  ctx.fillText(word, W / 2, 377);

  /* aproveitamento gigante */
  ctx.fillStyle = CREME_3;
  ctx.font = zilla(700, 150);
  ctx.fillText(pct(w.aprov), W / 2, 540);
  ctx.fillStyle = VERDE_300;
  ctx.font = inter(700, 24);
  ctx.fillText("APROVEITAMENTO", W / 2, 632);

  ctx.fillStyle = CREME;
  ctx.font = inter(600, 30);
  ctx.fillText(`${w.J} jogos   ·   ${w.V}V  ${w.E}E  ${w.D}D`, W / 2, 700);
  ctx.fillText(`${w.GP} gols feitos   ×   ${w.GC} sofridos`, W / 2, 748);

  /* destaques */
  const rows: string[] = [];
  if (w.artilheiro) rows.push(`⚽  Artilheiro:  ${w.artilheiro.name} (${w.artilheiro.n} gols)`);
  if (w.garcom) rows.push(`🅰️  Garçom:  ${w.garcom.name} (${w.garcom.n} assistências)`);
  if (w.goleiro) rows.push(`🧤  Paredão:  ${w.goleiro.name} (${w.goleiro.semSofrer} jogo${w.goleiro.semSofrer !== 1 ? "s" : ""} sem sofrer)`);
  if (w.goleada) rows.push(`🔥  Maior goleada:  ${w.goleada.placar} vs ${w.goleada.opp}`);
  if (w.invicto && w.invicto > 1) rows.push(`🛡️  Invencibilidade:  ${w.invicto} jogos seguidos sem perder`);
  if (w.hats > 0) rows.push(`🎩  Hat-tricks no semestre:  ${w.hats}`);

  let y = rows.length >= 6 ? 828 : 850;
  const step = rows.length >= 6 ? 62 : 68;
  for (const linha of rows) {
    const size = fitFont(ctx, linha, 37, 940, (px) => zilla(600, px));
    ctx.font = zilla(600, size);
    ctx.fillStyle = CREME;
    ctx.fillText(linha, W / 2, y);
    y += step;
  }

  /* rodapé */
  ctx.fillStyle = "rgba(95, 212, 143, .8)";
  ctx.font = inter(600, 23);
  const site = `${location.host}${location.pathname}`.replace(/\/$/, "");
  ctx.fillText(`📊  estatísticas completas:  ${site}`, W / 2, 1290);

  return canvas;
}
