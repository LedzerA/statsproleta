import { fmtDate, todayISO } from "./format";

/** Filtro global de período — vale para o cabeçalho e todas as telas. */
export type PeriodPreset = "tudo" | "3m" | "6m" | "sem1" | "sem2" | "data";

export interface Period {
  preset: PeriodPreset;
  /* from/to (YYYY-MM-DD, vazio = aberto) são usados só no preset "data" */
  from: string;
  to: string;
}

export const PERIOD_ALL: Period = { preset: "tudo", from: "", to: "" };

export const PERIOD_PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: "tudo", label: "Tudo" },
  { id: "3m", label: "3 meses" },
  { id: "6m", label: "6 meses" },
  { id: "sem1", label: "1º semestre" },
  { id: "sem2", label: "2º semestre" },
  { id: "data", label: "Data específica" },
];

export function monthsAgoISO(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + "T12:00:00"); // meio-dia evita surpresas de fuso
  d.setDate(d.getDate() + days);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/** Datas-limite do período (ISO, inclusivas; "" = sem limite).
    "3/6 meses" ficam abertos no fim para não esconder jogos agendados. */
export function periodRange(p: Period): { from: string; to: string } {
  const year = todayISO().slice(0, 4);
  switch (p.preset) {
    case "3m": return { from: monthsAgoISO(3), to: "" };
    case "6m": return { from: monthsAgoISO(6), to: "" };
    case "sem1": return { from: `${year}-01-01`, to: `${year}-06-30` };
    case "sem2": return { from: `${year}-07-01`, to: `${year}-12-31` };
    case "data": return { from: p.from, to: p.to };
    default: return { from: "", to: "" };
  }
}

export function inPeriod(date: string, r: { from: string; to: string }): boolean {
  return (!r.from || date >= r.from) && (!r.to || date <= r.to);
}

/** Descrição curta para títulos ("últimos 3 meses", "01/01/2026 — 30/06/2026"). */
export function periodLabel(p: Period): string {
  const r = periodRange(p);
  switch (p.preset) {
    case "3m": return "últimos 3 meses";
    case "6m": return "últimos 6 meses";
    case "sem1": return `1º semestre de ${r.from.slice(0, 4)}`;
    case "sem2": return `2º semestre de ${r.from.slice(0, 4)}`;
    case "data":
      return p.from && p.to ? `${fmtDate(p.from)} — ${fmtDate(p.to)}`
        : p.from ? `desde ${fmtDate(p.from)}`
        : p.to ? `até ${fmtDate(p.to)}`
        : "período personalizado";
    default: return "";
  }
}
