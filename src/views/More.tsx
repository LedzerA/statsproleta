import { useEffect, useRef, useState } from "react";
import { useStore } from "../state/store";
import { VAPID_PUBLIC_KEY } from "../config";
import { pushSupported, subscribePush, unsubscribePush, getSubscription } from "../lib/push";
import { dec, fmtDate, pct, resWord, result, sortMatches } from "../lib/format";
import { Modal } from "../components/ui";

function download(filename: string, text: string, type = "application/json") {
  const blob = new Blob(["﻿" + text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}
const stamp = () => new Date().toISOString().slice(0, 10);

export default function More() {
  const {
    squad, squads, roster, matches, squadMatches, stats, session, isAdmin,
    signOut, addSquad, importBackup, wipeMatches, toast,
  } = useStore();
  const [login, setLogin] = useState(false);
  const [newSquad, setNewSquad] = useState("");
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleImportFile(file: File) {
    let raw: unknown;
    try {
      raw = JSON.parse(await file.text());
    } catch {
      alert("Arquivo inválido. Selecione um backup .json exportado por este app (v1 ou v2).");
      return;
    }
    if (!confirm(
      `Importar este backup para o elenco ${squad?.name}?\n\n` +
      "ATENÇÃO: os atletas e partidas atuais DESTE elenco serão substituídos pelos do arquivo."
    )) return;
    setImporting(true);
    try {
      const res = await importBackup(raw);
      toast(`Backup importado ✓ (${res.athletes} atletas, ${res.matches} partidas)`);
    } catch (e: any) {
      console.error(e);
      alert(e?.message === "formato"
        ? "Arquivo inválido. Selecione um backup .json exportado por este app (v1 ou v2)."
        : "Erro ao importar. Verifique a conexão e tente de novo.");
    } finally {
      setImporting(false);
    }
  }

  useEffect(() => { getSubscription().then((s) => setPushOn(!!s)); }, []);

  async function togglePush() {
    if (pushBusy) return;
    setPushBusy(true);
    try {
      if (pushOn) {
        await unsubscribePush();
        setPushOn(false);
        toast("Notificações desativadas");
        return;
      }
      const res = await subscribePush(squad?.id || "");
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
      alert(msg + (res.detail ? `\n\nDetalhe técnico: ${res.detail}` : ""));
    } finally { setPushBusy(false); }
  }

  function exportJSON() {
    // backup é sempre completo — ignora o filtro de período
    download(`proleta-${squad?.name || "backup"}-${stamp()}.json`,
      JSON.stringify({ version: 2, squad, roster, matches: squadMatches }, null, 2));
    toast("Backup baixado ✓");
  }

  function exportPlayersCSV() {
    const head = ["Atleta", "Jogos", "Gols", "Assistencias", "Participacoes", "Part_por_jogo", "Gols_por_jogo", "V", "E", "D", "Aproveitamento", "Perc_gols_time"];
    const rows = [...stats.players].sort((a, b) => b.part - a.part).map((p) => [
      p.name, p.jogos, p.gols, p.assist, p.part, dec(p.ppj), dec(p.gpj),
      p.v, p.e, p.d, dec(p.aprov * 100, 1), dec(p.share * 100, 1),
    ]);
    download(`proleta-atletas-${stamp()}.csv`,
      [head, ...rows].map((r) => r.join(";")).join("\n"), "text/csv");
    toast("CSV de atletas baixado ✓");
  }

  function exportMatchesCSV() {
    const nameOf = (id: string) => roster.find((a) => a.id === id)?.name || "?";
    const head = ["Data", "Adversario", "Gols_Proleta", "Gols_Adversario", "Resultado", "Marcadores", "Assistencias", "Relacionados"];
    const rows = sortMatches(matches.filter((m) => m.status === "encerrada")).map((m) =>
      [
        m.date, m.opponent, m.goals_for, m.goals_against, resWord(result(m)),
        (m.scorers || []).map((x) => `${nameOf(x.a)}${x.g > 1 ? " x" + x.g : ""}`).join(" / "),
        (m.assists || []).map((x) => `${nameOf(x.a)}${x.n > 1 ? " x" + x.n : ""}`).join(" / "),
        (m.lineup || []).map(nameOf).join(" / "),
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`)
    );
    download(`proleta-partidas-${stamp()}.csv`,
      [head.join(";"), ...rows.map((r) => r.join(";"))].join("\n"), "text/csv");
    toast("CSV de partidas baixado ✓");
  }

  const per = matches.length
    ? `${fmtDate(sortMatches(matches)[0].date)} — ${fmtDate(sortMatches(matches).slice(-1)[0].date)}`
    : "—";

  return (
    <>
      <div className="section-title"><h2>Mais</h2></div>

      <div className="data-cards">
        <div className="data-card">
          <h3>🔔 Notificações ao vivo</h3>
          <p>
            Receba gols, pênaltis e o fim de cada tempo direto no celular, mesmo com o app fechado.
            {!pushSupported && <><br /><b>Este navegador não suporta push.</b> No iPhone, adicione o app à tela de início primeiro.</>}
            {pushSupported && !VAPID_PUBLIC_KEY && <><br /><b>Push ainda não configurado</b> (falta a chave VAPID — ver README).</>}
          </p>
          <button
            className={`btn block ${pushOn ? "ghost" : "primary"}`}
            disabled={!pushSupported || !VAPID_PUBLIC_KEY || pushBusy}
            onClick={togglePush}
          >
            {pushOn ? "Desativar notificações" : "Ativar notificações"}
          </button>
        </div>

        <div className="data-card">
          <h3>Resumo · {squad?.name}</h3>
          <p>
            {matches.length} partidas · {roster.length} atletas no elenco<br />
            Período: {per}<br />
            {stats.team.V}V · {stats.team.E}E · {stats.team.D}D · {pct(stats.team.aprov)} aprov.
          </p>
        </div>

        {isAdmin && (
          <div className="data-card">
            <h3>Exportar dados</h3>
            <p>Planilhas CSV (Excel / Google Sheets) seguem o período filtrado; o backup JSON é sempre completo.</p>
            <button className="btn ghost block" style={{ marginBottom: 8 }} onClick={exportPlayersCSV}>Atletas (CSV)</button>
            <button className="btn ghost block" style={{ marginBottom: 8 }} onClick={exportMatchesCSV}>Partidas (CSV)</button>
            <button className="btn block" onClick={exportJSON}>↓ Backup (JSON)</button>
          </div>
        )}

        {isAdmin && (
          <div className="data-card">
            <h3>Restaurar / importar</h3>
            <p>
              Carrega um backup .json (deste app ou do app antigo) e substitui os atletas e
              partidas do elenco <b>{squad?.name}</b>.
            </p>
            <button className="btn block" disabled={importing} onClick={() => fileRef.current?.click()}>
              {importing ? "Importando…" : "↑ Importar backup (JSON)"}
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                e.target.value = "";
              }}
            />
          </div>
        )}

        {isAdmin && (
          <div className="data-card">
            <h3>Elencos</h3>
            <p>Cada elenco tem atletas, partidas e estatísticas próprias. Atual: <b>{squad?.name}</b> ({squads.length} no total).</p>
            <div className="add-athlete">
              <input
                type="text" placeholder="Nome do novo elenco" value={newSquad} autoComplete="off"
                onChange={(e) => setNewSquad(e.target.value)}
              />
              <button className="btn sm" onClick={() => { addSquad(newSquad); setNewSquad(""); }}>Criar</button>
            </div>
          </div>
        )}

        <div className="data-card">
          <h3>{isAdmin ? "👤 Conta de admin" : "Área da comissão"}</h3>
          {session ? (
            <>
              <p>
                Logado como <b>{session.user.email}</b>
                {isAdmin ? " · admin ✓" : " · sem permissão de admin (peça para um admin te cadastrar)"}
              </p>
              <button className="btn ghost block" onClick={() => { if (confirm("Sair da conta?")) signOut(); }}>
                Sair da conta
              </button>
            </>
          ) : (
            <>
              <p>Visualizar é livre — login é só para a comissão técnica editar dados e comandar partidas ao vivo.</p>
              <button className="btn block" onClick={() => setLogin(true)}>Entrar como admin</button>
            </>
          )}
        </div>

        <div className="data-card">
          <h3>📲 Instalar o app</h3>
          <p>
            No celular, use "Adicionar à tela de início" no menu do navegador — o Proleta vira um app,
            com ícone e tela cheia.
          </p>
        </div>

        {isAdmin && (
          <div className="data-card">
            <h3>⚠️ Zona de perigo</h3>
            <p>Apaga todas as partidas do elenco <b>{squad?.name}</b> (os atletas ficam). Baixe um backup antes.</p>
            <button
              className="btn danger block"
              onClick={() => {
                if (!confirm(`Apagar TODAS as partidas do elenco ${squad?.name}? Essa ação não pode ser desfeita.`)) return;
                if (!confirm("Tem certeza mesmo? Última chance — os dados somem para todo mundo.")) return;
                wipeMatches();
              }}
            >
              Apagar todas as partidas
            </button>
          </div>
        )}
      </div>

      {login && <LoginModal onClose={() => setLogin(false)} />}
    </>
  );
}

function LoginModal({ onClose }: { onClose: () => void }) {
  const { signIn, toast } = useStore();
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim() || !pass) { setErr("Preencha e-mail e senha."); return; }
    setBusy(true); setErr("");
    try {
      await signIn(email.trim(), pass);
      toast("Bem-vindo de volta ✓");
      onClose();
    } catch (e: any) {
      const m = (e?.message || "").toLowerCase();
      setErr(
        m.includes("invalid") ? "E-mail ou senha incorretos."
        : m.includes("email not confirmed") ? "Confirme seu e-mail pelo link enviado e tente de novo."
        : e?.message || "Não foi possível entrar."
      );
    } finally { setBusy(false); }
  }

  return (
    <Modal title="Entrar · comissão técnica" onClose={onClose}
      footer={
        <>
          <button className="btn ghost" style={{ flex: 1 }} onClick={onClose}>Cancelar</button>
          <button className="btn primary" style={{ flex: 2 }} disabled={busy} onClick={submit}>Entrar</button>
        </>
      }
    >
      <div className="field">
        <label>E-mail</label>
        <input type="email" autoComplete="username" placeholder="voce@email.com"
          value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      </div>
      <div className="field">
        <label>Senha</label>
        <input type="password" autoComplete="current-password" placeholder="••••••••"
          value={pass} onChange={(e) => setPass(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
      </div>
      {err && <div className="login-err">{err}</div>}
      <p className="muted" style={{ fontSize: 13 }}>
        Contas de admin são criadas no painel do Supabase (Authentication → Users) e liberadas na
        tabela <code>admins</code> — ver README.
      </p>
    </Modal>
  );
}
