import { sb } from "./supabase";
import { VAPID_PUBLIC_KEY } from "../config";

export const pushSupported =
  "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

export async function registerSW(): Promise<ServiceWorkerRegistration | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    // caminho relativo: funciona em subdiretório do GitHub Pages
    return await navigator.serviceWorker.register("./sw.js");
  } catch (e) {
    console.error("SW register:", e);
    return null;
  }
}

export async function getSubscription(): Promise<PushSubscription | null> {
  if (!pushSupported) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  if (!reg) return null;
  return reg.pushManager.getSubscription();
}

export type PushResult =
  | { ok: true }
  | { ok: false; reason: "unsupported" | "denied" | "sw" | "subscribe" | "server"; detail?: string };

/** Ativa push: pede permissão, assina e grava a assinatura no Supabase. */
export async function subscribePush(squadId: string): Promise<PushResult> {
  if (!pushSupported || !VAPID_PUBLIC_KEY) return { ok: false, reason: "unsupported" };

  const perm = await Notification.requestPermission();
  if (perm !== "granted") return { ok: false, reason: "denied" };

  let reg: ServiceWorkerRegistration | null = null;
  try {
    reg = (await navigator.serviceWorker.getRegistration()) || (await registerSW());
    if (reg) reg = await navigator.serviceWorker.ready; // espera o SW ficar ativo
  } catch (e: any) {
    return { ok: false, reason: "sw", detail: e?.message };
  }
  if (!reg) return { ok: false, reason: "sw" };

  let sub: PushSubscription;
  try {
    sub =
      (await reg.pushManager.getSubscription()) ||
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      }));
  } catch (e: any) {
    console.error("pushManager.subscribe:", e);
    return { ok: false, reason: "subscribe", detail: e?.message };
  }

  const json = sub.toJSON();
  const row = {
    endpoint: sub.endpoint,
    p256dh: json.keys?.p256dh || "",
    auth: json.keys?.auth || "",
    squad_id: squadId,
  };
  // upsert manual (insert -> update se já existe): o upsert do PostgREST
  // exige política de SELECT, que esta tabela não tem de propósito.
  let { error } = await sb.from("push_subscriptions").insert(row);
  if (error && error.code === "23505") {
    ({ error } = await sb.from("push_subscriptions")
      .update({ p256dh: row.p256dh, auth: row.auth, squad_id: row.squad_id })
      .eq("endpoint", row.endpoint));
  }
  if (error) {
    console.error("push_subscriptions:", error);
    return { ok: false, reason: "server", detail: error.message };
  }
  return { ok: true };
}

export async function unsubscribePush(): Promise<void> {
  const sub = await getSubscription();
  if (!sub) return;
  await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
