import { useEffect, useState } from "react";

export type Route =
  | { view: "inicio" }
  | { view: "partidas"; nova?: boolean }
  | { view: "partida"; id: string }
  | { view: "atletas" }
  | { view: "adversarios" }
  | { view: "mais" };

function parse(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  switch (parts[0]) {
    case "partidas": return { view: "partidas", nova: parts[1] === "nova" };
    case "partida": return parts[1] ? { view: "partida", id: parts[1] } : { view: "partidas" };
    case "atletas": return { view: "atletas" };
    case "adversarios": return { view: "adversarios" };
    case "mais": return { view: "mais" };
    default: return { view: "inicio" };
  }
}

export function navigate(path: string) {
  window.location.hash = path;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parse(window.location.hash));
  useEffect(() => {
    const on = () => setRoute(parse(window.location.hash));
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}
