import type { Match } from "./types";
import { result, sortMatches } from "./format";

/* Recordes históricos do elenco e marcos pessoais dos atletas.
   Sempre calculados sobre partidas encerradas e não arquivadas. */

export interface Streak {
  n: number;
  from: string;
  to: string;
}

/** Maiores sequências da história: só vitórias e invencibilidade (V/E). */
export function bestStreaks(matches: Match[]): { vitorias: Streak | null; invicto: Streak | null } {
  const done = sortMatches(matches.filter((m) => m.status === "encerrada" && !m.archived));
  let vitorias: Streak | null = null, invicto: Streak | null = null;
  let nV = 0, nI = 0, iniV = "", iniI = "";
  for (const m of done) {
    const r = result(m);
    if (r === "V") {
      if (!nV) iniV = m.date;
      nV++;
      if (!vitorias || nV > vitorias.n) vitorias = { n: nV, from: iniV, to: m.date };
    } else nV = 0;
    if (r !== "D") {
      if (!nI) iniI = m.date;
      nI++;
      if (!invicto || nI > invicto.n) invicto = { n: nI, from: iniI, to: m.date };
    } else nI = 0;
  }
  return { vitorias, invicto };
}

export interface HatTrick {
  m: Match;
  athleteId: string;
  gols: number;
}

/** Hat-tricks (3+ gols de um atleta na mesma partida), mais recente primeiro. */
export function hatTricks(matches: Match[]): HatTrick[] {
  const out: HatTrick[] = [];
  for (const m of matches) {
    if (m.status !== "encerrada" || m.archived) continue;
    for (const s of m.scorers || []) {
      if (s.g >= 3) out.push({ m, athleteId: s.a, gols: s.g });
    }
  }
  return out.sort((a, b) => (a.m.date < b.m.date ? 1 : a.m.date > b.m.date ? -1 : 0));
}

/* Marcos pessoais: faixas por categoria; mostra a maior atingida e a próxima. */
const FAIXAS: Record<string, number[]> = {
  jogos: [25, 50, 100, 150, 200, 250, 300],
  gols: [10, 25, 50, 75, 100, 150, 200],
  assistências: [10, 25, 50, 75, 100],
  "jogos no gol": [10, 25, 50, 100, 150, 200],
  "jogos sem sofrer": [5, 10, 25, 50, 75, 100],
};

export interface Marco {
  icon: string;
  tipo: string; // "jogos" | "gols" | "assistências"
  valor: number;
  atingido: number | null; // maior faixa já alcançada
  proximo: { alvo: number; falta: number } | null;
}

/** Marcos do atleta (carreira completa — não filtrar por período).
    Quem já jogou no gol ganha também os marcos de goleiro. */
export function athleteMarcos(tot: {
  jogos: number; gols: number; assist: number;
  gkJogos?: number; gkSemSofrer?: number;
}): Marco[] {
  const mk = (icon: string, tipo: keyof typeof FAIXAS, valor: number): Marco => {
    const faixas = FAIXAS[tipo];
    const feitas = faixas.filter((f) => valor >= f);
    const prox = faixas.find((f) => valor < f) ?? null;
    return {
      icon, tipo, valor,
      atingido: feitas.length ? feitas[feitas.length - 1] : null,
      proximo: prox ? { alvo: prox, falta: prox - valor } : null,
    };
  };
  const out = [
    mk("🏟️", "jogos", tot.jogos),
    mk("⚽", "gols", tot.gols),
    mk("🅰️", "assistências", tot.assist),
  ];
  if (tot.gkJogos) {
    out.push(mk("🧤", "jogos no gol", tot.gkJogos));
    out.push(mk("🔒", "jogos sem sofrer", tot.gkSemSofrer || 0));
  }
  return out;
}
