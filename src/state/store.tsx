import {
  createContext, useContext, useEffect, useMemo, useRef, useState, useCallback,
} from "react";
import type { ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { sb } from "../lib/supabase";
import { TEAM } from "../config";
import type { Athlete, EventPayload, EventType, Match, MatchEvent, Squad } from "../lib/types";
import { compute, type SquadStats } from "../lib/stats";
import { result, uid } from "../lib/format";

const SQUAD_KEY = "proleta_squad_v2";

interface StoreValue {
  loading: boolean;
  fatal: string | null;
  squads: Squad[];
  squadId: string;
  setSquadId: (id: string) => void;
  squad: Squad | null;
  roster: Athlete[];
  matches: Match[];
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
  addEvent: (m: Match, type: EventType, opts?: { scorerId?: string; assistId?: string }) => Promise<void>;
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
  scorer?: string, assist?: string
): EventPayload {
  const placar = `${TEAM.short} ${gf} × ${ga} ${m.opponent}`;
  switch (type) {
    case "inicio":
      return { title: "🔴 Bola rolando!", body: `${TEAM.short} × ${m.opponent} — acompanhe ao vivo` };
    case "gol_pro":
      return {
        title: "⚽ GOL DO PROLETA!",
        body: `${scorer || "Gol"}${assist ? ` (assist. ${assist})` : ""} — ${placar}`,
        goals_for: gf, goals_against: ga, scorer, assist,
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
    setAllMatches((ma.data as Match[]) || []);
    return (sq.data as Squad[]) || [];
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
        if (!ownEvents.current.has(ev.id) && ev.payload?.title) {
          toast(`${ev.payload.title} ${ev.payload.body || ""}`);
          if ("Notification" in window && Notification.permission === "granted" && document.hidden) {
            navigator.serviceWorker?.getRegistration().then((reg) => {
              reg?.showNotification(ev.payload.title, {
                body: ev.payload.body, tag: ev.id, icon: "./icon-192.png",
              });
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
    const { error } = await sb.from("matches").upsert({ ...m, updated_at: new Date().toISOString() });
    if (error) { console.error(error); toast("Erro ao salvar. Verifique a conexão."); }
  }, [toast]);

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
    async (m: Match, type: EventType, opts?: { scorerId?: string; assistId?: string }) => {
      const upd: Match = { ...m };
      if (type === "inicio") { upd.status = "ao_vivo_1t"; upd.started_at = new Date().toISOString(); }
      else if (type === "fim_1t") upd.status = "intervalo";
      else if (type === "inicio_2t") upd.status = "ao_vivo_2t";
      else if (type === "fim_jogo") upd.status = "encerrada";
      else if (type === "gol_pro") {
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
      } else if (type === "gol_contra") upd.goals_against = m.goals_against + 1;

      const scorerName = opts?.scorerId ? roster.find((a) => a.id === opts.scorerId)?.name : undefined;
      const assistName = opts?.assistId ? roster.find((a) => a.id === opts.assistId)?.name : undefined;
      const minute = m.started_at
        ? Math.min(130, Math.max(0, Math.round((Date.now() - new Date(m.started_at).getTime()) / 60000)))
        : null;
      const ev: MatchEvent = {
        id: uid("e"),
        match_id: m.id,
        squad_id: m.squad_id,
        type,
        minute,
        athlete_id: opts?.scorerId || null,
        assist_id: opts?.assistId || null,
        payload: eventPayload(type, m, upd.goals_for, upd.goals_against, scorerName, assistName),
        created_at: new Date().toISOString(),
      };
      ownEvents.current.add(ev.id);
      setEvents((old) => ({ ...old, [m.id]: [...(old[m.id] || []), ev] }));
      await upsertMatch(upd);
      const { error } = await sb.from("match_events").insert(ev);
      if (error) { console.error(error); toast("Erro ao registrar evento."); }
    },
    [roster, upsertMatch, toast]
  );

  const signIn = useCallback(async (email: string, pass: string) => {
    const { error } = await sb.auth.signInWithPassword({ email, password: pass });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => { await sb.auth.signOut(); }, []);

  const value: StoreValue = {
    loading, fatal, squads, squadId, setSquadId, squad, roster, matches, stats,
    liveMatch, events, loadEvents, session, isAdmin, signIn, signOut,
    upsertMatch, deleteMatch, addAthlete, addSquad, addEvent, toast, toastMsg,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
