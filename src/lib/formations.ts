import { posRank } from "./positions";
import type { TacticsPhase } from "./types";

/* Formações pré-definidas (11 vagas). Cada vaga tem o rótulo da posição e a
   coordenada no campinho: x 0→100 da esquerda para a direita, y 0→100 da nossa
   linha de fundo para o gol adversário. A ordem das vagas é a convencional
   (goleiro → defesa → meio → ataque) e é a ordem de exibição nas listas. */

export interface FormationSlot {
  pos: string;
  x: number;
  y: number;
}

export interface Formation {
  name: string;
  slots: FormationSlot[];
}

export interface TaggedPlayer {
  id: string;
  pos?: string;
}

const F = (name: string, slots: [string, number, number][]): Formation => ({
  name,
  slots: slots.map(([pos, x, y]) => ({ pos, x, y })),
});

export const FORMATIONS: Formation[] = [
  F("4-3-3", [
    ["GOL", 50, 6],
    ["LD", 84, 26], ["ZD", 62, 19], ["ZE", 38, 19], ["LE", 16, 26],
    ["VOL", 50, 42], ["MC", 32, 55], ["MEI", 68, 55],
    ["PE", 15, 76], ["PD", 85, 76], ["CA", 50, 86],
  ]),
  F("4-1-2-1-2", [
    ["GOL", 50, 6],
    ["LD", 84, 26], ["ZD", 62, 19], ["ZE", 38, 19], ["LE", 16, 26],
    ["VOL", 50, 38],
    ["MC", 30, 52], ["MC", 70, 52],
    ["MEI", 50, 66],
    ["SA", 40, 79], ["CA", 60, 87],
  ]),
  F("4-4-2", [
    ["GOL", 50, 6],
    ["LD", 84, 26], ["ZD", 62, 19], ["ZE", 38, 19], ["LE", 16, 26],
    ["VOL", 38, 47], ["MC", 62, 47], ["PE", 14, 56], ["PD", 86, 56],
    ["SA", 40, 77], ["CA", 60, 85],
  ]),
  F("4-2-3-1", [
    ["GOL", 50, 6],
    ["LD", 84, 26], ["ZD", 62, 19], ["ZE", 38, 19], ["LE", 16, 26],
    ["VOL", 38, 42], ["VOL", 62, 42],
    ["MEI", 50, 62], ["PE", 15, 66], ["PD", 85, 66],
    ["CA", 50, 86],
  ]),
  F("3-5-2", [
    ["GOL", 50, 6],
    ["ZD", 72, 19], ["ZC", 50, 16], ["ZE", 28, 19],
    ["LD", 88, 50], ["LE", 12, 50],
    ["VOL", 50, 40], ["MC", 64, 54], ["MEI", 36, 54],
    ["SA", 40, 77], ["CA", 60, 85],
  ]),
  F("3-4-3", [
    ["GOL", 50, 6],
    ["ZD", 72, 19], ["ZC", 50, 16], ["ZE", 28, 19],
    ["LD", 87, 52], ["LE", 13, 52], ["VOL", 38, 46], ["MC", 62, 46],
    ["PE", 17, 76], ["PD", 83, 76], ["CA", 50, 86],
  ]),
  F("5-3-2", [
    ["GOL", 50, 6],
    ["LD", 86, 32], ["ZD", 70, 18], ["ZC", 50, 15], ["ZE", 30, 18], ["LE", 14, 32],
    ["VOL", 50, 44], ["MC", 66, 56], ["MEI", 34, 56],
    ["SA", 40, 77], ["CA", 60, 85],
  ]),
];

/* ---- formação customizada ("4-2-2-2", "3-3-3-1"…): gerada na hora ----
   O nome É o dado salvo; o desenho (vagas, rótulos e pontos) é derivado dele
   aqui, então campinho, detalhe e artes funcionam sem persistir nada extra. */

/** Espalhamento horizontal de uma linha com k jogadores (esquerda → direita). */
const SPREAD: Record<number, number[]> = {
  1: [50], 2: [35, 65], 3: [25, 50, 75],
  4: [14, 38, 62, 86], 5: [10, 30, 50, 70, 90], 6: [8, 25, 42, 58, 75, 92],
};

/** Rótulos de uma linha (esquerda → direita), pela altura dela no campo. */
function rowLabels(r: number, n: number, k: number): string[] {
  if (r === 0) {
    return [
      ["ZC"], ["ZE", "ZD"], ["ZE", "ZC", "ZD"], ["LE", "ZE", "ZD", "LD"],
      ["LE", "ZE", "ZC", "ZD", "LD"], ["LE", "ZE", "ZC", "ZC", "ZD", "LD"],
    ][k - 1];
  }
  if (r === n - 1) {
    return [
      ["CA"], ["CA", "CA"], ["PE", "CA", "PD"], ["PE", "CA", "CA", "PD"],
      ["PE", "CA", "CA", "CA", "PD"], ["PE", "CA", "CA", "CA", "CA", "PD"],
    ][k - 1];
  }
  const meias = n - 2; // linhas de meio-campo
  const inner = meias === 1 ? "MC" : r === 1 ? "VOL" : r === n - 2 ? "MEI" : "MC";
  return Array.from({ length: k }, (_, j) =>
    k >= 4 && j === 0 ? "PE" : k >= 4 && j === k - 1 ? "PD" : inner);
}

/** Valida e normaliza uma formação digitada ("4 2 3 1" → "4-2-3-1").
    Regras: 2 a 5 linhas de 1 a 6 jogadores somando 10 (o goleiro é implícito).
    null quando não dá uma formação válida. */
export function parseCustomFormation(raw: string): string | null {
  const nums = raw.trim().split(/[^0-9]+/).filter(Boolean).map(Number);
  if (nums.length < 2 || nums.length > 5) return null;
  if (nums.some((n) => n < 1 || n > 6)) return null;
  if (nums.reduce((a, b) => a + b, 0) !== 10) return null;
  return nums.join("-");
}

const customCache = new Map<string, Formation>();

function buildFormation(name: string): Formation | null {
  const canon = parseCustomFormation(name);
  if (!canon || canon !== name) return null;
  const hit = customCache.get(name);
  if (hit) return hit;
  const rows = name.split("-").map(Number);
  const n = rows.length;
  const slots: FormationSlot[] = [{ pos: "GOL", x: 50, y: 6 }];
  rows.forEach((k, r) => {
    const y = Math.round(19 + (r * (86 - 19)) / (n - 1));
    const xs = SPREAD[k];
    const labels = rowLabels(r, n, k);
    // ordem convencional das listas: cada linha da direita para a esquerda
    for (let j = k - 1; j >= 0; j--) slots.push({ pos: labels[j], x: xs[j], y });
  });
  const f: Formation = { name, slots };
  customCache.set(name, f);
  return f;
}

export function getFormation(name?: string | null): Formation {
  const f = FORMATIONS.find((x) => x.name === name);
  if (f) return f;
  return (name && buildFormation(name)) || FORMATIONS[0];
}

/* apelidos comuns do histórico → rótulo canônico das vagas */
const ALIAS: Record<string, string> = {
  GK: "GOL", GOLEIRO: "GOL",
  ZAG: "ZG", ZAGUEIRO: "ZG",
  VOLANTE: "VOL", MEIA: "MEI",
  ATA: "CA", ATACANTE: "CA", PONTA: "PE",
};

export function canonPos(raw?: string | null): string {
  const k = (raw || "").split("/")[0].trim().toUpperCase();
  return ALIAS[k] || k;
}

/** Índice da melhor vaga LIVRE para uma posição: mesmo rótulo ganha; senão a
    vaga de rank mais próximo. -1 quando não há vaga livre. */
export function bestFreeSlot(f: Formation, slots: (string | null)[], pos?: string): number {
  const want = canonPos(pos);
  let best = -1, bd = Infinity;
  f.slots.forEach((s, i) => {
    if (slots[i]) return;
    const d = s.pos === want ? -1 : Math.abs(posRank(s.pos) - posRank(pos));
    if (d < bd) { bd = d; best = i; }
  });
  return best;
}

/** Distribui atletas nas vagas da formação casando as posições sugeridas;
    quem não casar exato entra na vaga livre de rank mais próximo. */
export function autoSlots(f: Formation, players: TaggedPlayer[]): (string | null)[] {
  const slots: (string | null)[] = f.slots.map(() => null);
  const fila = [...players].slice(0, f.slots.length)
    .sort((a, b) => posRank(a.pos) - posRank(b.pos));
  const sobras: TaggedPlayer[] = [];
  for (const p of fila) {
    const want = canonPos(p.pos);
    const i = f.slots.findIndex((s, idx) => !slots[idx] && s.pos === want);
    if (i >= 0) slots[i] = p.id; else sobras.push(p);
  }
  for (const p of sobras) {
    const i = bestFreeSlot(f, slots, p.pos);
    if (i >= 0) slots[i] = p.id;
  }
  return slots;
}

/** Formação cujas vagas melhor cobrem as posições dadas (partidas antigas
    sem tática salva entram no formulário já com um desenho plausível). */
export function inferFormation(poss: (string | undefined | null)[]): Formation {
  const want = poss.map(canonPos).filter(Boolean);
  let best = FORMATIONS[0], bs = -1;
  for (const f of FORMATIONS) {
    const avail = f.slots.map((s) => s.pos);
    let score = 0;
    for (const p of want) {
      const i = avail.indexOf(p);
      if (i >= 0) { avail.splice(i, 1); score++; }
    }
    if (score > bs) { bs = score; best = f; }
  }
  return best;
}

/** Leva uma fase para outra formação SEM reposicionar ninguém: cada jogador
    permanece na vaga de mesma ordem (vaga 1 → vaga 1, vaga 2 → vaga 2…) e os
    ajustes arrastados no campinho (coords) são preservados — só o desenho de
    fundo e os rótulos das vagas mudam. */
export function remapPhase(p: TacticsPhase, formationName: string): TacticsPhase {
  const to = getFormation(formationName);
  if (to.name === p.formation) {
    return { formation: to.name, slots: [...p.slots], coords: p.coords ?? null, roles: p.roles ?? null };
  }
  return {
    formation: to.name,
    slots: to.slots.map((_, i) => p.slots[i] ?? null),
    coords: p.coords ? to.slots.map((_, i) => p.coords![i] ?? null) : null,
    roles: p.roles ? to.slots.map((_, i) => p.roles![i] ?? null) : null,
  };
}

/** Mantém a fase sem bola com os MESMOS 11 da com bola: tira quem saiu do
    time e encaixa quem entrou na vaga livre mais próxima, preservando o que
    o usuário já arrumou manualmente. */
export function reconcileSem(sem: TacticsPhase, com: TacticsPhase): TacticsPhase {
  const comF = getFormation(com.formation);
  const semF = getFormation(sem.formation);
  const eleven = com.slots.filter((x): x is string => !!x);
  const slots = semF.slots.map((_, i) => {
    const id = sem.slots[i];
    return id && eleven.includes(id) ? id : null;
  });
  for (const id of eleven) {
    if (slots.includes(id)) continue;
    const pos = comF.slots[com.slots.indexOf(id)]?.pos;
    const i = bestFreeSlot(semF, slots, pos);
    if (i >= 0) slots[i] = id;
  }
  return { formation: semF.name, slots, coords: sem.coords ?? null, roles: sem.roles ?? null };
}
