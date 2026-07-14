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

export function getFormation(name?: string | null): Formation {
  return FORMATIONS.find((f) => f.name === name) || FORMATIONS[0];
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

/** Reorganiza os ocupantes de uma fase em outra formação (ou na mesma),
    casando cada um pela posição da vaga que ocupa hoje. Os ajustes finos de
    vaga (coords) só sobrevivem quando a formação não muda — em outra
    formação as vagas são outras. */
export function remapPhase(p: TacticsPhase, formationName: string): TacticsPhase {
  const from = getFormation(p.formation);
  const to = getFormation(formationName);
  const players: TaggedPlayer[] = [];
  p.slots.forEach((id, i) => { if (id) players.push({ id, pos: from.slots[i]?.pos }); });
  return {
    formation: to.name,
    slots: autoSlots(to, players),
    coords: to.name === from.name ? p.coords ?? null : null,
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
  return { formation: semF.name, slots, coords: sem.coords ?? null };
}
