// Edge Function: envia Web Push para todos os aparelhos inscritos
// quando um lance (match_event) é inserido.
//
// Deploy:   supabase functions deploy send-push --no-verify-jwt
// Secrets:  supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:seu@email.com
// Gatilho:  Database Webhook em public.match_events (INSERT) -> esta função (ver README).
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC_KEY") || "";
const VAPID_PRIVATE = Deno.env.get("VAPID_PRIVATE_KEY") || "";
const VAPID_SUBJECT = Deno.env.get("VAPID_SUBJECT") || "mailto:admin@example.com";

Deno.serve(async (req) => {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    return new Response("VAPID keys não configuradas", { status: 500 });
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

  let body: any;
  try { body = await req.json(); } catch { return new Response("bad request", { status: 400 }); }

  // payload do Database Webhook: { type: "INSERT", table, record, ... }
  const record = body?.record;
  if (body?.type !== "INSERT" || !record?.payload?.title) {
    return new Response("ignored", { status: 200 });
  }

  const notification = JSON.stringify({
    title: record.payload.title,
    body: record.payload.body || "",
    tag: record.id, // mesmo tag da notificação em primeiro plano -> sem duplicata
    url: `./#/partida/${record.match_id}`,
  });

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/push_subscriptions?select=endpoint,p256dh,auth`,
    { headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` } }
  );
  const subs: { endpoint: string; p256dh: string; auth: string }[] = await res.json();

  let sent = 0, removed = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          notification
        );
        sent++;
      } catch (err: any) {
        // assinatura expirada/revogada -> limpa da tabela
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          removed++;
          await fetch(
            `${SUPABASE_URL}/rest/v1/push_subscriptions?endpoint=eq.${encodeURIComponent(s.endpoint)}`,
            {
              method: "DELETE",
              headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
            }
          );
        } else {
          console.error("push error:", err?.statusCode, err?.message);
        }
      }
    })
  );

  return new Response(JSON.stringify({ sent, removed, total: subs.length }), {
    headers: { "Content-Type": "application/json" },
  });
});
