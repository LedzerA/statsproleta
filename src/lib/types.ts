export interface Squad {
  id: string;
  name: string;
  position: number;
}

export interface Athlete {
  id: string;
  squad_id: string;
  name: string;
}

export type MatchStatus =
  | "agendada"
  | "ao_vivo_1t"
  | "intervalo"
  | "ao_vivo_2t"
  | "encerrada";

export interface Scorer {
  a: string; // athlete id
  g: number; // gols
}

export interface Assist {
  a: string; // athlete id
  n: number; // assistências
}

/** Cronômetro da partida.
    base = segundos acumulados no período até a última mudança;
    at   = instante ISO da última mudança (para somar tempo quando running). */
export interface Clock {
  base: number;
  period: 1 | 2;
  running: boolean;
  at?: string | null;
}

export interface Match {
  id: string;
  squad_id: string;
  date: string; // ISO YYYY-MM-DD
  opponent: string;
  status: MatchStatus;
  goals_for: number;
  goals_against: number;
  lineup: string[]; // todos os relacionados
  starters: string[]; // titulares (subconjunto do lineup)
  positions: Record<string, string>; // {atletaId: "posição"}
  scorers: Scorer[];
  assists: Assist[];
  lineup_complete: boolean;
  notes: string;
  venue: string | null; // local
  kickoff: string | null; // horário ("11:30")
  kit: string | null; // uniforme
  archived: boolean;
  clock: Clock | null;
  started_at: string | null;
}

export type EventType =
  | "inicio"
  | "gol_pro"
  | "gol_contra"
  | "penalti_pro"
  | "penalti_contra"
  | "fim_1t"
  | "inicio_2t"
  | "fim_jogo"
  | "sub";

export interface EventPayload {
  title?: string;
  body?: string;
  goals_for?: number;
  goals_against?: number;
  scorer?: string;
  assist?: string;
  in?: string; // id de quem entra (sub)
  out?: string; // id de quem sai (sub)
  period?: number;
  seconds?: number;
  legacy?: boolean;
}

export interface MatchEvent {
  id: string;
  match_id: string;
  squad_id: string;
  type: EventType;
  minute: number | null;
  athlete_id: string | null;
  assist_id: string | null;
  payload: EventPayload;
  created_at: string;
}

export type Result = "V" | "E" | "D";
