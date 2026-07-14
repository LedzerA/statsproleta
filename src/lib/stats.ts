import type { Athlete, Match, Result } from "./types";
import { canonPos } from "./formations";
import { result, pts, sortMatches } from "./format";

export interface PlayerStats {
  id: string;
  name: string;
  jogos: number;
  gols: number;
  assist: number;
  part: number;
  ppj: number;
  gpj: number;
  v: number;
  e: number;
  d: number;
  aprov: number;
  share: number;
}

export interface OpponentStats {
  opponent: string;
  J: number;
  V: number;
  E: number;
  D: number;
  GP: number;
  GC: number;
  SG: number;
  aprov: number;
  last: string;
}

export interface TeamStats {
  J: number;
  V: number;
  E: number;
  D: number;
  GP: number;
  GC: number;
  SG: number;
  pts: number;
  aprov: number;
  mgp: number;
  mgc: number;
  form: Result[];
  streak: { r: Result; n: number } | null;
  maiorGoleada: { m: Match; diff: number } | null;
  piorDerrota: { m: Match; diff: number } | null;
}

export interface GkStats {
  id: string;
  name: string;
  jogos: number; // partidas como goleiro
  sofridos: number;
  media: number; // gols sofridos por jogo
  semSofrer: number; // jogos sem levar gol
  v: number;
  e: number;
  d: number;
}

export interface SquadStats {
  team: TeamStats;
  players: PlayerStats[];
  opponents: OpponentStats[];
  goalkeepers: GkStats[];
  artilheiro: PlayerStats | null;
  garcom: PlayerStats | null;
  partialLineups: number;
  totalJogadores: number;
}

/** Goleiro(s) da partida: titulares com posição GOL; sem titulares
    registrados, cai para os relacionados com posição GOL. */
export function matchGoalkeepers(m: Match): string[] {
  const pos = m.positions || {};
  const isGk = (id: string) => canonPos(pos[id]) === "GOL";
  const titulares = (m.starters || []).filter(isGk);
  if ((m.starters || []).length) return titulares;
  return (m.lineup || []).filter(isGk);
}

/** Estatísticas de goleiro derivadas das posições salvas por partida. */
export function computeGk(roster: Athlete[], allMatches: Match[]): GkStats[] {
  const done = allMatches.filter((m) => m.status === "encerrada" && !m.archived);
  const nomes = new Map(roster.map((a) => [a.id, a.name]));
  const map = new Map<string, GkStats>();
  for (const m of done) {
    for (const id of matchGoalkeepers(m)) {
      if (!nomes.has(id)) continue;
      const g = map.get(id) || {
        id, name: nomes.get(id)!, jogos: 0, sofridos: 0, media: 0, semSofrer: 0, v: 0, e: 0, d: 0,
      };
      g.jogos++;
      g.sofridos += m.goals_against;
      if (m.goals_against === 0) g.semSofrer++;
      const r = result(m);
      if (r === "V") g.v++; else if (r === "E") g.e++; else g.d++;
      map.set(id, g);
    }
  }
  return [...map.values()]
    .map((g) => ({ ...g, media: g.jogos ? g.sofridos / g.jogos : 0 }))
    .sort((a, b) => b.jogos - a.jogos || a.media - b.media);
}

/** Estatísticas do elenco a partir das partidas ENCERRADAS (não arquivadas). */
export function compute(roster: Athlete[], allMatches: Match[]): SquadStats {
  const matches = allMatches.filter((m) => m.status === "encerrada" && !m.archived);
  const players: PlayerStats[] = roster.map((a) => ({
    id: a.id, name: a.name,
    jogos: 0, gols: 0, assist: 0, part: 0, ppj: 0, gpj: 0,
    v: 0, e: 0, d: 0, aprov: 0, share: 0,
  }));
  const pIdx = Object.fromEntries(players.map((p) => [p.id, p]));
  const opps: Record<string, OpponentStats> = {};
  let J = 0, V = 0, E = 0, D = 0, GP = 0, GC = 0;
  const sorted = sortMatches(matches);

  for (const m of sorted) {
    J++; GP += m.goals_for; GC += m.goals_against;
    const r = result(m), p = pts(m);
    if (r === "V") V++; else if (r === "E") E++; else D++;
    const o = opps[m.opponent] ||
      (opps[m.opponent] = { opponent: m.opponent, J: 0, V: 0, E: 0, D: 0, GP: 0, GC: 0, SG: 0, aprov: 0, last: m.date });
    o.J++; o.GP += m.goals_for; o.GC += m.goals_against; o[r]++;
    if (m.date > o.last) o.last = m.date;
    for (const id of m.lineup || []) {
      const pl = pIdx[id]; if (!pl) continue;
      pl.jogos++;
      if (r === "V") pl.v++; else if (r === "E") pl.e++; else pl.d++;
      (pl as any)._pts = ((pl as any)._pts || 0) + p;
    }
    for (const s of m.scorers || []) { const pl = pIdx[s.a]; if (pl) pl.gols += s.g; }
    for (const s of m.assists || []) { const pl = pIdx[s.a]; if (pl) pl.assist += s.n; }
  }

  players.forEach((p) => {
    p.part = p.gols + p.assist;
    p.ppj = p.jogos ? p.part / p.jogos : 0;
    p.gpj = p.jogos ? p.gols / p.jogos : 0;
    p.aprov = p.jogos ? ((p as any)._pts || 0) / (p.jogos * 3) : 0;
    p.share = GP ? p.gols / GP : 0;
    delete (p as any)._pts;
  });

  const team: TeamStats = {
    J, V, E, D, GP, GC, SG: GP - GC,
    pts: V * 3 + E,
    aprov: J ? (V * 3 + E) / (J * 3) : 0,
    mgp: J ? GP / J : 0,
    mgc: J ? GC / J : 0,
    form: [], streak: null, maiorGoleada: null, piorDerrota: null,
  };
  const results = sorted.map(result);
  team.form = results.slice(-5);
  if (results.length) {
    const last = results[results.length - 1];
    let st = 0;
    for (let i = results.length - 1; i >= 0 && results[i] === last; i--) st++;
    team.streak = { r: last, n: st };
  }
  for (const m of sorted) {
    const diff = m.goals_for - m.goals_against;
    if (result(m) === "V" && (!team.maiorGoleada || diff > team.maiorGoleada.diff)) team.maiorGoleada = { m, diff };
    if (result(m) === "D" && (!team.piorDerrota || diff < team.piorDerrota.diff)) team.piorDerrota = { m, diff };
  }

  const opponents = Object.values(opps).map((o) => ({
    ...o, SG: o.GP - o.GC, aprov: o.J ? (o.V * 3 + o.E) / (o.J * 3) : 0,
  }));
  const withGols = players.filter((p) => p.gols > 0);
  const withAss = players.filter((p) => p.assist > 0);
  const artilheiro = withGols.length
    ? [...withGols].sort((a, b) => b.gols - a.gols || b.part - a.part)[0] : null;
  const garcom = withAss.length
    ? [...withAss].sort((a, b) => b.assist - a.assist || b.part - a.part)[0] : null;
  const partialLineups = matches.filter((m) => m.lineup_complete === false).length;

  return {
    team, players, opponents, artilheiro, garcom, partialLineups,
    goalkeepers: computeGk(roster, matches),
    totalJogadores: players.filter((p) => p.jogos > 0 || p.gols > 0 || p.assist > 0).length,
  };
}
