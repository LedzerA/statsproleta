// Gera src/dev/mock-data.json para o modo demo (npm run dev:mock).
// 1º tenta baixar os dados REAIS do Supabase (leitura é pública);
// se estiver sem internet, cai para o DATA_SEED do app antigo.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const cfg = readFileSync(new URL("../src/config.ts", import.meta.url), "utf8");
const URL_ = cfg.match(/SUPABASE_URL\s*=\s*"([^"]+)"/)[1];
const KEY = cfg.match(/SUPABASE_ANON_KEY\s*=\s*"([^"]+)"/)[1];

async function table(name, order) {
  const res = await fetch(`${URL_}/rest/v1/${name}?select=*&order=${order}`, {
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
  });
  if (!res.ok) throw new Error(`${name}: HTTP ${res.status}`);
  return res.json();
}

let data;
try {
  const [squads, athletes, matches, match_events] = await Promise.all([
    table("squads", "position"),
    table("athletes", "created_at"),
    table("matches", "date"),
    table("match_events", "created_at"),
  ]);
  data = { squads, athletes, matches, match_events };
  // Se o banco ainda não recebeu a atualização 1, simula o resultado dela
  // mesclando as tabelas *_v1 (elencos, titulares, posições, agendadas).
  if (!("starters" in (matches[0] || { starters: 1 }))) {
    try {
      const [av1, mv1] = await Promise.all([table("athletes_v1", "created_at"), table("matches_v1", "date")]);
      const aIdx = Object.fromEntries(av1.map((a) => [a.id, a]));
      const mIdx = Object.fromEntries(mv1.map((m) => [m.id, m]));
      for (const a of athletes) if (aIdx[a.id]?.squad) a.squad_id = aIdx[a.id].squad;
      for (const m of matches) {
        const v = mIdx[m.id];
        if (!v) continue;
        m.squad_id = v.squad ?? m.squad_id;
        m.starters = v.starters ?? [];
        m.positions = v.positions ?? {};
        m.venue = v.venue ?? null;
        m.kickoff = v.kickoff ?? null;
        m.kit = v.kit ?? null;
        m.archived = v.archived === true;
        m.clock = v.clock ?? null;
        if (v.status === "scheduled" && m.status === "encerrada") m.status = "agendada";
      }
      // agendadas do v1 que foram excluídas no v2 voltam (como na atualização 1)
      const haveIds = new Set(matches.map((m) => m.id));
      for (const v of mv1) {
        if (v.status !== "scheduled" || haveIds.has(v.id)) continue;
        matches.push({
          id: v.id, squad_id: v.squad ?? "esporte", date: v.date, opponent: v.opponent,
          status: "agendada", goals_for: 0, goals_against: 0,
          lineup: v.lineup ?? [], starters: v.starters ?? [], positions: v.positions ?? {},
          scorers: [], assists: [], lineup_complete: v.lineup_complete !== false,
          notes: v.notes ?? "", venue: v.venue ?? null, kickoff: v.kickoff ?? null,
          kit: v.kit ?? null, archived: false, clock: null, started_at: null,
        });
      }
      // converte lances antigos (events jsonb) como a atualização 1 faz no SQL
      const TYPE_MAP = {
        start: "inicio", goal: "gol_pro", ga: "gol_contra",
        ht: "fim_1t", st: "inicio_2t", end: "fim_jogo", sub: "sub",
      };
      const withEvents = new Set(match_events.map((e) => e.match_id));
      for (const v of mv1) {
        if (!Array.isArray(v.events) || !v.events.length || withEvents.has(v.id)) continue;
        v.events.forEach((e, i) => {
          const type = TYPE_MAP[e.type];
          if (!type) return;
          match_events.push({
            id: `${v.id}-lg-${i + 1}`,
            match_id: v.id,
            squad_id: v.squad ?? "esporte",
            type,
            minute: Math.floor((e.t ?? 0) / 60),
            athlete_id: e.a ?? e.in ?? null,
            assist_id: e.as ?? e.out ?? null,
            payload: { legacy: true, period: e.p ?? 1, seconds: e.t ?? 0 },
            created_at: `${v.date}T12:0${e.p ?? 1}:00Z`,
          });
        });
      }
      const known = new Set(squads.map((s) => s.id));
      const extra = [...new Set([...av1.map((a) => a.squad), ...mv1.map((m) => m.squad)])]
        .filter((s) => s && !known.has(s));
      extra.forEach((s, i) => squads.push({
        id: s, name: s[0].toUpperCase() + s.slice(1), position: squads.length + 1 + i,
      }));
      console.log("(simulando pós-atualização-1 com as tabelas *_v1)");
    } catch (e2) {
      console.warn("não consegui mesclar *_v1:", e2.message);
    }
  }
  console.log(`mock-data.json (banco real): ${athletes.length} atletas, ${matches.length} partidas, ${data.squads.length} elencos`);
} catch (e) {
  console.warn(`Sem acesso ao Supabase (${e.message}); usando DATA_SEED do app antigo.`);
  const html = readFileSync(new URL("../legacy/proleta-esporte.html", import.meta.url), "utf8");
  const m = html.match(/const DATA_SEED = (\{.*?\});\n/s);
  if (!m) throw new Error("DATA_SEED não encontrado");
  const seed = JSON.parse(m[1]);
  data = {
    squads: [{ id: "esporte", name: "Esporte", position: 1 }],
    athletes: seed.roster.map((a) => ({ id: a.id, squad_id: "esporte", name: a.name })),
    matches: seed.matches.map((mt) => ({
      id: mt.id, squad_id: "esporte", date: mt.date, opponent: mt.opponent,
      status: "encerrada", goals_for: mt.goalsFor || 0, goals_against: mt.goalsAgainst || 0,
      lineup: mt.lineup || [], scorers: mt.scorers || [], assists: mt.assists || [],
      lineup_complete: mt.lineupComplete !== false, notes: mt.notes || "", started_at: null,
    })),
    match_events: [],
  };
  console.log(`mock-data.json (seed antigo): ${data.athletes.length} atletas, ${data.matches.length} partidas`);
}

mkdirSync(new URL("../src/dev/", import.meta.url), { recursive: true });
writeFileSync(new URL("../src/dev/mock-data.json", import.meta.url), JSON.stringify(data, null, 1));
