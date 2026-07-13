import { monthsAgoISO } from "./period";

/* Ordem convencional de escalação: goleiro → defesa (LD, ZG, LE) →
   meio-campo (VOL, MC, MEI) → ataque (PE, PD, SA, CA).
   Posições são texto livre gravado por partida; variações comuns são
   normalizadas, desconhecidas vão para o fim (ordem alfabética de nome). */
const RANK: Record<string, number> = {
  GOL: 0, GK: 0, GOLEIRO: 0,
  LD: 10, ZG: 11, ZAG: 11, ZAGUEIRO: 11, LE: 12,
  VOL: 20, VOLANTE: 20, MC: 21, MEI: 22, MEIA: 22,
  PE: 30, PD: 31, SA: 32, CA: 33, ATA: 34, ATACANTE: 34,
};

/** Posições canônicas, na ordem convencional. */
export const POSITIONS = ["GOL", "LD", "ZG", "LE", "VOL", "MC", "MEI", "PE", "PD", "SA", "CA"] as const;

export const POS_GROUPS: { label: string; positions: string[] }[] = [
  { label: "Goleiros", positions: ["GOL"] },
  { label: "Defesa", positions: ["LD", "ZG", "LE"] },
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
