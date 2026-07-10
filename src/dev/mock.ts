/* Modo MOCK (só desenvolvimento): intercepta as chamadas REST do Supabase
   e responde com os dados de exemplo — permite ver o app inteiro sem
   backend. Ativar com:  npm run dev:mock  */
import data from "./mock-data.json";

const TABLES: Record<string, any[]> = {
  squads: data.squads,
  athletes: data.athletes,
  matches: data.matches,
  match_events: data.match_events,
  admins: [],
};

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const m = url.match(/\/rest\/v1\/(\w+)(\?|$)/);
  if (m && TABLES[m[1]]) {
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();
    if (method === "GET" || method === "HEAD") {
      let rows = TABLES[m[1]];
      const u = new URL(url, location.href);
      for (const [k, v] of u.searchParams) {
        const eq = /^eq\.(.*)$/.exec(v);
        if (k !== "select" && k !== "order" && eq) rows = rows.filter((r) => String(r[k]) === eq[1]);
      }
      return new Response(JSON.stringify(rows), {
        status: 200, headers: { "Content-Type": "application/json" },
      });
    }
    // escrita no mock: finge sucesso
    return new Response("[]", { status: 200, headers: { "Content-Type": "application/json" } });
  }
  return realFetch(input as any, init);
};

console.info("%c[MOCK] Supabase simulado — dados de exemplo, nada é salvo.", "color:#e6b94b");
