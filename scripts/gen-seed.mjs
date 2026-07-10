// Gera supabase/seed.sql a partir do DATA_SEED embutido no app antigo
// (legacy/proleta-esporte.html). Rodar: node scripts/gen-seed.mjs
import { readFileSync, writeFileSync } from "node:fs";

const html = readFileSync(new URL("../legacy/proleta-esporte.html", import.meta.url), "utf8");
const m = html.match(/const DATA_SEED = (\{.*?\});\n/s);
if (!m) throw new Error("DATA_SEED não encontrado no arquivo legado");
const seed = JSON.parse(m[1]);

const q = (s) => "'" + String(s).replace(/'/g, "''") + "'";
const j = (v) => q(JSON.stringify(v));

let sql = `-- ============================================================
-- SEED: elenco Esporte + histórico de partidas (migrado do app v1)
-- Rode DEPOIS do schema.sql. Idempotente e NÃO destrutivo: linhas já
-- existentes (ex.: migradas do banco v1) são mantidas como estão.
-- ============================================================

insert into public.squads (id, name, position) values
  ('esporte', 'Esporte', 1)
on conflict (id) do nothing;

insert into public.athletes (id, squad_id, name) values
`;

sql += seed.roster
  .map((a) => `  (${q(a.id)}, 'esporte', ${q(a.name)})`)
  .join(",\n");
sql += `\non conflict (id) do nothing;\n\n`;

sql += `insert into public.matches
  (id, squad_id, date, opponent, status, goals_for, goals_against, lineup, scorers, assists, lineup_complete, notes) values\n`;
sql += seed.matches
  .map((mt) =>
    `  (${q(mt.id)}, 'esporte', ${q(mt.date)}, ${q(mt.opponent)}, 'encerrada', ` +
    `${mt.goalsFor || 0}, ${mt.goalsAgainst || 0}, ${j(mt.lineup || [])}, ` +
    `${j(mt.scorers || [])}, ${j(mt.assists || [])}, ${mt.lineupComplete !== false}, ${q(mt.notes || "")})`
  )
  .join(",\n");
sql += `\non conflict (id) do nothing;\n`;

writeFileSync(new URL("../supabase/seed.sql", import.meta.url), sql);
console.log(`seed.sql: ${seed.roster.length} atletas, ${seed.matches.length} partidas`);
