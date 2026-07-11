import type { ReactNode } from "react";
import type { Result } from "../lib/types";

export function Modal({ title, onClose, children, footer }: {
  title: string; onClose: () => void; children: ReactNode; footer?: ReactNode;
}) {
  return (
    <div className="overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal">
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Fechar">×</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ icon = "⚽", title, sub, action }: {
  icon?: string; title: string; sub: string; action?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="big">{icon}</div>
      <h3>{title}</h3>
      <p>{sub}</p>
      {action && <div style={{ marginTop: 16 }}>{action}</div>}
    </div>
  );
}

export function FormDots({ form, label }: { form: Result[]; label?: string }) {
  const dots = form.length ? form : null;
  return (
    <div className="form-dots">
      {label && <span className="lbl">{label}</span>}
      {dots
        ? dots.map((r, i) => <span key={i} className={`dot ${r.toLowerCase()}`}>{r}</span>)
        : <span className="dot empty" />}
    </div>
  );
}

export function ResultBadge({ r }: { r: Result }) {
  return <span className={`mc-badge ${r.toLowerCase()}`}>{r}</span>;
}

export function Stepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="stepper">
      <button type="button" onClick={() => onChange(Math.max(0, value - 1))} aria-label="Diminuir">−</button>
      <span className={`val ${value ? "" : "zero"}`}>{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} aria-label="Aumentar">+</button>
    </div>
  );
}

export function Spinner() {
  return (
    <div className="boot">
      <div className="ball-spin" />
      <p>Carregando…</p>
    </div>
  );
}
