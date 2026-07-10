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

/** Ativa push: pede permissão, assina e grava a assinatura no Supabase. */
export async function subscribePush(squadId: string): Promise<boolean> {
  if (!pushSupported || !VAPID_PUBLIC_KEY) return false;
  const perm = await Notification.requestPermission();
  if (perm !== "granted") return false;
  const reg = (await navigator.serviceWorker.getRegistration()) || (await registerSW());
  if (!reg) return false;
  const sub =
    (await reg.pushManager.getSubscription()) ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    }));
  const json = sub.toJSON();
  const { error } = await sb.from("push_subscriptions").upsert(
    {
      endpoint: sub.endpoint,
      p256dh: json.keys?.p256dh || "",
      auth: json.keys?.auth || "",
      squad_id: squadId,
    },
    { onConflict: "endpoint" }
  );
  if (error) { console.error(error); return false; }
  return true;
}

export async function unsubscribePush(): Promise<void> {
  const sub = await getSubscription();
  if (!sub) return;
  await sb.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
  await sub.unsubscribe();
}
