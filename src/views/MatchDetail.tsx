import { useEffect, useMemo, useState } from "react";
import { useStore } from "../state/store";
import { navigate } from "../lib/router";
import { sb } from "../lib/supabase";
import { TEAM } from "../config";
import {
  clockSeconds, fmtClock, fmtDate, fmtEventMinute, isLive, result, resWord, statusLabel, uid,
} from "../lib/format";
import { Modal } from "../components/ui";
import { Pitch } from "../components/Pitch";
import { renderLineupArt, renderResultArt, renderTacticsArt } from "../lib/art";
import { getFormation } from "../lib/formations";
import { posRank, sortLineup } from "../lib/positions";
import MatchForm from "./MatchForm";
import type { EventType, Match, MatchEvent } from "../lib/types";

const EVENT_ICON: Record<string, string> = {
  inicio: "🔴", gol_pro: "⚽", gol_contra: "😕",
  penalti_pro: "🎯", penalti_contra: "⚠️",
  fim_1t: "⏸️", inicio_2t: "▶️", fim_jogo: "🏁", sub: "🔁",
};
const EVENT_LABEL: Record<string, string> = {
  inicio: "Começa o jogo", gol_pro: "⚽ GOL DO PROLETA!", gol_contra: "Gol do adversário",
  penalti_pro: "Pênalti para o Proleta", penalti_contra: "Pênalti para o adversário",
  fim_1t: "Fim do 1º tempo", inicio_2t: "Começa o 2º tempo", fim_jogo: "Fim de jogo",
  sub: "Substituição",
};

/** Quantos aparelhos estão com esta partida aberta AGORA (Supabase Presence).
    Cada visitante entra anônimo no canal da partida com uma chave estável por
    aparelho (abas duplicadas contam uma vez); ninguém grava nada no banco. */
function useLiveViewers(matchId: string | undefined, live: boolean): number {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!matchId || !live) { setCount(0); return; }
    let key: string;
    try {
      key = localStorage.getItem("proleta_viewer") || uid("v");
      localStorage.setItem("proleta_viewer", key);
    } catch { key = uid("v"); }
    const ch = sb.channel(`viewers:${matchId}`, { config: { presence: { key } } });
    ch.on("presence", { event: "sync" }, () => {
      setCount(Object.keys(ch.presenceState()).length);
    });
    ch.subscribe((status) => {
      if (status === "SUBSCRIBED") ch.track({ at: new Date().toISOString() });
    });
    return () => { sb.removeChannel(ch); setCount(0); };
  }, [matchId, live]);
  return count;
}

/** Cronômetro que se atualiza sozinho enquanto está rodando. */
function LiveClock({ m }: { m: Match }) {
  const [, force] = useState(0);
  useEffect(() => {
    if (!m.clock?.running) return;
    const t = window.setInterval(() => force((x) => x + 1), 1000);
    return () => window.clearInterval(t);
  }, [m.clock?.running, m.clock?.at]);
  if (!m.clock) return null;
  const label = m.status === "intervalo" ? "INT" : m.clock.period === 2 ? "2T" : "1T";
  return (
    <span className="sh-clock num">
      {label} {fmtClock(clockSeconds(m.clock))}{!m.clock.running && m.status !== "intervalo" && isLive(m.status) ? " ⏸" : ""}
    </span>
  );
}

export default function MatchDetail({ id }: { id: string }) {
  const {
    findMatch, roster, squads, athleteName, isAdmin, schemaLegacy,
    events, loadEvents, addEvent, updateEvent, deleteEvent, toggleClock, resetToScheduled,
    deleteMatch, upsertMatch, toast,
  } = useStore();
  const [editing, setEditing] = useState(false);
  const [goalPicker, setGoalPicker] = useState(false);
  const [subPicker, setSubPicker] = useState(false);
  const [editEv, setEditEv] = useState<MatchEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const [art, setArt] = useState<{ label: string; url: string; file: string }[] | null>(null);
  const [artBusy, setArtBusy] = useState(false);
  const [tacPhase, setTacPhase] = useState<"com" | "sem" | "bp">("com");

  const m = findMatch(id);
  useEffect(() => { if (m) loadEvents(m.id); }, [id]);
  const viewers = useLiveViewers(m?.id, !!m && isLive(m.status));

  const evList = m ? (events[m.id] || []) : [];
  /* quem está em campo AGORA: titulares + entradas − saídas (na ordem em que
     as substituições foram registradas). Atualiza em tempo real a cada sub. */
  const onField = useMemo(() => {
    const base = (m?.starters?.length ? m.starters : m?.lineup) || [];
    const set = new Set(base);
    const subs = evList.filter((e) => e.type === "sub")
      .slice().sort((a, b) => (a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0));
    for (const ev of subs) {
      const outId = ev.payload?.out || ev.assist_id;
      const inId = ev.payload?.in || ev.athlete_id;
      if (outId) set.delete(outId);
      if (inId) set.add(inId);
    }
    return set;
  }, [evList, m?.starters, m?.lineup]);

  if (!m) {
    return (
      <div className="empty">
        <h3>Partida não encontrada</h3>
        <button className="btn" onClick={() => navigate("#/partidas")}>← Voltar às partidas</button>
      </div>
    );
  }

  const live = isLive(m.status);
  // ordena por período e minuto (com a ordem de registro como desempate) para
  // que um lance com o tempo corrigido apareça no lugar certo da linha do tempo
  const timeline = evList.slice().sort(cmpChrono).reverse();
  // escalação sempre na ordem convencional: GOL → LD/ZG/LE → VOL/MC/MEI → PE/PD/SA/CA
  const starters = sortLineup(m.starters || [], m.positions, athleteName);
  const bench = sortLineup(
    (m.lineup || []).filter((aid) => !(m.starters || []).includes(aid)),
    m.positions, athleteName
  );
  const pos = (aid: string) => (m.positions?.[aid] ? ` · ${m.positions[aid]}` : "");

  async function fire(type: EventType, opts?: { scorerId?: string; assistId?: string; inId?: string; outId?: string }) {
    if (busy) return;
    setBusy(true);
    try { await addEvent(m!, type, opts); } finally { setBusy(false); }
  }

  function confirmFire(msg: string, type: EventType) {
    if (confirm(msg)) fire(type);
  }

  const artKind = m?.status === "agendada" ? "convocacao" : "resultado";

  async function makeArt() {
    if (artBusy || !m) return;
    setArtBusy(true);
    try {
      const squadName = squads.find((s) => s.id === m.squad_id)?.name || null;
      const png = (c: HTMLCanvasElement) => c.toDataURL("image/png");
      const imgs: { label: string; url: string; file: string }[] = [];
      if (m.status === "agendada") {
        imgs.push({
          label: "Convocação",
          url: png(await renderLineupArt(m, athleteName, squadName)),
          file: `proleta-convocacao-${m.date}.png`,
        });
        if (m.tactics && m.tactics.com.slots.some(Boolean)) {
          imgs.push({
            label: `Com bola · ${m.tactics.com.formation}`,
            url: png(await renderTacticsArt(m, "com", athleteName, squadName)),
            file: `proleta-com-bola-${m.date}.png`,
          });
          imgs.push({
            label: `Sem bola · ${m.tactics.sem.formation}`,
            url: png(await renderTacticsArt(m, "sem", athleteName, squadName)),
            file: `proleta-sem-bola-${m.date}.png`,
          });
          if (m.tactics.bp) {
            imgs.push({
              label: `Bola parada · ${m.tactics.bp.formation}`,
              url: png(await renderTacticsArt(m, "bp", athleteName, squadName)),
              file: `proleta-bola-parada-${m.date}.png`,
            });
          }
        }
      } else {
        imgs.push({
          label: "Resultado",
          url: png(await renderResultArt(m, athleteName, squadName)),
          file: `proleta-resultado-${m.date}.png`,
        });
      }
      setArt(imgs);
    } catch (e) {
      console.error(e);
      toast("Não foi possível gerar a arte.");
    } finally { setArtBusy(false); }
  }

  function downloadArt(item: { url: string; file: string }) {
    const a = document.createElement("a");
    a.href = item.url;
    a.download = item.file;
    a.click();
  }

  async function shareArt(item: { label: string; url: string; file: string }) {
    if (!m) return;
    try {
      const blob = await (await fetch(item.url)).blob();
      const file = new File([blob], item.file, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: m.status === "agendada"
            ? `${TEAM.short} × ${m.opponent} — ${fmtDate(m.date)}`
            : `${TEAM.short} ${m.goals_for} × ${m.goals_against} ${m.opponent}`,
        });
        return;
      }
    } catch { /* cancelado ou sem suporte — cai para o download */ }
    downloadArt(item);
  }

  /** Compartilha a arte com a legenda da convocação (apresentação, bolas,
      uniforme). Sem suporte a arquivos no menu de compartilhar (desktop),
      baixa o PNG e abre o WhatsApp com a legenda pronta para colar. */
  async function shareWhatsApp(item: { label: string; url: string; file: string }) {
    if (!m) return;
    const caption = convocacaoCaption(m);
    try {
      const blob = await (await fetch(item.url)).blob();
      const file = new File([blob], item.file, { type: "image/png" });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text: caption });
        return;
      }
    } catch (e) {
      if ((e as any)?.name === "AbortError") return; // usuário desistiu no menu
    }
    downloadArt(item);
    window.open(`https://wa.me/?text=${encodeURIComponent(caption)}`, "_blank");
  }

  const infoBits = [
    m.venue && `📍 ${m.venue}`,
    m.kickoff && `🕒 ${m.kickoff}`,
    m.status === "agendada" && m.meet_time && `⏰ Apresentação ${m.meet_time}`,
    m.kit && `👕 ${m.kit}${m.status === "agendada" && m.kit_holder ? ` (com ${m.kit_holder})` : ""}`,
    m.status === "agendada" && !m.kit && m.kit_holder && `👕 Uniforme com ${m.kit_holder}`,
    m.status === "agendada" && m.ball_holder && `⚽ Bolas com ${m.ball_holder}`,
  ].filter(Boolean) as string[];

  // escalação tática: fase ativa (bola parada só existe quando personalizada)
  const tac = m.tactics && m.tactics.com.slots.some(Boolean) ? m.tactics : null;
  const tacCur = tac ? ((tacPhase === "bp" ? tac.bp : tac[tacPhase]) || tac.com) : null;
  const cobradores = tac?.cobradores || null;

  return (
    <>
      <button className="back-link" onClick={() => navigate("#/partidas")}>← Partidas</button>

      <div className={`score-hero ${live ? "live" : ""}`}>
        <div className="sh-status">
          {live && <span className="pulse" />}
          {m.status === "agendada" ? `Agendada · ${fmtDate(m.date)}`
            : live ? `AO VIVO · ${statusLabel(m.status)}`
            : `${m.archived ? "Arquivada · " : ""}${resWord(result(m))} · ${fmtDate(m.date)}`}
        </div>
        <div className="sh-teams">
          <div className="sh-team">{TEAM.short}</div>
          <div className="sh-score num">
            {m.status === "agendada" ? "×" : `${m.goals_for} × ${m.goals_against}`}
          </div>
          <div className="sh-team">{m.opponent}</div>
        </div>
        {live && <LiveClock m={m} />}
        {live && viewers > 0 && (
          <div className="sh-viewers">
            👁 <b className="num">{viewers}</b> {viewers === 1 ? "pessoa acompanhando" : "pessoas acompanhando"}
          </div>
        )}
        {infoBits.length > 0 && <div className="sh-info">{infoBits.join("   ·   ")}</div>}
      </div>

      {(m.status === "encerrada" || m.status === "agendada") && (
        <button className="btn ghost-light block" style={{ marginBottom: 14 }} disabled={artBusy} onClick={makeArt}>
          {artBusy
            ? "Gerando artes…"
            : m.status === "agendada"
              ? m.tactics ? "🖼️ Gerar artes da convocação" : "🖼️ Gerar arte da convocação"
              : "🖼️ Gerar arte do resultado"}
        </button>
      )}

      {isAdmin && m.status === "agendada" && (
        <div className="live-controls">
          <button className="btn primary block lg" disabled={busy}
            onClick={() => { if (confirm("Iniciar a partida ao vivo? Os inscritos receberão notificação.")) fire("inicio"); }}>
            🔴 Iniciar partida ao vivo
          </button>
          <div className="row-gap">
            <button className="btn ghost-light block" onClick={() => setEditing(true)}>Editar</button>
            <button className="btn danger block" onClick={() => {
              if (confirm(`Excluir a partida contra ${m.opponent}?`)) { deleteMatch(m.id); navigate("#/partidas"); }
            }}>Excluir</button>
          </div>
        </div>
      )}

      {isAdmin && live && (
        <div className="live-controls">
          <div className="lc-grid">
            <button className="btn primary lg" disabled={busy || m.status === "intervalo"} onClick={() => setGoalPicker(true)}>
              ⚽ Gol do Proleta
            </button>
            <button className="btn lg" disabled={busy || m.status === "intervalo"}
              onClick={() => confirmFire(`Registrar gol do ${m.opponent}?`, "gol_contra")}>
              Gol do adversário
            </button>
            <button className="btn ghost-light" disabled={busy || m.status === "intervalo"}
              onClick={() => confirmFire("Pênalti para o Proleta?", "penalti_pro")}>
              🎯 Pênalti pró
            </button>
            <button className="btn ghost-light" disabled={busy || m.status === "intervalo"}
              onClick={() => confirmFire(`Pênalti para o ${m.opponent}?`, "penalti_contra")}>
              ⚠️ Pênalti contra
            </button>
            <button className="btn ghost-light" disabled={busy || m.status === "intervalo"}
              onClick={() => setSubPicker(true)}>
              🔁 Substituição
            </button>
            {m.clock && m.status !== "intervalo" && (
              <button className="btn ghost-light" disabled={busy} onClick={() => toggleClock(m)}>
                {m.clock.running ? "⏸ Pausar relógio" : "▶ Retomar relógio"}
              </button>
            )}
          </div>
          {m.status === "ao_vivo_1t" && (
            <button className="btn block" disabled={busy}
              onClick={() => confirmFire("Encerrar o 1º tempo?", "fim_1t")}>⏸️ Fim do 1º tempo</button>
          )}
          {m.status === "intervalo" && (
            <button className="btn block" disabled={busy}
              onClick={() => confirmFire("Iniciar o 2º tempo?", "inicio_2t")}>▶️ Iniciar 2º tempo</button>
          )}
          {m.status === "ao_vivo_2t" && (
            <button className="btn danger block" disabled={busy}
              onClick={() => confirmFire("Encerrar a partida? O resultado passa a contar nas estatísticas.", "fim_jogo")}>
              🏁 Encerrar partida
            </button>
          )}
          <button className="btn ghost-light block sm" disabled={busy}
            onClick={() => {
              if (confirm("Zerar e REAGENDAR esta partida? Placar, gols e lances são apagados (escalação, local e horário ficam). Bom para desfazer um teste.")) {
                resetToScheduled(m);
              }
            }}>
            ↩ Zerar e reagendar (desfazer início)
          </button>
        </div>
      )}

      {(live || timeline.length > 0) && (
        <div className="panel">
          <div className="panel-head"><h3>Lances da partida</h3></div>
          {timeline.length === 0 ? (
            <div className="ga-empty" style={{ padding: "14px 18px" }}>Nenhum lance registrado ainda.</div>
          ) : (
            <ul className="timeline">
              {timeline.map((ev) => (
                <TimelineItem
                  key={ev.id}
                  ev={ev}
                  athleteName={athleteName}
                  onEdit={isAdmin ? () => setEditEv(ev) : undefined}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {(m.scorers.length > 0 || m.assists.length > 0) && (
        <div className="panel">
          <div className="panel-head"><h3>Resumo</h3></div>
          <div className="detail-body">
            {m.scorers.length > 0 && (
              <p><b>⚽ Gols:</b> {m.scorers.slice().sort((a, b) => b.g - a.g)
                .map((x) => `${athleteName(x.a)}${x.g > 1 ? ` (${x.g})` : ""}`).join(", ")}</p>
            )}
            {m.assists.length > 0 && (
              <p><b>🅰️ Assistências:</b> {m.assists.slice().sort((a, b) => b.n - a.n)
                .map((x) => `${athleteName(x.a)}${x.n > 1 ? ` (${x.n})` : ""}`).join(", ")}</p>
            )}
          </div>
        </div>
      )}

      {m.lineup.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <h3>Escalação <span className="sub" style={{ display: "inline" }}>· {m.lineup.length} relacionados</span></h3>
          </div>
          <div className="detail-body">
            {tac && tacCur && (
              <>
                <div className="phase-tabs">
                  <button className={`chip ${tacPhase === "com" ? "on" : ""}`} onClick={() => setTacPhase("com")}>
                    ⚽ Com bola · {tac.com.formation}
                  </button>
                  <button className={`chip ${tacPhase === "sem" ? "on" : ""}`} onClick={() => setTacPhase("sem")}>
                    🛡️ Sem bola · {tac.sem.formation}
                  </button>
                  {tac.bp && (
                    <button className={`chip ${tacPhase === "bp" ? "on" : ""}`} onClick={() => setTacPhase("bp")}>
                      🎯 Bola parada
                    </button>
                  )}
                </div>
                <Pitch
                  formation={getFormation(tacCur.formation)}
                  slots={tacCur.slots}
                  coords={tacCur.coords}
                  nameOf={athleteName}
                />
                {cobradores && (
                  <div className="cobradores">
                    {cobradores.penalti && <span>🥅 Pênalti: <b>{athleteName(cobradores.penalti)}</b></span>}
                    {cobradores.falta && <span>🎯 Falta: <b>{athleteName(cobradores.falta)}</b></span>}
                    {cobradores.escanteio_e && <span>⛳ Esc. esq.: <b>{athleteName(cobradores.escanteio_e)}</b></span>}
                    {cobradores.escanteio_d && <span>⛳ Esc. dir.: <b>{athleteName(cobradores.escanteio_d)}</b></span>}
                  </div>
                )}
              </>
            )}
            {starters.length > 0 && (
              <>
                <div className="esc-label">★ Titulares ({starters.length})</div>
                <div className="chips" style={{ marginBottom: 10 }}>
                  {starters.map((aid) => (
                    <span key={aid} className="chip static on">{athleteName(aid)}{pos(aid)}</span>
                  ))}
                </div>
              </>
            )}
            {bench.length > 0 && (
              <>
                {starters.length > 0 && <div className="esc-label">Banco ({bench.length})</div>}
                <div className="chips">
                  {bench.map((aid) => (
                    <span key={aid} className="chip static">{athleteName(aid)}{pos(aid)}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {isAdmin && m.status === "encerrada" && (
        <div className="row-gap" style={{ marginTop: 8, flexWrap: "wrap" }}>
          <button className="btn ghost-light block" onClick={() => setEditing(true)}>Editar partida</button>
          {!schemaLegacy && (
            <button className="btn ghost-light block" onClick={() => {
              upsertMatch({ ...m, archived: !m.archived });
              toast(m.archived ? "Partida desarquivada" : "Partida arquivada (fora das estatísticas)");
            }}>
              {m.archived ? "Desarquivar" : "Arquivar (sai das estatísticas)"}
            </button>
          )}
          <button className="btn ghost-light block" onClick={() => {
            if (confirm("Zerar e REAGENDAR esta partida? Placar, gols e lances são apagados (escalação, local e horário ficam). Bom para desfazer um teste ou um encerramento por engano.")) {
              resetToScheduled(m);
            }
          }}>
            ↩ Zerar e reagendar
          </button>
          <button className="btn danger block" onClick={() => {
            if (confirm(`Excluir a partida contra ${m.opponent} (${fmtDate(m.date)})?\n\nEssa ação não pode ser desfeita.`)) {
              deleteMatch(m.id); navigate("#/partidas");
            }
          }}>Excluir</button>
        </div>
      )}

      {editing && <MatchForm match={m} onClose={() => setEditing(false)} />}
      {goalPicker && (
        <GoalPicker
          match={m}
          onCancel={() => setGoalPicker(false)}
          onConfirm={(scorerId, assistId) => { setGoalPicker(false); fire("gol_pro", { scorerId, assistId }); }}
        />
      )}
      {subPicker && (
        <SubPicker
          match={m}
          onField={onField}
          onCancel={() => setSubPicker(false)}
          onConfirm={(inId, outId) => { setSubPicker(false); fire("sub", { inId, outId }); }}
        />
      )}
      {art && (
        <Modal
          title={artKind === "convocacao"
            ? art.length > 1 ? "🖼️ Artes da convocação" : "🖼️ Arte da convocação"
            : "🖼️ Arte do resultado"}
          onClose={() => setArt(null)}
          footer={
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => setArt(null)}>Fechar</button>
          }
        >
          {art.map((item) => (
            <div key={item.file} className="art-item">
              {art.length > 1 && <div className="esc-label">{item.label}</div>}
              <img src={item.url} alt={item.label} style={{ width: "100%", borderRadius: 10, display: "block" }} />
              <div className="row-gap" style={{ margin: "8px 0 16px" }}>
                <button className="btn ghost" style={{ flex: 1 }} onClick={() => downloadArt(item)}>↓ Baixar</button>
                {artKind === "convocacao" && (
                  <button className="btn wa" style={{ flex: 1.4 }} onClick={() => shareWhatsApp(item)}>WhatsApp</button>
                )}
                <button className="btn primary" style={{ flex: artKind === "convocacao" ? 1.4 : 2 }} onClick={() => shareArt(item)}>
                  Compartilhar
                </button>
              </div>
            </div>
          ))}
          <p className="muted" style={{ fontSize: 13, marginTop: 2 }}>
            {artKind === "convocacao"
              ? "O botão WhatsApp envia a arte já com a legenda: apresentação, bolas e uniforme. No computador, ele baixa o PNG e abre o WhatsApp com a legenda pronta para colar."
              : "No celular, “Compartilhar” abre direto o WhatsApp / Instagram. Se o aparelho não suportar, o botão baixa o PNG."}
          </p>
        </Modal>
      )}
      {editEv && (
        <EventEditModal
          ev={editEv}
          onClose={() => setEditEv(null)}
          onSave={(patch) => { updateEvent(editEv, patch); setEditEv(null); }}
          onDelete={() => {
            if (confirm("Excluir este lance da linha do tempo?\n\nO placar não muda — se for um gol, ajuste o resultado em \"Editar partida\".")) {
              deleteEvent(editEv); setEditEv(null);
            }
          }}
        />
      )}
    </>
  );
}

/** Legenda da convocação para o WhatsApp: confronto, data/horário, local e a
    logística (apresentação, bolas e uniforme) — só as linhas preenchidas. */
function convocacaoCaption(m: Match): string {
  const lines = [
    `📋 *Convocação · ${TEAM.short} × ${m.opponent}*`,
    `🗓 ${fmtDate(m.date)}${m.kickoff ? `  ·  ⏰ Jogo às ${m.kickoff}` : ""}`,
  ];
  if (m.venue) lines.push(`📍 ${m.venue}`);
  if (m.meet_time) lines.push(`🕒 Apresentação: ${m.meet_time}`);
  if (m.ball_holder) lines.push(`⚽ Bolas com: ${m.ball_holder}`);
  if (m.kit_holder) lines.push(`👕 Uniforme${m.kit ? ` ${m.kit}` : ""} com: ${m.kit_holder}`);
  else if (m.kit) lines.push(`👕 Uniforme: ${m.kit}`);
  return lines.join("\n");
}

/** Ordena lances por período → minuto → instante de registro (crescente).
    Lance sem minuto (ex.: "Bola rolando", registrado antes do relógio existir)
    fica no começo do período, não no fim. */
function cmpChrono(a: MatchEvent, b: MatchEvent): number {
  const pa = a.payload?.period ?? 1, pb = b.payload?.period ?? 1;
  if (pa !== pb) return pa - pb;
  const ma = a.minute ?? Number.NEGATIVE_INFINITY, mb = b.minute ?? Number.NEGATIVE_INFINITY;
  if (ma !== mb) return ma - mb;
  return a.created_at < b.created_at ? -1 : a.created_at > b.created_at ? 1 : 0;
}

/* payload.title chega com emoji embutido (bom para as notificações); na linha
   do tempo o emoji vira o ícone da linha e sai do texto, senão aparece dobrado */
function iconAndText(raw: string, fallback: string): { icon: string; text: string } {
  const lead = raw.match(/^[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+/u);
  if (lead) return { icon: lead[0], text: raw.slice(lead[0].length).trim() || raw };
  const trail = raw.match(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+$/u);
  if (trail) return { icon: trail[0], text: raw.slice(0, raw.length - trail[0].length).trim() || raw };
  return { icon: fallback, text: raw };
}

function TimelineItem({ ev, athleteName, onEdit }: {
  ev: MatchEvent; athleteName: (id: string) => string; onEdit?: () => void;
}) {
  const title = ev.payload?.title || EVENT_LABEL[ev.type] || ev.type;
  let body = ev.payload?.body || "";
  // lances migrados do app antigo não têm texto pronto — monta na hora
  if (!ev.payload?.title) {
    if (ev.type === "gol_pro" && ev.athlete_id) {
      body = `${athleteName(ev.athlete_id)}${ev.assist_id ? ` (assist. ${athleteName(ev.assist_id)})` : ""}`;
    } else if (ev.type === "sub") {
      const inId = ev.payload?.in || ev.athlete_id;
      const outId = ev.payload?.out || ev.assist_id;
      body = `Entra ${inId ? athleteName(inId) : "?"}, sai ${outId ? athleteName(outId) : "?"}`;
    }
  }
  const { icon, text } = iconAndText(title, EVENT_ICON[ev.type] || "•");
  return (
    <li className={`tl-item ${ev.type}`}>
      <span className="tl-min num">{fmtEventMinute(ev.minute, ev.payload?.period)}</span>
      <span className="tl-ic">{icon}</span>
      <span className="tl-txt">
        <b>{text}</b>
        {body && <span className="tl-body">{body}</span>}
      </span>
      {onEdit && (
        <button className="tl-edit" onClick={onEdit} aria-label="Editar lance" title="Editar tempo do lance">✎</button>
      )}
    </li>
  );
}

/** Corrige o tempo (período + minuto) de um lance já registrado. */
function EventEditModal({ ev, onClose, onSave, onDelete }: {
  ev: MatchEvent;
  onClose: () => void;
  onSave: (patch: { minute: number | null; period: number }) => void;
  onDelete: () => void;
}) {
  const [period, setPeriod] = useState<number>(ev.payload?.period ?? 1);
  const [minute, setMinute] = useState<string>(ev.minute != null ? String(ev.minute) : "");
  const label = ev.payload?.title || EVENT_LABEL[ev.type] || ev.type;
  return (
    <Modal
      title="✎ Editar lance"
      onClose={onClose}
      footer={
        <>
          <button className="btn danger" style={{ flex: 1 }} onClick={onDelete}>Excluir</button>
          <button className="btn primary" style={{ flex: 2 }}
            onClick={() => onSave({ minute: minute === "" ? null : Math.max(0, parseInt(minute) || 0), period })}>
            Salvar
          </button>
        </>
      }
    >
      <div className="subhead"><div className="t">{label}</div></div>
      <div className="subhead"><div className="t">Período</div></div>
      <div className="chips">
        <button className={`chip ${period === 1 ? "on" : ""}`} onClick={() => setPeriod(1)}>1º tempo</button>
        <button className={`chip ${period === 2 ? "on" : ""}`} onClick={() => setPeriod(2)}>2º tempo</button>
      </div>
      <div className="subhead"><div className="t">Minuto</div></div>
      <input
        type="number" className="fb-num" min={0} placeholder="min" autoFocus
        value={minute}
        onChange={(e) => setMinute(e.target.value)}
        style={{ width: 120 }}
      />
      <p className="muted" style={{ fontSize: 13, marginTop: 12 }}>
        Só o tempo do lance é ajustado — o placar não muda. Para trocar o autor de um gol, use “Editar partida”.
      </p>
    </Modal>
  );
}

function GoalPicker({ match, onCancel, onConfirm }: {
  match: Match;
  onCancel: () => void;
  onConfirm: (scorerId?: string, assistId?: string) => void;
}) {
  const { roster } = useStore();
  const [scorer, setScorer] = useState<string | undefined>();
  const [assist, setAssist] = useState<string | undefined>();
  const [showAll, setShowAll] = useState(match.lineup.length === 0);
  const options = (showAll ? roster : roster.filter((a) => match.lineup.includes(a.id)))
    .slice().sort((a, b) =>
      posRank(match.positions?.[a.id]) - posRank(match.positions?.[b.id]) ||
      a.name.localeCompare(b.name, "pt"));
  return (
    <Modal
      title="⚽ Gol do Proleta!"
      onClose={onCancel}
      footer={
        <>
          <button className="btn ghost" style={{ flex: 1 }} onClick={onCancel}>Cancelar</button>
          <button className="btn primary" style={{ flex: 2 }} onClick={() => onConfirm(scorer, assist)}>
            Confirmar gol
          </button>
        </>
      }
    >
      <div className="subhead"><div className="t">Quem marcou?</div></div>
      <div className="chips">
        {options.map((a) => (
          <button key={a.id} className={`chip ${scorer === a.id ? "on" : ""}`}
            onClick={() => setScorer(scorer === a.id ? undefined : a.id)}>{a.name}</button>
        ))}
      </div>
      <div className="subhead"><div className="t">Assistência (opcional)</div></div>
      <div className="chips">
        {options.filter((a) => a.id !== scorer).map((a) => (
          <button key={a.id} className={`chip ${assist === a.id ? "on" : ""}`}
            onClick={() => setAssist(assist === a.id ? undefined : a.id)}>{a.name}</button>
        ))}
      </div>
      {!showAll && (
        <p style={{ marginTop: 14 }}>
          <button className="linklike" onClick={() => setShowAll(true)}>
            Não está na lista? Mostrar o elenco completo
          </button>
        </p>
      )}
      <p className="muted" style={{ fontSize: 13, marginTop: 10 }}>
        Sem marcador definido? Confirme sem selecionar — dá para corrigir depois editando a partida.
      </p>
    </Modal>
  );
}

function SubPicker({ match, onField, onCancel, onConfirm }: {
  match: Match;
  onField: Set<string>;
  onCancel: () => void;
  onConfirm: (inId: string, outId: string) => void;
}) {
  const { roster } = useStore();
  const [inId, setInId] = useState<string | undefined>();
  const [outId, setOutId] = useState<string | undefined>();
  const [showAll, setShowAll] = useState(false);
  const byPos = (a: { id: string; name: string }, b: { id: string; name: string }) =>
    posRank(match.positions?.[a.id]) - posRank(match.positions?.[b.id]) ||
    a.name.localeCompare(b.name, "pt");
  const related = roster.filter((a) => match.lineup.includes(a.id));
  // "sai" = quem está em campo agora; "entra" = relacionados que estão fora
  // (banco). Atualiza a cada substituição feita durante o jogo.
  const outOptions = related.filter((a) => onField.has(a.id)).sort(byPos);
  const benchOptions = related.filter((a) => !onField.has(a.id));
  const inOptions = (showAll ? roster.filter((a) => !onField.has(a.id)) : benchOptions)
    .slice().sort(byPos);
  return (
    <Modal
      title="🔁 Substituição"
      onClose={onCancel}
      footer={
        <>
          <button className="btn ghost" style={{ flex: 1 }} onClick={onCancel}>Cancelar</button>
          <button className="btn primary" style={{ flex: 2 }} disabled={!inId || !outId}
            onClick={() => inId && outId && onConfirm(inId, outId)}>
            Confirmar
          </button>
        </>
      }
    >
      <div className="subhead"><div className="t">Quem sai? <span className="muted">(em campo)</span></div></div>
      <div className="chips">
        {outOptions.length === 0
          ? <span className="muted" style={{ fontSize: 13 }}>Ninguém em campo registrado — escale os titulares na partida.</span>
          : outOptions.filter((a) => a.id !== inId).map((a) => (
              <button key={a.id} className={`chip ${outId === a.id ? "on" : ""}`}
                onClick={() => setOutId(outId === a.id ? undefined : a.id)}>{a.name}</button>
            ))}
      </div>
      <div className="subhead"><div className="t">Quem entra? <span className="muted">(banco)</span></div></div>
      <div className="chips">
        {inOptions.length === 0
          ? <span className="muted" style={{ fontSize: 13 }}>Sem jogadores no banco.</span>
          : inOptions.filter((a) => a.id !== outId).map((a) => (
              <button key={a.id} className={`chip ${inId === a.id ? "on" : ""}`}
                onClick={() => setInId(inId === a.id ? undefined : a.id)}>{a.name}</button>
            ))}
      </div>
      {!showAll && (
        <p style={{ marginTop: 14 }}>
          <button className="linklike" onClick={() => setShowAll(true)}>
            Vai entrar quem não está relacionado? Mostrar o elenco completo
          </button>
        </p>
      )}
    </Modal>
  );
}
