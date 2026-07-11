import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { navigate } from "../lib/router";
import { TEAM } from "../config";
import {
  clockSeconds, fmtClock, fmtDate, fmtEventMinute, isLive, result, resWord, statusLabel,
} from "../lib/format";
import { Modal } from "../components/ui";
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
    findMatch, roster, athleteName, isAdmin, schemaLegacy,
    events, loadEvents, addEvent, toggleClock, deleteMatch, upsertMatch, toast,
  } = useStore();
  const [editing, setEditing] = useState(false);
  const [goalPicker, setGoalPicker] = useState(false);
  const [subPicker, setSubPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const m = findMatch(id);
  useEffect(() => { if (m) loadEvents(m.id); }, [id]);

  if (!m) {
    return (
      <div className="empty">
        <h3>Partida não encontrada</h3>
        <button className="btn" onClick={() => navigate("#/partidas")}>← Voltar às partidas</button>
      </div>
    );
  }

  const live = isLive(m.status);
  const timeline = (events[m.id] || []).slice().reverse();
  const starters = m.starters || [];
  const bench = (m.lineup || []).filter((aid) => !starters.includes(aid));
  const pos = (aid: string) => (m.positions?.[aid] ? ` · ${m.positions[aid]}` : "");

  async function fire(type: EventType, opts?: { scorerId?: string; assistId?: string; inId?: string; outId?: string }) {
    if (busy) return;
    setBusy(true);
    try { await addEvent(m!, type, opts); } finally { setBusy(false); }
  }

  function confirmFire(msg: string, type: EventType) {
    if (confirm(msg)) fire(type);
  }

  const infoBits = [
    m.venue && `📍 ${m.venue}`,
    m.kickoff && `🕒 ${m.kickoff}`,
    m.kit && `👕 ${m.kit}`,
  ].filter(Boolean) as string[];

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
        {infoBits.length > 0 && <div className="sh-info">{infoBits.join("   ·   ")}</div>}
      </div>

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
        </div>
      )}

      {(live || timeline.length > 0) && (
        <div className="panel">
          <div className="panel-head"><h3>Lances da partida</h3></div>
          {timeline.length === 0 ? (
            <div className="ga-empty" style={{ padding: "14px 18px" }}>Nenhum lance registrado ainda.</div>
          ) : (
            <ul className="timeline">
              {timeline.map((ev) => <TimelineItem key={ev.id} ev={ev} athleteName={athleteName} />)}
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
          onCancel={() => setSubPicker(false)}
          onConfirm={(inId, outId) => { setSubPicker(false); fire("sub", { inId, outId }); }}
        />
      )}
    </>
  );
}

function TimelineItem({ ev, athleteName }: { ev: MatchEvent; athleteName: (id: string) => string }) {
  let title = ev.payload?.title || EVENT_LABEL[ev.type] || ev.type;
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
  return (
    <li className={`tl-item ${ev.type}`}>
      <span className="tl-min num">{fmtEventMinute(ev.minute, ev.payload?.period)}</span>
      <span className="tl-ic">{EVENT_ICON[ev.type] || "•"}</span>
      <span className="tl-txt">
        <b>{title}</b>
        {body && <span className="tl-body">{body}</span>}
      </span>
    </li>
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
  const options = showAll ? roster : roster.filter((a) => match.lineup.includes(a.id));
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

function SubPicker({ match, onCancel, onConfirm }: {
  match: Match;
  onCancel: () => void;
  onConfirm: (inId: string, outId: string) => void;
}) {
  const { roster } = useStore();
  const [inId, setInId] = useState<string | undefined>();
  const [outId, setOutId] = useState<string | undefined>();
  const related = roster.filter((a) => match.lineup.includes(a.id));
  const starters = match.starters || [];
  // sugestões: sai quem é titular, entra quem está no banco — mas ambos livres
  const inFirst = [...related].sort((a, b) =>
    Number(starters.includes(a.id)) - Number(starters.includes(b.id)));
  const outFirst = [...related].sort((a, b) =>
    Number(starters.includes(b.id)) - Number(starters.includes(a.id)));
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
      <div className="subhead"><div className="t">Quem entra?</div></div>
      <div className="chips">
        {inFirst.filter((a) => a.id !== outId).map((a) => (
          <button key={a.id} className={`chip ${inId === a.id ? "on" : ""}`}
            onClick={() => setInId(inId === a.id ? undefined : a.id)}>{a.name}</button>
        ))}
      </div>
      <div className="subhead"><div className="t">Quem sai?</div></div>
      <div className="chips">
        {outFirst.filter((a) => a.id !== inId).map((a) => (
          <button key={a.id} className={`chip ${outId === a.id ? "on" : ""}`}
            onClick={() => setOutId(outId === a.id ? undefined : a.id)}>{a.name}</button>
        ))}
      </div>
    </Modal>
  );
}
