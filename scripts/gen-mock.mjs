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
  console.log(`mock-data.json (banco real): ${athletes.length} atletas, ${matches.length} partidas`);
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
