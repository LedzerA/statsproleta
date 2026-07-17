import { useState } from "react";
import { useStore } from "../state/store";
import { Modal } from "./ui";

export default function LoginModal({ onClose }: { onClose: () => void }) {
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
