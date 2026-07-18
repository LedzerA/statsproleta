import { useEffect, useState } from "react";

export type Route =
  | { view: "inicio" }
  | { view: "partidas"; nova?: boolean }
  | { view: "partida"; id: string; editar?: boolean }
  | { view: "atletas" }
  | { view: "atleta"; id: string }
  | { view: "adversarios" }
  | { view: "comparativo" }
  | { view: "mais" };

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  switch (parts[0]) {
    case "partidas": return { view: "partidas", nova: parts[1] === "nova" };
    case "partida": return parts[1]
      ? { view: "partida", id: parts[1], editar: parts[2] === "editar" }
      : { view: "partidas" };
    case "atletas": return { view: "atletas" };
    case "atleta": return parts[1] ? { view: "atleta", id: parts[1] } : { view: "atletas" };
    case "adversarios": return { view: "adversarios" };
    case "comparativo": return { view: "comparativo" };
    case "mais": return { view: "mais" };
    default: return { view: "inicio" };
  }
}

export function navigate(path: string) {
  window.location.hash = path;
}

/* Guarda de navegação: um formulário com alterações pendentes registra um
   interceptador que segura QUALQUER troca de rota (voltar do navegador
   incluso) até decidir se ela prossegue — chama proceed() para deixar sair. */
type NavGuard = (proceed: () => void) => void;
let navGuard: NavGuard | null = null;
export function setNavGuard(g: NavGuard | null) {
  navGuard = g;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    let current = window.location.hash;
    let bypass = false;
    const on = () => {
      const next = window.location.hash;
      if (next === current) return;
      if (navGuard && !bypass) {
        const target = next;
        const guard = navGuard;
        window.location.hash = current; // desfaz já — o guard decide se prossegue
        guard(() => { bypass = true; window.location.hash = target; });
        return;
      }
      bypass = false;
      current = next;
      setRoute(parse(next));
    };
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
