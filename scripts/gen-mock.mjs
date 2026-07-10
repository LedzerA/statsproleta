// Gera src/dev/mock-data.json (formato v2) a partir do DATA_SEED do app
// antigo — usado pelo modo mock de desenvolvimento (npm run dev:mock).
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const html = readFileSync(new URL("../legacy/proleta-esporte.html", import.meta.url), "utf8");
const m = html.match(/const DATA_SEED = (\{.*?\});\n/s);
if (!m) throw new Error("DATA_SEED não encontrado");
const seed = JSON.parse(m[1]);

const data = {
  squads: [{ id: "esporte", name: "Esporte", position: 1 }],
  athletes: seed.roster.map((a) => ({ id: a.id, squad_id: "esporte", name: a.name })),
  matches: seed.matches.map((mt) => ({
    id: mt.id,
    squad_id: "esporte",
    date: mt.date,
    opponent: mt.opponent,
    status: "encerrada",
    goals_for: mt.goalsFor || 0,
    goals_against: mt.goalsAgainst || 0,
    lineup: mt.lineup || [],
    scorers: mt.scorers || [],
    assists: mt.assists || [],
    lineup_complete: mt.lineupComplete !== false,
    notes: mt.notes || "",
    started_at: null,
  })),
  match_events: [],
};

mkdirSync(new URL("../src/dev/", import.meta.url), { recursive: true });
writeFileSync(new URL("../src/dev/mock-data.json", import.meta.url), JSON.stringify(data, null, 1));
console.log(`mock-data.json: ${data.athletes.length} atletas, ${data.matches.length} partidas`);
