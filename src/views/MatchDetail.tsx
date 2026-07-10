import { useEffect, useState } from "react";
import { useStore } from "../state/store";
import { navigate } from "../lib/router";
import { TEAM } from "../config";
import { fmtDate, isLive, result, resWord, statusLabel } from "../lib/format";
import { Modal } from "../components/ui";
import MatchForm from "./MatchForm";
import type { EventType, Match, MatchEvent } from "../lib/types";

const EVENT_ICON: Record<EventType, string> = {
  inicio: "🔴", gol_pro: "⚽", gol_contra: "😕",
  penalti_pro: "🎯", penalti_contra: "⚠️",
  fim_1t: "⏸️", inicio_2t: "▶️", fim_jogo: "🏁",
};

export default function MatchDetail({ id }: { id: string }) {
  const { matches, roster, isAdmin, events, loadEvents, addEvent, deleteMatch } = useStore();
  const [editing, setEditing] = useState(false);
  const [goalPicker, setGoalPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const m = matches.find((x) => x.id === id);
  useEffect(() => { if (m) loadEvents(m.id); }, [id]);

  if (!m) {
    return (
      <div className="empty">
        <h3>Partida não encontrada</h3>
        <button className="btn" onClick={() => navigate("#/partidas")}>← Voltar às partidas</button>
      </div>
    );
  }

  const nameOf = (aid: string) => roster.find((a) => a.id === aid)?.name || "?";
  const live = isLive(m.status);
  const timeline = (events[m.id] || []).slice().reverse();

  async function fire(type: EventType, opts?: { scorerId?: string; assistId?: string }) {
    if (busy) return;
    setBusy(true);
    try { await addEvent(m!, type, opts); } finally { setBusy(false); }
  }

  function confirmFire(msg: string, type: EventType) {
    if (confirm(msg)) fire(type);
  }

  return (
    <>
      <button className="back-link" onClick={() => navigate("#/partidas")}>← Partidas</button>

      <div className={`score-hero ${live ? "live" : ""}`}>
        <div className="sh-status">
          {live && <span className="pulse" />}
          {m.status === "agendada" ? `Agendada · ${fmtDate(m.date)}`
            : live ? `AO VIVO · ${statusLabel(m.status)}`
            : `${resWord(result(m))} · ${fmtDate(m.date)}`}
        </div>
        <div className="sh-teams">
          <div className="sh-team">{TEAM.short}</div>
          <div className="sh-score num">
            {m.status === "agendada" ? "×" : `${m.goals_for} × ${m.goals_against}`}
          </div>
          <div className="sh-team">{m.opponent}</div>
        </div>
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
              {timeline.map((ev) => <TimelineItem key={ev.id} ev={ev} />)}
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
                .map((x) => `${nameOf(x.a)}${x.g > 1 ? ` (${x.g})` : ""}`).join(", ")}</p>
            )}
            {m.assists.length > 0 && (
              <p><b>🅰️ Assistências:</b> {m.assists.slice().sort((a, b) => b.n - a.n)
                .map((x) => `${nameOf(x.a)}${x.n > 1 ? ` (${x.n})` : ""}`).join(", ")}</p>
            )}
          </div>
        </div>
      )}

      {m.lineup.length > 0 && (
        <div className="panel">
          <div className="panel-head">
            <h3>Relacionados <span className="sub" style={{ display: "inline" }}>· {m.lineup.length}</span></h3>
          </div>
          <div className="detail-body chips" style={{ padding: "14px 18px" }}>
            {m.lineup.map((aid) => <span key={aid} className="chip static">{nameOf(aid)}</span>)}
          </div>
        </div>
      )}

      {isAdmin && m.status === "encerrada" && (
        <div className="row-gap" style={{ marginTop: 8 }}>
          <button className="btn ghost-light block" onClick={() => setEditing(true)}>Editar partida</button>
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
          onCancel={() => setGoalPicker(false)}
          onConfirm={(scorerId, assistId) => { setGoalPicker(false); fire("gol_pro", { scorerId, assistId }); }}
        />
      )}
    </>
  );
}

function TimelineItem({ ev }: { ev: MatchEvent }) {
  return (
    <li className={`tl-item ${ev.type}`}>
      <span className="tl-min num">{ev.minute != null ? `${ev.minute}'` : ""}</span>
      <span className="tl-ic">{EVENT_ICON[ev.type] || "•"}</span>
      <span className="tl-txt">
        <b>{ev.payload?.title || ev.type}</b>
        {ev.payload?.body && <span className="tl-body">{ev.payload.body}</span>}
      </span>
    </li>
  );
}

function GoalPicker({ onCancel, onConfirm }: {
  onCancel: () => void;
  onConfirm: (scorerId?: string, assistId?: string) => void;
}) {
  const { roster } = useStore();
  const [scorer, setScorer] = useState<string | undefined>();
  const [assist, setAssist] = useState<string | undefined>();
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
        {roster.map((a) => (
          <button key={a.id} className={`chip ${scorer === a.id ? "on" : ""}`}
            onClick={() => setScorer(scorer === a.id ? undefined : a.id)}>{a.name}</button>
        ))}
      </div>
      <div className="subhead"><div className="t">Assistência (opcional)</div></div>
      <div className="chips">
        {roster.filter((a) => a.id !== scorer).map((a) => (
          <button key={a.id} className={`chip ${assist === a.id ? "on" : ""}`}
            onClick={() => setAssist(assist === a.id ? undefined : a.id)}>{a.name}</button>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 13, marginTop: 14 }}>
        Sem marcador definido? Confirme sem selecionar — dá para corrigir depois editando a partida.
      </p>
    </Modal>
  );
}
