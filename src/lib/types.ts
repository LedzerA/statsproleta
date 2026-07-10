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

export interface Match {
  id: string;
  squad_id: string;
  date: string; // ISO YYYY-MM-DD
  opponent: string;
  status: MatchStatus;
  goals_for: number;
  goals_against: number;
  lineup: string[];
  scorers: Scorer[];
  assists: Assist[];
  lineup_complete: boolean;
  notes: string;
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
  | "fim_jogo";

export interface EventPayload {
  title: string;
  body: string;
  goals_for?: number;
  goals_against?: number;
  scorer?: string;
  assist?: string;
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
