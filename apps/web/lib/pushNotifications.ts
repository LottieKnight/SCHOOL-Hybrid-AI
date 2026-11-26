const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

function urlBase64ToUint8Array(base64String: string): ArrayBuffer {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr.buffer;
}

export async function requestPushPermission(): Promise<"granted" | "denied" | "default"> {
  if (!("Notification" in window)) return "denied";
  if (Notification.permission !== "default") return Notification.permission;
  return Notification.requestPermission();
}

export async function subscribeToPush(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !VAPID_PUBLIC_KEY) return null;

  const permission = await requestPushPermission();
  if (permission !== "granted") return null;

  const registration = await navigator.serviceWorker.ready;
  const existing = await registration.pushManager.getSubscription();
  if (existing) return existing;

  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
  });
}

export async function sendSubscriptionToServer(subscription: PushSubscription): Promise<boolean> {
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(subscription),
  });
  return res.ok;
}

export async function unsubscribeFromPush(): Promise<void> {
  if (!("serviceWorker" in navigator)) return;
  const registration = await navigator.serviceWorker.ready;
  const sub = await registration.pushManager.getSubscription();
  if (sub) {
    await sub.unsubscribe();
    await fetch("/api/push/unsubscribe", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
  }
}
