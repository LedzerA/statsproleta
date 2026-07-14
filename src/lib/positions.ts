import { monthsAgoISO } from "./period";

/* Ordem convencional de escalação: goleiro → defesa (lado direito → centro →
   lado esquerdo: LD, ALD, ZD, ZC, ZG, ZE, ALE, LE) → meio-campo (VOL, MC,
   MEI) → ataque (PE, PD, SA, CA).
   Posições são texto livre gravado por partida; variações comuns são
   normalizadas, desconhecidas vão para o fim (ordem alfabética de nome). */
const RANK: Record<string, number> = {
  GOL: 0, GK: 0, GOLEIRO: 0,
  LD: 10, ALD: 11, ZD: 12, ZC: 13, ZG: 14, ZAG: 14, ZAGUEIRO: 14, ZE: 15, ALE: 16, LE: 17,
  VOL: 20, VOLANTE: 20, MC: 21, MEI: 22, MEIA: 22,
  PE: 30, PD: 31, SA: 32, CA: 33, ATA: 34, ATACANTE: 34,
};

/** Posições canônicas, na ordem convencional. */
export const POSITIONS = [
  "GOL", "LD", "ALD", "ZD", "ZC", "ZG", "ZE", "ALE", "LE",
  "VOL", "MC", "MEI", "PE", "PD", "SA", "CA",
] as const;

export const POS_GROUPS: { label: string; positions: string[] }[] = [
  { label: "Goleiros", positions: ["GOL"] },
  { label: "Defesa", positions: ["LD", "ALD", "ZD", "ZC", "ZG", "ZE", "ALE", "LE"] },
  { label: "Meio-campo", positions: ["VOL", "MC", "MEI"] },
  { label: "Ataque", positions: ["PE", "PD", "SA", "CA"] },
];

/** Posições já usadas pelo atleta nas partidas (normalizadas, ordem convencional). */
export function derivedPositions(athleteId: string, matches: { positions?: Record<string, string> }[]): string[] {
  const set = new Set<string>();
  for (const m of matches) {
    const raw = m.positions?.[athleteId];
    if (!raw) continue;
    for (const part of raw.split("/")) {
      const p = part.trim().toUpperCase();
      if (p) set.add(p);
    }
  }
  return [...set].sort((a, b) => posRank(a) - posRank(b));
}

/** Posições exibidas do atleta: onde ele atuou nos ÚLTIMOS 3 MESES
    (posição antiga expira sozinha) + as curadas pelo admin no perfil.
    Sem nada recente nem curado, cai no histórico completo. */
export function athletePositions(
  a: { id: string; positions?: string[] },
  matches: { date?: string; positions?: Record<string, string> }[]
): string[] {
  const since = monthsAgoISO(3);
  const recentes = derivedPositions(a.id, matches.filter((m) => (m.date || "") >= since));
  const merged = [...new Set([...(a.positions || []), ...recentes])]
    .sort((x, y) => posRank(x) - posRank(y));
  if (merged.length) return merged;
  return derivedPositions(a.id, matches);
}

/** Última posição registrada do atleta em partida: a mais recente até a data
    de referência (exclusive a própria partida). Sem nada antes, usa a primeira
    registrada depois — útil para completar partidas antigas de trás pra frente. */
export function lastPosition(
  athleteId: string,
  matches: { id?: string; date?: string; positions?: Record<string, string> }[],
  ref?: { id?: string; date?: string }
): string | undefined {
  const played = matches
    .filter((m) => m.id !== ref?.id && m.positions?.[athleteId])
    .sort((a, b) => (a.date || "").localeCompare(b.date || ""));
  if (!played.length) return undefined;
  const antes = ref?.date ? played.filter((m) => (m.date || "") <= ref.date!) : played;
  const m = antes.length ? antes[antes.length - 1] : played[0];
  return m.positions![athleteId];
}

export function posRank(pos: string | null | undefined): number {
  if (!pos) return 99;
  // posição composta ("LE/ZG", "MEI/MC") conta pela primeira
  const key = pos.split("/")[0].trim().toUpperCase();
  return RANK[key] ?? 98;
}

/** Ordena ids de atletas pela convenção de posições da partida. */
export function sortLineup(
  ids: string[],
  positions: Record<string, string> | undefined,
  nameOf: (id: string) => string
): string[] {
  return [...ids].sort((a, b) =>
    posRank(positions?.[a]) - posRank(positions?.[b]) ||
    nameOf(a).localeCompare(nameOf(b), "pt")
  );
}
