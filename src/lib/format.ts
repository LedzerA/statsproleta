import type { Clock, Match, Result } from "./types";

export function fmtDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export function fmtDateShort(iso: string): string {
  if (!iso) return "";
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function pct(x: number): string {
  return (x * 100).toFixed(1).replace(".", ",") + "%";
}

export function dec(x: number, n = 2): string {
  return Number(x).toFixed(n).replace(".", ",");
}

export function result(m: Pick<Match, "goals_for" | "goals_against">): Result {
  return m.goals_for > m.goals_against ? "V" : m.goals_for === m.goals_against ? "E" : "D";
}

export function pts(m: Pick<Match, "goals_for" | "goals_against">): number {
  const r = result(m);
  return r === "V" ? 3 : r === "E" ? 1 : 0;
}

export function resWord(r: Result): string {
  return r === "V" ? "Vitória" : r === "E" ? "Empate" : "Derrota";
}

export function uid(prefix: string): string {
  // 8 caracteres aleatórios (~2,8 trilhões de combinações) — seguro até para
  // gerar centenas de ids no mesmo milissegundo (import de backup)
  return prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

export function isLive(status: string): boolean {
  return status === "ao_vivo_1t" || status === "intervalo" || status === "ao_vivo_2t";
}

export function statusLabel(status: string): string {
  switch (status) {
    case "agendada": return "Agendada";
    case "ao_vivo_1t": return "1º tempo";
    case "intervalo": return "Intervalo";
    case "ao_vivo_2t": return "2º tempo";
    default: return "Encerrada";
  }
}

export function sortMatches(list: Match[]): Match[] {
  return [...list].sort((a, b) =>
    a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1
  );
}

/** Segundos decorridos do período atual do cronômetro. */
export function clockSeconds(clock: Clock | null | undefined): number {
  if (!clock) return 0;
  const extra = clock.running && clock.at
    ? Math.max(0, (Date.now() - new Date(clock.at).getTime()) / 1000)
    : 0;
  return Math.round(clock.base + extra);
}

export function fmtClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

/** Minuto do lance para exibição ("2T 12'"). */
export function fmtEventMinute(minute: number | null, period?: number): string {
  if (minute == null) return "";
  return `${period === 2 ? "2T " : period === 1 ? "1T " : ""}${minute}'`;
}
