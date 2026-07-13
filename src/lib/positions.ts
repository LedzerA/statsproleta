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
