export interface Squad {
  id: string;
  name: string;
  position: number;
}

export interface Athlete {
  id: string;
  squad_id: string;
  name: string;
  /** posições do perfil (["VOL","MC"]) — vazio = derivar do histórico */
  positions?: string[];
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

/** Uma fase tática: formação + atleta por vaga.
    slots[i] corresponde à vaga i da formação (ordem de src/lib/formations.ts). */
export interface TacticsPhase {
  formation: string; // ex.: "4-3-3"
  slots: (string | null)[]; // atletaId por vaga (null = vaga livre)
  /** Ajuste fino da vaga no campinho, arrastado pelo admin: [x, y] em % do
      campo (x 0→100 esq→dir, y 0→100 fundo→ataque). null/ausente = posição
      padrão da formação. Não muda a posição (rótulo) nem a formação. */
  coords?: ([number, number] | null)[] | null;
  /** Função por vaga SÓ nesta fase (ajuste pontual); null = rótulo da vaga.
      A fase com bola na saída não usa isto — nela vale a posição da partida
      (positions), que alimenta as estatísticas. */
  roles?: (string | null)[] | null;
}

/** Cobradores de bola parada (atletaId por tipo de cobrança). */
export interface SetPieceTakers {
  penalti?: string | null;
  falta?: string | null;
  escanteio_e?: string | null;
  escanteio_d?: string | null;
}

/** Escalação tática por fase — mesmos 11, distribuição diferente.
    com = com bola na saída; ofe (com bola na fase ofensiva), bp (bola parada)
    e cobradores são opcionais, só existem quando personalizados. */
export interface Tactics {
  com: TacticsPhase;
  sem: TacticsPhase;
  ofe?: TacticsPhase | null;
  bp?: TacticsPhase | null;
  cobradores?: SetPieceTakers | null;
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
  meet_time: string | null; // horário de apresentação ("10:30") — atualização 5
  ball_holder: string | null; // com quem estão as bolas da partida
  kit_holder: string | null; // com quem está o uniforme (jogo de camisas)
  archived: boolean;
  clock: Clock | null;
  started_at: string | null;
  tactics: Tactics | null; // formações com/sem bola (atualização 4)
  /** carimbo da última gravação no banco — base da detecção de edição simultânea */
  updated_at?: string | null;
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
