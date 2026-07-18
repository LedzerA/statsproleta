import {
  createContext, useContext, useEffect, useMemo, useRef, useState, useCallback,
} from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { sb } from "../lib/supabase";
import { TEAM, VAPID_PUBLIC_KEY } from "../config";
import { getSubscription, pushSupported, subscribePush, unsubscribePush } from "../lib/push";
import { lastPosition } from "../lib/positions";
import type { Assist, Athlete, EventPayload, EventType, Match, MatchEvent, Scorer, SetPieceTakers, Squad, Tactics, TacticsPhase } from "../lib/types";
import { compute, type SquadStats } from "../lib/stats";
import { clockSeconds, result, uid } from "../lib/format";
import { PERIOD_ALL, PERIOD_PRESETS, inPeriod, periodRange, type Period } from "../lib/period";

const SQUAD_KEY = "proleta_squad_v2";
const PERIOD_KEY = "proleta_period_v2";

function loadPeriod(): Period {
  try {
    const p = JSON.parse(localStorage.getItem(PERIOD_KEY) || "");
    if (p && PERIOD_PRESETS.some((x) => x.id === p.preset)) {
      return {
        preset: p.preset,
        from: typeof p.from === "string" ? p.from : "",
        to: typeof p.to === "string" ? p.to : "",
      };
    }
  } catch { /* primeiro acesso ou valor inválido */ }
  return PERIOD_ALL;
}

/* colunas que só existem depois do supabase/atualizacao-1.sql; enquanto o
   banco não tiver sido atualizado, elas são removidas das escritas */
const V21_FIELDS = ["starters", "positions", "venue", "kickoff", "kit", "archived", "clock"] as const;

/* colunas da atualização 5 (logística da convocação): apresentação, bolas e
   uniforme com quem — removidas das escritas enquanto o banco não as tiver */
const LOGISTICS_FIELDS = ["meet_time", "ball_holder", "kit_holder"] as const;

function normPhase(p: any): TacticsPhase | null {
  if (!p || typeof p !== "object" || typeof p.formation !== "string" || !Array.isArray(p.slots)) return null;
  const coords = Array.isArray(p.coords)
    ? p.coords.map((c: any) =>
        Array.isArray(c) && c.length === 2 && typeof c[0] === "number" && typeof c[1] === "number"
          ? ([c[0], c[1]] as [number, number]) : null)
    : null;
  return {
    formation: p.formation,
    slots: p.slots.map((x: any) => (typeof x === "string" && x ? x : null)),
    coords,
  };
}

const COBRANCAS = ["penalti", "falta", "escanteio_e", "escanteio_d"] as const;

function normCobradores(c: any): SetPieceTakers | null {
  if (!c || typeof c !== "object") return null;
  const out: SetPieceTakers = {};
  for (const k of COBRANCAS) if (typeof c[k] === "string" && c[k]) out[k] = c[k];
  return Object.keys(out).length ? out : null;
}

function normTactics(t: any): Tactics | null {
  const com = normPhase(t?.com);
  if (!com) return null;
  const sem = normPhase(t?.sem);
  return {
    com,
    sem: sem || { formation: com.formation, slots: [...com.slots], coords: null },
    bp: normPhase(t?.bp),
    cobradores: normCobradores(t?.cobradores),
  };
}

/* táticas de um backup importado: os ids dos atletas mudam, as vagas seguem */
function remapTactics(t: any, idMap: Map<string, string>): Tactics | null {
  const base = normTactics(t);
  if (!base) return null;
  const remap = (p: TacticsPhase): TacticsPhase => ({
    formation: p.formation,
    slots: p.slots.map((id) => (id && idMap.get(id)) || null),
    coords: p.coords ?? null, // ajustes de vaga não dependem de id
  });
  const cb: SetPieceTakers = {};
  for (const k of COBRANCAS) {
    const v = base.cobradores?.[k];
    const nid = v ? idMap.get(v) : null;
    if (nid) cb[k] = nid;
  }
  return {
    com: remap(base.com),
    sem: remap(base.sem),
    bp: base.bp ? remap(base.bp) : null,
    cobradores: Object.keys(cb).length ? cb : null,
  };
}

function normalizeMatch(r: any): Match {
  return {
    ...r,
    lineup: Array.isArray(r.lineup) ? r.lineup : [],
    starters: Array.isArray(r.starters) ? r.starters : [],
    positions: r.positions && typeof r.positions === "object" ? r.positions : {},
    scorers: Array.isArray(r.scorers) ? r.scorers : [],
    assists: Array.isArray(r.assists) ? r.assists : [],
    venue: r.venue ?? null,
    kickoff: r.kickoff ?? null,
    kit: r.kit ?? null,
    meet_time: r.meet_time ?? null,
    ball_holder: r.ball_holder ?? null,
    kit_holder: r.kit_holder ?? null,
    archived: r.archived === true,
    clock: r.clock ?? null,
    started_at: r.started_at ?? null,
    tactics: normTactics(r.tactics),
  };
}

interface StoreValue {
  loading: boolean;
  fatal: string | null;
  schemaLegacy: boolean;
  /** true quando o banco tem a coluna matches.tactics (atualização 4). */
  schemaTactics: boolean;
  /** true quando o banco tem as colunas de logística (atualização 5). */
  schemaLogistics: boolean;
  squads: Squad[];
  squadId: string;
  setSquadId: (id: string) => void;
  squad: Squad | null;
  roster: Athlete[];
  athletes: Athlete[];
  athleteName: (id: string) => string;
  /** Partidas do elenco atual DENTRO do período global (usar nas telas/estatísticas). */
  matches: Match[];
  /** Todas as partidas do elenco atual, ignorando o período (backup, ao vivo). */
  squadMatches: Match[];
  allMatches: Match[];
  period: Period;
  setPeriod: (p: Period) => void;
  /** true quando o período global está restringindo alguma coisa. */
  periodOn: boolean;
  findMatch: (id: string) => Match | undefined;
  stats: SquadStats;
  liveMatch: Match | null;
  events: Record<string, MatchEvent[]>;
  loadEvents: (matchId: string) => Promise<void>;
  session: Session | null;
  isAdmin: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Push: estado e ação compartilhados entre o cabeçalho e a aba Mais. */
  pushOn: boolean;
  pushBusy: boolean;
  /** Navegador suporta push e a chave VAPID está configurada. */
  pushReady: boolean;
  togglePush: () => Promise<void>;
  /** Grava a partida; false = a escrita falhou (estado já reconciliado). */
  upsertMatch: (m: Match) => Promise<boolean>;
  /** Grava a partida SÓ se ninguém salvou por cima desde `base` (o updated_at
      de quando o formulário abriu). "conflict" = outro admin salvou antes. */
  upsertMatchGuarded: (m: Match, base: string | null) => Promise<"ok" | "conflict" | "error">;
  deleteMatch: (id: string) => Promise<void>;
  /** Cria atleta no elenco indicado (sem indicar, no elenco selecionado). */
  addAthlete: (name: string, squadId?: string) => Promise<Athlete | null>;
  /** Salva as posições do perfil do atleta (precisa da atualização 3 no banco). */
  updateAthletePositions: (id: string, positions: string[]) => Promise<void>;
  /** Corrige o nome do atleta — vale para todo o histórico (registros guardam o id). */
  updateAthleteName: (id: string, name: string) => Promise<boolean>;
  addSquad: (name: string) => Promise<void>;
  addEvent: (
    m: Match,
    type: EventType,
    opts?: { scorerId?: string; assistId?: string; inId?: string; outId?: string }
  ) => Promise<void>;
  updateEvent: (
    m: Match,
    ev: MatchEvent,
    patch: { minute?: number | null; period?: number; scorerId?: string | null; assistId?: string | null }
  ) => Promise<void>;
  deleteEvent: (ev: MatchEvent) => Promise<void>;
  /** Desfaz o último lance (gols/pênaltis/sub): apaga o evento e reverte o placar. */
  undoLastEvent: (m: Match) => Promise<void>;
  toggleClock: (m: Match) => Promise<void>;
  resetToScheduled: (m: Match) => Promise<void>;
  importBackup: (raw: unknown) => Promise<{ athletes: number; matches: number }>;
  wipeMatches: () => Promise<void>;
  toast: (msg: string) => void;
  toastMsg: string;
  /** Confirmação no modal do app (substitui window.confirm). */
  ask: (msg: string, opts?: { title?: string; okLabel?: string; danger?: boolean }) => Promise<boolean>;
  /** Aviso no modal do app (substitui window.alert). */
  tell: (msg: string, title?: string) => Promise<void>;
  dialog: { title: string; msg: string; okLabel: string; danger: boolean; showCancel: boolean } | null;
  resolveDialog: (v: boolean) => void;
}

const Ctx = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore fora do StoreProvider");
  return v;
}

function eventPayload(
  type: EventType, m: Match, gf: number, ga: number,
  names: { scorer?: string; assist?: string; inName?: string; outName?: string }
): EventPayload {
  const placar = `${TEAM.short} ${gf} × ${ga} ${m.opponent}`;
  switch (type) {
    case "inicio":
      return { title: "🔴 Bola rolando!", body: `${TEAM.short} × ${m.opponent} — acompanhe ao vivo` };
    case "gol_pro":
      return {
        title: "⚽ GOL DO PROLETA!",
        body: `${names.scorer || "Gol"}${names.assist ? ` (assist. ${names.assist})` : ""} — ${placar}`,
        goals_for: gf, goals_against: ga, scorer: names.scorer, assist: names.assist,
      };
    case "gol_contra":
      return { title: `Gol do ${m.opponent} 😕`, body: placar, goals_for: gf, goals_against: ga };
    case "penalti_pro":
      return { title: "🎯 Pênalti para o Proleta!", body: placar };
    case "penalti_contra":
      return { title: `⚠️ Pênalti para o ${m.opponent}`, body: placar };
    case "fim_1t":
      return { title: "⏸️ Fim do 1º tempo", body: placar, goals_for: gf, goals_against: ga };
    case "inicio_2t":
      return { title: "▶️ Começa o 2º tempo", body: placar };
    case "sub":
      return {
        title: "🔁 Substituição",
        body: `Entra ${names.inName || "?"}, sai ${names.outName || "?"} — ${placar}`,
      };
    case "fim_jogo": {
      const r = result({ goals_for: gf, goals_against: ga });
      const t = r === "V" ? "🏆 Vitória do Proleta!" : r === "E" ? "🤝 Empate" : "🏁 Fim de jogo";
      return { title: t, body: placar, goals_for: gf, goals_against: ga };
    }
  }
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [fatal, setFatal] = useState<string | null>(null);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [athletes, setAthletes] = useState<Athlete[]>([]);
  const [allMatches, setAllMatches] = useState<Match[]>([]);
  const [events, setEvents] = useState<Record<string, MatchEvent[]>>({});
  const [squadId, setSquadIdState] = useState<string>(() => localStorage.getItem(SQUAD_KEY) || "");
  const [period, setPeriodState] = useState<Period>(loadPeriod);
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  /* assume o schema completo até um probe confirmar coluna ausente (42703):
     um erro transitório de rede no boot não pode descartar dados nas escritas */
  const [schemaLegacy, setSchemaLegacy] = useState(false);
  const [schemaTactics, setSchemaTactics] = useState(true);
  const [schemaLogistics, setSchemaLogistics] = useState(true);
  const toastTimer = useRef<number>(0);
  const ownEvents = useRef<Set<string>>(new Set());

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(""), 2500);
  }, []);

  /* diálogo do app (confirmação/aviso) — substitui confirm()/alert() nativos,
     que destoam da identidade e travam o PWA. App.tsx renderiza. */
  const dialogResolve = useRef<((v: boolean) => void) | null>(null);
  const [dialog, setDialog] = useState<StoreValue["dialog"]>(null);
  const ask = useCallback((msg: string, opts?: { title?: string; okLabel?: string; danger?: boolean }) => {
    return new Promise<boolean>((resolve) => {
      dialogResolve.current?.(false); // pedido pendente é cancelado pelo novo
      dialogResolve.current = resolve;
      setDialog({
        title: opts?.title || "Confirmar",
        msg,
        okLabel: opts?.okLabel || "Confirmar",
        danger: !!opts?.danger,
        showCancel: true,
      });
    });
  }, []);
  const tell = useCallback((msg: string, title = "Aviso") => {
    return new Promise<void>((resolve) => {
      dialogResolve.current?.(false);
      dialogResolve.current = () => resolve();
      setDialog({ title, msg, okLabel: "Entendi", danger: false, showCancel: false });
    });
  }, []);
  const resolveDialog = useCallback((v: boolean) => {
    setDialog(null);
    const r = dialogResolve.current;
    dialogResolve.current = null;
    r?.(v);
  }, []);

  const refetchSeq = useRef(0);
  const refetch = useCallback(async () => {
    // número de sequência: se dois refetches se cruzam, o snapshot mais
    // antigo não pode sobrescrever o mais novo (placar "voltando" no ao vivo)
    const seq = ++refetchSeq.current;
    const [sq, at, ma] = await Promise.all([
      sb.from("squads").select("*").order("position"),
      sb.from("athletes").select("*").order("created_at"),
      sb.from("matches").select("*").order("date"),
    ]);
    if (sq.error || at.error || ma.error) {
      throw sq.error || at.error || ma.error;
    }
    if (seq === refetchSeq.current) {
      setSquads((sq.data as Squad[]) || []);
      setAthletes((((at.data as any[]) || []).map((a) => ({
        ...a, positions: Array.isArray(a.positions) ? a.positions : [],
      })) as Athlete[]));
      setAllMatches(((ma.data as any[]) || []).map(normalizeMatch));
    }
    return (sq.data as Squad[]) || [];
  }, []);

  /* o banco já recebeu as atualizações 1 (titulares etc.), 4 (tactics) e
     5 (logística)? Só o erro 42703 ("coluna não existe") liga o modo de
     compatibilidade — timeout/rede não podem degradar as escritas. */
  useEffect(() => {
    const probe = (col: string, onMissing: () => void, aviso: string) => {
      sb.from("matches").select(col).limit(1).then(({ error }) => {
        if (!error) return;
        if ((error as { code?: string }).code === "42703") {
          onMissing();
          console.warn(aviso, error.message);
        } else {
          console.warn(`Probe de matches.${col} falhou (${error.message}) — assumindo schema completo.`);
        }
      });
    };
    probe("starters", () => setSchemaLegacy(true), "Banco sem a atualização 1 — rode supabase/atualizacao-1.sql:");
    probe("tactics", () => setSchemaTactics(false), "Banco sem a atualização 4 — rode supabase/atualizacao-4.sql (as formações táticas não serão salvas):");
    probe("meet_time", () => setSchemaLogistics(false), "Banco sem a atualização 5 — rode supabase/atualizacao-5.sql (apresentação, bolas e uniforme não serão salvos):");
  }, []);

  /* ---- boot ---- */
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const sq = await refetch();
        if (!mounted) return;
        setSquadIdState((cur) => {
          if (cur && sq.some((s) => s.id === cur)) return cur;
          return sq[0]?.id || "";
        });
        setLoading(false);
      } catch (e: any) {
        console.error(e);
        if (mounted) { setFatal(e?.message || "Erro ao carregar dados."); setLoading(false); }
      }
    })();
    return () => { mounted = false; };
  }, [refetch]);

  /* ---- auth ---- */
  useEffect(() => {
    sb.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((_e, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    // modo mock de desenvolvimento simula um admin logado
    if (import.meta.env.DEV && (window as any).__MOCK_ADMIN__) { setIsAdmin(true); return; }
    if (!session?.user) { setIsAdmin(false); return; }
    sb.from("admins").select("user_id").eq("user_id", session.user.id).maybeSingle()
      .then(({ data }) => setIsAdmin(!!data));
  }, [session]);

  /* ---- realtime ---- */
  useEffect(() => {
    const ch = sb
      .channel("proleta-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => {
        refetch().catch(console.error);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "athletes" }, () => {
        refetch().catch(console.error);
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "squads" }, () => {
        refetch().catch(console.error);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "match_events" }, (p) => {
        const ev = p.new as MatchEvent;
        setEvents((old) => {
          const list = old[ev.match_id] || [];
          if (list.some((x) => x.id === ev.id)) return old;
          return { ...old, [ev.match_id]: [...list, ev] };
        });
        // notificação em primeiro plano (quem criou o evento não precisa)
        const title = ev.payload?.title;
        if (!ownEvents.current.has(ev.id) && title) {
          const body = ev.payload?.body || "";
          toast(`${title} ${body}`);
          if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
            navigator.serviceWorker?.getRegistration().then((reg) => {
              reg?.showNotification(title, { body, tag: ev.id, icon: "./icon-192.png" });
            });
          }
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "match_events" }, (p) => {
        const ev = p.new as MatchEvent;
        setEvents((old) => {
          const list = old[ev.match_id];
          if (!list) return old;
          return { ...old, [ev.match_id]: list.map((x) => (x.id === ev.id ? ev : x)) };
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "match_events" }, (p) => {
        const id = (p.old as { id?: string })?.id;
        if (!id) return;
        setEvents((old) => {
          let changed = false;
          const cp: Record<string, MatchEvent[]> = {};
          for (const k in old) {
            if (old[k].some((x) => x.id === id)) { cp[k] = old[k].filter((x) => x.id !== id); changed = true; }
            else cp[k] = old[k];
          }
          return changed ? cp : old;
        });
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [refetch, toast]);

  /* ---- derivados ---- */
  const setSquadId = useCallback((id: string) => {
    setSquadIdState(id);
    localStorage.setItem(SQUAD_KEY, id);
  }, []);

  const setPeriod = useCallback((p: Period) => {
    setPeriodState(p);
    try { localStorage.setItem(PERIOD_KEY, JSON.stringify(p)); } catch { /* sem storage */ }
  }, []);

  const squad = squads.find((s) => s.id === squadId) || null;
  const roster = useMemo(() => athletes.filter((a) => a.squad_id === squadId), [athletes, squadId]);
  /* partidas do elenco (sem filtro de período) — base para o ao vivo e backup */
  const squadMatches = useMemo(
    () => allMatches.filter((m) => m.squad_id === squadId),
    [allMatches, squadId]
  );
  /* partidas visíveis: período global aplicado a todo o site */
  const range = useMemo(() => periodRange(period), [period]);
  const periodOn = !!(range.from || range.to);
  const matches = useMemo(
    () => (periodOn ? squadMatches.filter((m) => inPeriod(m.date, range)) : squadMatches),
    [squadMatches, range, periodOn]
  );
  const stats = useMemo(() => compute(roster, matches), [roster, matches]);
  const athleteName = useCallback(
    (id: string) => athletes.find((a) => a.id === id)?.name || "?",
    [athletes]
  );
  const findMatch = useCallback(
    (id: string) => allMatches.find((m) => m.id === id),
    [allMatches]
  );
  // ao vivo ignora o período — o banner precisa aparecer sempre
  const liveMatch = useMemo(
    () => squadMatches.find((m) => m.status === "ao_vivo_1t" || m.status === "intervalo" || m.status === "ao_vivo_2t") || null,
    [squadMatches]
  );

  /* ---- ações ---- */
  const loadEvents = useCallback(async (matchId: string) => {
    const { data, error } = await sb
      .from("match_events").select("*").eq("match_id", matchId).order("created_at");
    if (error) { console.error(error); return; }
    setEvents((old) => ({ ...old, [matchId]: (data as MatchEvent[]) || [] }));
  }, []);

  /** Remove um lance da linha do tempo. Não mexe no placar. */
  const deleteEvent = useCallback(async (ev: MatchEvent) => {
    setEvents((old) => ({
      ...old,
      [ev.match_id]: (old[ev.match_id] || []).filter((x) => x.id !== ev.id),
    }));
    const { error } = await sb.from("match_events").delete().eq("id", ev.id);
    if (error) { console.error(error); toast("Erro ao excluir o lance."); loadEvents(ev.match_id); }
    else toast("Lance excluído");
  }, [toast, loadEvents]);

  /** Linha pronta para o banco: carimbo novo + colunas que o schema não tem. */
  const matchRow = useCallback((m: Match) => {
    const row: any = { ...m, updated_at: new Date().toISOString() };
    if (schemaLegacy) for (const f of V21_FIELDS) delete row[f];
    if (schemaLegacy || !schemaTactics) delete row.tactics;
    if (schemaLegacy || !schemaLogistics) for (const f of LOGISTICS_FIELDS) delete row[f];
    return row;
  }, [schemaLegacy, schemaTactics, schemaLogistics]);

  /** Grava a partida (otimista). Em erro, reconcilia o estado com o banco e
      devolve false — quem depende da escrita (ex.: addEvent) pode abortar. */
  const upsertMatch = useCallback(async (m: Match): Promise<boolean> => {
    setAllMatches((old) => {
      const i = old.findIndex((x) => x.id === m.id);
      if (i >= 0) { const cp = [...old]; cp[i] = m; return cp; }
      return [...old, m];
    });
    const { error } = await sb.from("matches").upsert(matchRow(m));
    if (error) {
      console.error(error);
      toast("Erro ao salvar. Verifique a conexão.");
      refetch().catch(console.error); // desfaz o otimismo com a verdade do banco
      return false;
    }
    return true;
  }, [toast, matchRow, refetch]);

  /** Edição simultânea: só grava se o updated_at do banco ainda for `base`
      (a versão de quando o formulário abriu). O UPDATE condicional não afeta
      nenhuma linha quando outro admin salvou antes (ou excluiu a partida) —
      nesse caso devolve "conflict" e NÃO altera nada, nem o estado local. */
  const upsertMatchGuarded = useCallback(async (m: Match, base: string | null): Promise<"ok" | "conflict" | "error"> => {
    let q = sb.from("matches").update(matchRow(m)).eq("id", m.id);
    q = base == null ? q.is("updated_at", null) : q.eq("updated_at", base);
    const { data, error } = await q.select("id");
    if (error) {
      console.error(error);
      toast("Erro ao salvar. Verifique a conexão.");
      return "error";
    }
    if (!data?.length) return "conflict";
    setAllMatches((old) => old.map((x) => (x.id === m.id ? m : x)));
    return "ok";
  }, [toast, matchRow]);

  /** Corrige um lance já registrado: tempo (minuto/período) e, em gol do
      Proleta, autor e assistência — os totais da partida (scorers/assists)
      acompanham a troca, então funciona também em partida encerrada (as
      estatísticas recalculam). O placar nunca muda por aqui. */
  const updateEvent = useCallback(async (
    m: Match,
    ev: MatchEvent,
    patch: { minute?: number | null; period?: number; scorerId?: string | null; assistId?: string | null }
  ) => {
    const minute = patch.minute !== undefined ? patch.minute : ev.minute;
    const period = patch.period ?? ev.payload?.period;
    const payload: EventPayload = {
      ...ev.payload,
      period,
      seconds: minute != null ? minute * 60 : undefined,
    };
    const upd: MatchEvent = { ...ev, minute, payload };

    let updMatch: Match | null = null;
    if (ev.type === "gol_pro" && (patch.scorerId !== undefined || patch.assistId !== undefined)) {
      const newScorer = patch.scorerId !== undefined ? patch.scorerId : ev.athlete_id;
      const newAssist = patch.assistId !== undefined ? patch.assistId : ev.assist_id;
      if (newScorer !== ev.athlete_id || newAssist !== ev.assist_id) {
        const mm: Match = { ...m };
        if (newScorer !== ev.athlete_id) {
          let sc = [...(m.scorers || [])];
          if (ev.athlete_id) {
            sc = sc.map((x) => (x.a === ev.athlete_id ? { ...x, g: x.g - 1 } : x)).filter((x) => x.g > 0);
          }
          if (newScorer) {
            const i = sc.findIndex((x) => x.a === newScorer);
            if (i >= 0) sc[i] = { ...sc[i], g: sc[i].g + 1 }; else sc.push({ a: newScorer, g: 1 });
            if (!mm.lineup.includes(newScorer)) mm.lineup = [...mm.lineup, newScorer];
          }
          mm.scorers = sc;
        }
        if (newAssist !== ev.assist_id) {
          let as = [...(m.assists || [])];
          if (ev.assist_id) {
            as = as.map((x) => (x.a === ev.assist_id ? { ...x, n: x.n - 1 } : x)).filter((x) => x.n > 0);
          }
          if (newAssist) {
            const i = as.findIndex((x) => x.a === newAssist);
            if (i >= 0) as[i] = { ...as[i], n: as[i].n + 1 }; else as.push({ a: newAssist, n: 1 });
            if (!mm.lineup.includes(newAssist)) mm.lineup = [...mm.lineup, newAssist];
          }
          mm.assists = as;
        }
        updMatch = mm;
      }
      upd.athlete_id = newScorer ?? null;
      upd.assist_id = newAssist ?? null;
      // lances migrados do app antigo não têm title: o texto é derivado na
      // exibição a partir de athlete_id/assist_id, nada a reescrever aqui
      if (payload.title) {
        const scorer = newScorer ? athleteName(newScorer) : undefined;
        const assist = newAssist ? athleteName(newAssist) : undefined;
        const gf = payload.goals_for ?? m.goals_for;
        const ga = payload.goals_against ?? m.goals_against;
        payload.scorer = scorer;
        payload.assist = assist;
        payload.body = `${scorer || "Gol"}${assist ? ` (assist. ${assist})` : ""} — ${TEAM.short} ${gf} × ${ga} ${m.opponent}`;
      }
    }

    setEvents((old) => ({
      ...old,
      [ev.match_id]: (old[ev.match_id] || []).map((x) => (x.id === ev.id ? upd : x)),
    }));
    if (updMatch && !(await upsertMatch(updMatch))) {
      // partida não gravou (upsertMatch já reconciliou) — desfaz o lance otimista
      loadEvents(ev.match_id);
      return;
    }
    const { error } = await sb.from("match_events")
      .update({ minute, athlete_id: upd.athlete_id, assist_id: upd.assist_id, payload })
      .eq("id", ev.id);
    if (error) { console.error(error); toast("Erro ao editar o lance."); loadEvents(ev.match_id); }
    else toast("Lance atualizado ✓");
  }, [athleteName, upsertMatch, toast, loadEvents]);

  const deleteMatch = useCallback(async (id: string) => {
    setAllMatches((old) => old.filter((m) => m.id !== id));
    const { error } = await sb.from("matches").delete().eq("id", id);
    if (error) {
      console.error(error);
      toast("Erro ao excluir.");
      refetch().catch(console.error);
    } else toast("Partida excluída");
  }, [toast, refetch]);

  const addAthlete = useCallback(async (name: string, squad?: string): Promise<Athlete | null> => {
    const clean = name.trim();
    if (!clean) return null;
    // o formulário de partida pode estar editando um jogo de OUTRO elenco —
    // o atleta novo tem que nascer no elenco da partida, não no do cabeçalho
    const sid = squad || squadId;
    if (athletes.some((a) => a.squad_id === sid && a.name.toLowerCase() === clean.toLowerCase())) {
      toast("Atleta já existe no elenco");
      return null;
    }
    const a: Athlete = { id: uid("a"), squad_id: sid, name: clean };
    setAthletes((old) => [...old, a]);
    const { error } = await sb.from("athletes").insert(a);
    if (error) {
      console.error(error);
      // remove o atleta-fantasma, senão o guard de duplicado trava a retentativa
      setAthletes((old) => old.filter((x) => x.id !== a.id));
      toast("Erro ao salvar atleta.");
      return null;
    }
    toast(`${clean} adicionado ao elenco`);
    return a;
  }, [athletes, squadId, toast]);

  const updateAthleteName = useCallback(async (id: string, name: string): Promise<boolean> => {
    const clean = name.trim();
    const cur = athletes.find((a) => a.id === id);
    if (!cur) return false;
    if (!clean) { toast("Informe o nome do atleta"); return false; }
    if (clean === cur.name) return true;
    if (athletes.some((a) => a.id !== id && a.squad_id === cur.squad_id && a.name.toLowerCase() === clean.toLowerCase())) {
      toast("Já existe um atleta com esse nome no elenco");
      return false;
    }
    setAthletes((old) => old.map((a) => (a.id === id ? { ...a, name: clean } : a)));
    const { error } = await sb.from("athletes").update({ name: clean }).eq("id", id);
    if (error) {
      console.error(error);
      toast("Erro ao salvar o nome.");
      refetch().catch(console.error); // desfaz o otimismo com a verdade do banco
      return false;
    }
    toast("Nome atualizado ✓");
    return true;
  }, [athletes, toast, refetch]);

  const updateAthletePositions = useCallback(async (id: string, positions: string[]) => {
    setAthletes((old) => old.map((a) => (a.id === id ? { ...a, positions } : a)));
    const { error } = await sb.from("athletes").update({ positions }).eq("id", id);
    if (error) {
      console.error(error);
      toast("Erro ao salvar — o banco tem a atualização 3 (coluna positions)?");
    } else toast("Posições salvas ✓");
  }, [toast]);

  const addSquad = useCallback(async (name: string) => {
    const s: Squad = { id: uid("s"), name: name.trim(), position: squads.length + 1 };
    if (!s.name) return;
    const { error } = await sb.from("squads").insert(s);
    if (error) { console.error(error); toast("Erro ao criar elenco."); return; }
    setSquads((old) => [...old, s]);
    setSquadId(s.id);
    toast(`Elenco ${s.name} criado`);
  }, [squads.length, setSquadId, toast]);

  const addEvent = useCallback(
    async (
      m: Match,
      type: EventType,
      opts?: { scorerId?: string; assistId?: string; inId?: string; outId?: string }
    ) => {
      const now = new Date().toISOString();
      const upd: Match = { ...m };
      // cronômetro no momento do lance (antes de qualquer transição)
      const secs = clockSeconds(m.clock);
      const period = m.clock?.period ?? (m.status === "ao_vivo_2t" ? 2 : 1);

      if (type === "inicio") {
        upd.status = "ao_vivo_1t";
        upd.started_at = now;
        upd.clock = { base: 0, period: 1, running: true, at: now };
      } else if (type === "fim_1t") {
        upd.status = "intervalo";
        upd.clock = { base: secs, period: 1, running: false, at: now };
      } else if (type === "inicio_2t") {
        upd.status = "ao_vivo_2t";
        upd.clock = { base: 0, period: 2, running: true, at: now };
      } else if (type === "fim_jogo") {
        upd.status = "encerrada";
        upd.clock = { base: secs, period, running: false, at: now };
        // relacionado sem posição registrada herda a última em que jogou
        // (ou a primeira do perfil) — evita partida com "N sem posição"
        const pos = { ...(m.positions || {}) };
        let changed = false;
        for (const id of upd.lineup) {
          if (pos[id]) continue;
          const p = lastPosition(id, allMatches, { id: m.id, date: m.date })
            || athletes.find((a) => a.id === id)?.positions?.[0];
          if (p) { pos[id] = p; changed = true; }
        }
        if (changed) upd.positions = pos;
      } else if (type === "gol_pro") {
        upd.goals_for = m.goals_for + 1;
        if (opts?.scorerId) {
          const sc = [...(m.scorers || [])];
          const i = sc.findIndex((x) => x.a === opts.scorerId);
          if (i >= 0) sc[i] = { ...sc[i], g: sc[i].g + 1 }; else sc.push({ a: opts.scorerId, g: 1 });
          upd.scorers = sc;
          if (!upd.lineup.includes(opts.scorerId)) upd.lineup = [...upd.lineup, opts.scorerId];
        }
        if (opts?.assistId) {
          const as = [...(m.assists || [])];
          const i = as.findIndex((x) => x.a === opts.assistId);
          if (i >= 0) as[i] = { ...as[i], n: as[i].n + 1 }; else as.push({ a: opts.assistId, n: 1 });
          upd.assists = as;
          if (!upd.lineup.includes(opts.assistId)) upd.lineup = [...upd.lineup, opts.assistId];
        }
      } else if (type === "gol_contra") {
        upd.goals_against = m.goals_against + 1;
      } else if (type === "sub") {
        if (opts?.inId && !upd.lineup.includes(opts.inId)) upd.lineup = [...upd.lineup, opts.inId];
      }

      const minute = m.clock || m.started_at
        ? Math.max(0, Math.round(
            m.clock ? secs / 60
              : (Date.now() - new Date(m.started_at!).getTime()) / 60000
          ))
        : null;
      const payload = eventPayload(type, m, upd.goals_for, upd.goals_against, {
        scorer: opts?.scorerId ? athleteName(opts.scorerId) : undefined,
        assist: opts?.assistId ? athleteName(opts.assistId) : undefined,
        inName: opts?.inId ? athleteName(opts.inId) : undefined,
        outName: opts?.outId ? athleteName(opts.outId) : undefined,
      });
      payload.period = period;
      payload.seconds = secs;
      if (type === "sub") { payload.in = opts?.inId; payload.out = opts?.outId; }

      const ev: MatchEvent = {
        id: uid("e"),
        match_id: m.id,
        squad_id: m.squad_id,
        type,
        minute,
        athlete_id: opts?.scorerId || opts?.inId || null,
        assist_id: opts?.assistId || opts?.outId || null,
        payload,
        created_at: now,
      };
      ownEvents.current.add(ev.id);
      setEvents((old) => ({ ...old, [m.id]: [...(old[m.id] || []), ev] }));
      const ok = await upsertMatch(upd);
      if (!ok) {
        // partida não gravou (upsertMatch já reconciliou) — não insere o lance
        ownEvents.current.delete(ev.id);
        setEvents((old) => ({ ...old, [m.id]: (old[m.id] || []).filter((x) => x.id !== ev.id) }));
        return;
      }
      const { error } = await sb.from("match_events").insert(ev);
      if (error) { console.error(error); toast("Erro ao registrar evento."); loadEvents(m.id); }
    },
    [athleteName, athletes, allMatches, upsertMatch, toast, loadEvents]
  );

  /** Desfaz o ÚLTIMO lance registrado (gols, pênaltis e substituições):
      apaga o lance e reverte o placar/marcadores quando for gol. Transições
      de tempo têm os próprios controles e não passam por aqui. */
  const undoLastEvent = useCallback(async (m: Match) => {
    const list = (events[m.id] || []).slice()
      .sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
    const ev = list[list.length - 1];
    const desfazivel: EventType[] = ["gol_pro", "gol_contra", "penalti_pro", "penalti_contra", "sub"];
    if (!ev || !desfazivel.includes(ev.type)) {
      toast("O último lance não é desfazível por aqui.");
      return;
    }
    const upd: Match = { ...m };
    if (ev.type === "gol_pro") {
      upd.goals_for = Math.max(0, m.goals_for - 1);
      if (ev.athlete_id) {
        upd.scorers = (m.scorers || [])
          .map((x) => (x.a === ev.athlete_id ? { ...x, g: x.g - 1 } : x))
          .filter((x) => x.g > 0);
      }
      if (ev.assist_id) {
        upd.assists = (m.assists || [])
          .map((x) => (x.a === ev.assist_id ? { ...x, n: x.n - 1 } : x))
          .filter((x) => x.n > 0);
      }
    } else if (ev.type === "gol_contra") {
      upd.goals_against = Math.max(0, m.goals_against - 1);
    }
    setEvents((old) => ({ ...old, [m.id]: (old[m.id] || []).filter((x) => x.id !== ev.id) }));
    const { error } = await sb.from("match_events").delete().eq("id", ev.id);
    if (error) { console.error(error); toast("Erro ao desfazer."); loadEvents(m.id); return; }
    if (ev.type === "gol_pro" || ev.type === "gol_contra") await upsertMatch(upd);
    toast("Último lance desfeito ↩");
  }, [events, upsertMatch, toast, loadEvents]);

  /** Volta a partida para "agendada": zera placar, gols, lances e relógio.
      Mantém relacionados, titulares, posições, local, horário e uniforme. */
  const resetToScheduled = useCallback(async (m: Match) => {
    const { error } = await sb.from("match_events").delete().eq("match_id", m.id);
    if (error) { console.error(error); toast("Erro ao limpar os lances."); return; }
    setEvents((old) => ({ ...old, [m.id]: [] }));
    await upsertMatch({
      ...m,
      status: "agendada",
      goals_for: 0,
      goals_against: 0,
      scorers: [],
      assists: [],
      clock: null,
      started_at: null,
    });
    toast("Partida zerada e reagendada ✓");
  }, [upsertMatch, toast]);

  /** Pausa / retoma o cronômetro (sem gerar lance). */
  const toggleClock = useCallback(async (m: Match) => {
    if (!m.clock) return;
    const now = new Date().toISOString();
    const clock = m.clock.running
      ? { ...m.clock, base: clockSeconds(m.clock), running: false, at: now }
      : { ...m.clock, running: true, at: now };
    await upsertMatch({ ...m, clock });
  }, [upsertMatch]);

  /** Importa backup .json (formato v1 do arquivo único OU v2) substituindo
      atletas e partidas do ELENCO ATUAL. IDs são remapeados para não colidir
      com outros elencos. Ordem à prova de falha: valida tudo, INSERE os
      novos primeiro e só então apaga os antigos — um erro no meio nunca
      deixa o elenco vazio. */
  const importBackup = useCallback(async (raw: any) => {
    const rosterIn: any[] | null = Array.isArray(raw?.roster) ? raw.roster
      : Array.isArray(raw?.athletes) ? raw.athletes : null;
    const matchesIn: any[] | null = Array.isArray(raw?.matches) ? raw.matches : null;
    if (!rosterIn || !matchesIn) throw new Error("formato");
    // valida ANTES de escrever qualquer coisa
    for (const m of matchesIn) {
      if (!/^\d{4}-\d{2}-\d{2}/.test(String(m.date || ""))) throw new Error("formato");
    }

    const idMap = new Map<string, string>();
    const newAthletes: Athlete[] = rosterIn.map((a: any) => {
      const nid = uid("a");
      idMap.set(String(a.id), nid);
      return {
        id: nid, squad_id: squadId, name: String(a.name || "?"),
        positions: Array.isArray(a.positions) ? a.positions.map(String) : [],
      };
    });
    const VALID = ["agendada", "ao_vivo_1t", "intervalo", "ao_vivo_2t", "encerrada"];
    const newMatches: Match[] = matchesIn.map((m: any) => ({
      id: uid("m"),
      squad_id: squadId,
      date: String(m.date || "").slice(0, 10),
      opponent: String(m.opponent || "?"),
      status: VALID.includes(m.status) ? m.status : "encerrada",
      goals_for: Number(m.goals_for ?? m.goalsFor) || 0,
      goals_against: Number(m.goals_against ?? m.goalsAgainst) || 0,
      lineup: (Array.isArray(m.lineup) ? m.lineup : [])
        .map((x: any) => idMap.get(String(x))).filter(Boolean) as string[],
      scorers: (Array.isArray(m.scorers) ? m.scorers : [])
        .map((s: any) => ({ a: idMap.get(String(s.a)) as string, g: Number(s.g) || 0 }))
        .filter((s: Scorer) => !!s.a && s.g > 0),
      assists: (Array.isArray(m.assists) ? m.assists : [])
        .map((s: any) => ({ a: idMap.get(String(s.a)) as string, n: Number(s.n) || 0 }))
        .filter((s: Assist) => !!s.a && s.n > 0),
      lineup_complete: (m.lineup_complete ?? m.lineupComplete) !== false,
      notes: String(m.notes || ""),
      starters: (Array.isArray(m.starters) ? m.starters : [])
        .map((x: any) => idMap.get(String(x))).filter(Boolean) as string[],
      positions: Object.fromEntries(
        Object.entries(m.positions && typeof m.positions === "object" ? m.positions : {})
          .map(([k, v]) => [idMap.get(String(k)), String(v)])
          .filter(([k]) => !!k)
      ) as Record<string, string>,
      venue: m.venue ?? null,
      kickoff: m.kickoff ?? null,
      kit: m.kit ?? null,
      meet_time: m.meet_time ?? null,
      ball_holder: m.ball_holder ?? null,
      kit_holder: m.kit_holder ?? null,
      archived: m.archived === true,
      clock: m.clock ?? null,
      started_at: null,
      tactics: remapTactics(m.tactics, idMap),
    }));

    const oldMatchIds = allMatches.filter((m) => m.squad_id === squadId).map((m) => m.id);
    const oldAthleteIds = athletes.filter((a) => a.squad_id === squadId).map((a) => a.id);

    // 1) insere os novos (ids recém-gerados não colidem com os antigos)
    if (newAthletes.length) {
      const rows = newAthletes.map((a) => {
        const row: any = { ...a };
        if (schemaLegacy) delete row.positions; // coluna da atualização 3
        return row;
      });
      const r = await sb.from("athletes").insert(rows);
      if (r.error) throw r.error;
    }
    if (newMatches.length) {
      const rows = newMatches.map((m) => {
        const row: any = { ...m };
        if (schemaLegacy) for (const f of V21_FIELDS) delete row[f];
        if (schemaLegacy || !schemaTactics) delete row.tactics;
        if (schemaLegacy || !schemaLogistics) for (const f of LOGISTICS_FIELDS) delete row[f];
        return row;
      });
      const r = await sb.from("matches").insert(rows);
      if (r.error) {
        // desfaz os atletas recém-inseridos para não deixar duplicata
        await sb.from("athletes").delete().in("id", newAthletes.map((a) => a.id));
        throw r.error;
      }
    }
    // 2) só então remove os antigos, em lotes (URLs curtas)
    for (let i = 0; i < oldMatchIds.length; i += 80) {
      const r = await sb.from("matches").delete().in("id", oldMatchIds.slice(i, i + 80));
      if (r.error) throw r.error;
    }
    for (let i = 0; i < oldAthleteIds.length; i += 80) {
      const r = await sb.from("athletes").delete().in("id", oldAthleteIds.slice(i, i + 80));
      if (r.error) throw r.error;
    }
    await refetch();
    return { athletes: newAthletes.length, matches: newMatches.length };
  }, [squadId, allMatches, athletes, refetch, schemaLegacy, schemaTactics, schemaLogistics]);

  /** Apaga todas as partidas do elenco atual (mantém os atletas). */
  const wipeMatches = useCallback(async () => {
    const { error } = await sb.from("matches").delete().eq("squad_id", squadId);
    if (error) { console.error(error); toast("Erro ao apagar."); return; }
    await refetch();
    toast("Partidas apagadas");
  }, [squadId, refetch, toast]);

  const signIn = useCallback(async (email: string, pass: string) => {
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => { await sb.auth.signOut(); }, []);

  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  useEffect(() => { getSubscription().then((s) => setPushOn(!!s)); }, []);

  const togglePush = useCallback(async () => {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (pushOn) {
        await unsubscribePush();
        setPushOn(false);
        toast("Notificações desativadas");
        return;
      }
      const res = await subscribePush(squadId);
      setPushOn(res.ok);
      if (res.ok) { toast("Notificações ativadas ✓ Você receberá os lances ao vivo."); return; }
      const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      const msg =
        res.reason === "denied"
          ? "Permissão negada no navegador. Toque no cadeado ao lado do endereço → Notificações → Permitir, e tente de novo."
          : res.reason === "unsupported"
            ? isIOS
              ? "No iPhone, primeiro adicione o app à tela de início (menu compartilhar) e abra por lá."
              : "Este navegador não suporta notificações push."
            : res.reason === "server"
              ? "O navegador aprovou, mas o servidor recusou o registro. Me avise se continuar."
              : "Não foi possível ativar as notificações neste aparelho.";
      await tell(msg + (res.detail ? `\n\nDetalhe técnico: ${res.detail}` : ""), "Notificações");
    } finally { setPushBusy(false); }
  }, [pushOn, pushBusy, squadId, toast, tell]);

  const value: StoreValue = {
    loading, fatal, schemaLegacy, schemaTactics, schemaLogistics, squads, squadId, setSquadId, squad,
    roster, athletes, athleteName, matches, squadMatches, allMatches,
    period, setPeriod, periodOn, findMatch, stats,
    liveMatch, events, loadEvents, session, isAdmin, signIn, signOut,
    pushOn, pushBusy, pushReady: pushSupported && !!VAPID_PUBLIC_KEY, togglePush,
    upsertMatch, upsertMatchGuarded, deleteMatch, addAthlete, updateAthletePositions, updateAthleteName, addSquad, addEvent,
    updateEvent, deleteEvent, undoLastEvent, toggleClock,
    resetToScheduled, importBackup, wipeMatches, toast, toastMsg,
    ask, tell, dialog, resolveDialog,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
