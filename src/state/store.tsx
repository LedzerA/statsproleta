import {
  createContext, useContext, useEffect, useMemo, useRef, useState, useCallback,
} from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { sb } from "../lib/supabase";
import { TEAM } from "../config";
import type { Assist, Athlete, EventPayload, EventType, Match, MatchEvent, Scorer, Squad } from "../lib/types";
import { compute, type SquadStats } from "../lib/stats";
import { clockSeconds, result, uid } from "../lib/format";

const SQUAD_KEY = "proleta_squad_v2";

/* colunas que só existem depois do supabase/atualizacao-1.sql; enquanto o
   banco não tiver sido atualizado, elas são removidas das escritas */
const V21_FIELDS = ["starters", "positions", "venue", "kickoff", "kit", "archived", "clock"] as const;

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
    archived: r.archived === true,
    clock: r.clock ?? null,
    started_at: r.started_at ?? null,
  };
}

interface StoreValue {
  loading: boolean;
  fatal: string | null;
  schemaLegacy: boolean;
  squads: Squad[];
  squadId: string;
  setSquadId: (id: string) => void;
  squad: Squad | null;
  roster: Athlete[];
  athletes: Athlete[];
  athleteName: (id: string) => string;
  matches: Match[];
  allMatches: Match[];
  findMatch: (id: string) => Match | undefined;
  stats: SquadStats;
  liveMatch: Match | null;
  events: Record<string, MatchEvent[]>;
  loadEvents: (matchId: string) => Promise<void>;
  session: Session | null;
  isAdmin: boolean;
  signIn: (email: string, pass: string) => Promise<void>;
  signOut: () => Promise<void>;
  upsertMatch: (m: Match) => Promise<void>;
  deleteMatch: (id: string) => Promise<void>;
  addAthlete: (name: string) => Promise<Athlete | null>;
  addSquad: (name: string) => Promise<void>;
  addEvent: (
    m: Match,
    type: EventType,
    opts?: { scorerId?: string; assistId?: string; inId?: string; outId?: string }
  ) => Promise<void>;
  toggleClock: (m: Match) => Promise<void>;
  resetToScheduled: (m: Match) => Promise<void>;
  importBackup: (raw: unknown) => Promise<{ athletes: number; matches: number }>;
  wipeMatches: () => Promise<void>;
  toast: (msg: string) => void;
  toastMsg: string;
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
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [schemaLegacy, setSchemaLegacy] = useState(false);
  const toastTimer = useRef<number>(0);
  const ownEvents = useRef<Set<string>>(new Set());

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToastMsg(""), 2500);
  }, []);

  const refetch = useCallback(async () => {
    const [sq, at, ma] = await Promise.all([
      sb.from("squads").select("*").order("position"),
      sb.from("athletes").select("*").order("created_at"),
      sb.from("matches").select("*").order("date"),
    ]);
    if (sq.error || at.error || ma.error) {
      throw sq.error || at.error || ma.error;
    }
    setSquads((sq.data as Squad[]) || []);
    setAthletes((at.data as Athlete[]) || []);
    setAllMatches(((ma.data as any[]) || []).map(normalizeMatch));
    return (sq.data as Squad[]) || [];
  }, []);

  /* o banco já recebeu a atualização 1 (colunas de titulares etc.)? */
  useEffect(() => {
    sb.from("matches").select("starters").limit(1).then(({ error }) => {
      setSchemaLegacy(!!error);
      if (error) console.warn("Banco sem a atualização 1 — rode supabase/atualizacao-1.sql:", error.message);
    });
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
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [refetch, toast]);

  /* ---- derivados ---- */
  const setSquadId = useCallback((id: string) => {
    setSquadIdState(id);
    localStorage.setItem(SQUAD_KEY, id);
  }, []);

  const squad = squads.find((s) => s.id === squadId) || null;
  const roster = useMemo(() => athletes.filter((a) => a.squad_id === squadId), [athletes, squadId]);
  const matches = useMemo(() => allMatches.filter((m) => m.squad_id === squadId), [allMatches, squadId]);
  const stats = useMemo(() => compute(roster, matches), [roster, matches]);
  const athleteName = useCallback(
    (id: string) => athletes.find((a) => a.id === id)?.name || "?",
    [athletes]
  );
  const findMatch = useCallback(
    (id: string) => allMatches.find((m) => m.id === id),
    [allMatches]
  );
  const liveMatch = useMemo(
    () => matches.find((m) => m.status === "ao_vivo_1t" || m.status === "intervalo" || m.status === "ao_vivo_2t") || null,
    [matches]
  );

  /* ---- ações ---- */
  const loadEvents = useCallback(async (matchId: string) => {
    const { data, error } = await sb
      .from("match_events").select("*").eq("match_id", matchId).order("created_at");
    if (error) { console.error(error); return; }
    setEvents((old) => ({ ...old, [matchId]: (data as MatchEvent[]) || [] }));
  }, []);

  const upsertMatch = useCallback(async (m: Match) => {
    setAllMatches((old) => {
      const i = old.findIndex((x) => x.id === m.id);
      if (i >= 0) { const cp = [...old]; cp[i] = m; return cp; }
      return [...old, m];
    });
    const row: any = { ...m, updated_at: new Date().toISOString() };
    if (schemaLegacy) for (const f of V21_FIELDS) delete row[f];
    const { error } = await sb.from("matches").upsert(row);
    if (error) { console.error(error); toast("Erro ao salvar. Verifique a conexão."); }
  }, [toast, schemaLegacy]);

  const deleteMatch = useCallback(async (id: string) => {
    setAllMatches((old) => old.filter((m) => m.id !== id));
    const { error } = await sb.from("matches").delete().eq("id", id);
    if (error) { console.error(error); toast("Erro ao excluir."); }
    else toast("Partida excluída");
  }, [toast]);

  const addAthlete = useCallback(async (name: string): Promise<Athlete | null> => {
    const clean = name.trim();
    if (!clean) return null;
    if (roster.some((a) => a.name.toLowerCase() === clean.toLowerCase())) {
      toast("Atleta já existe no elenco");
      return null;
    }
    const a: Athlete = { id: uid("a"), squad_id: squadId, name: clean };
    setAthletes((old) => [...old, a]);
    const { error } = await sb.from("athletes").insert(a);
    if (error) { console.error(error); toast("Erro ao salvar atleta."); return null; }
    toast(`${clean} adicionado ao elenco`);
    return a;
  }, [roster, squadId, toast]);

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
      await upsertMatch(upd);
      const { error } = await sb.from("match_events").insert(ev);
      if (error) { console.error(error); toast("Erro ao registrar evento."); }
    },
    [athleteName, upsertMatch, toast]
  );

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
      com outros elencos. */
  const importBackup = useCallback(async (raw: any) => {
    const rosterIn: any[] | null = Array.isArray(raw?.roster) ? raw.roster
      : Array.isArray(raw?.athletes) ? raw.athletes : null;
    const matchesIn: any[] | null = Array.isArray(raw?.matches) ? raw.matches : null;
    if (!rosterIn || !matchesIn) throw new Error("formato");

    const idMap = new Map<string, string>();
    const newAthletes: Athlete[] = rosterIn.map((a: any) => {
      const nid = uid("a");
      idMap.set(String(a.id), nid);
      return { id: nid, squad_id: squadId, name: String(a.name || "?") };
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
      archived: m.archived === true,
      clock: m.clock ?? null,
      started_at: null,
    }));

    let r = await sb.from("matches").delete().eq("squad_id", squadId);
    if (r.error) throw r.error;
    r = await sb.from("athletes").delete().eq("squad_id", squadId);
    if (r.error) throw r.error;
    if (newAthletes.length) {
      r = await sb.from("athletes").insert(newAthletes);
      if (r.error) throw r.error;
    }
    if (newMatches.length) {
      r = await sb.from("matches").insert(newMatches);
      if (r.error) throw r.error;
    }
    await refetch();
    return { athletes: newAthletes.length, matches: newMatches.length };
  }, [squadId, refetch]);

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

  const value: StoreValue = {
    loading, fatal, schemaLegacy, squads, squadId, setSquadId, squad,
    roster, athletes, athleteName, matches, allMatches, findMatch, stats,
    liveMatch, events, loadEvents, session, isAdmin, signIn, signOut,
    upsertMatch, deleteMatch, addAthlete, addSquad, addEvent, toggleClock,
    resetToScheduled, importBackup, wipeMatches, toast, toastMsg,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
