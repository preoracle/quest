import { useCallback, useEffect, useState } from "react";
import { savePushSubscription, removePushSubscription } from "@/api/client";

export type PushPermission = "default" | "granted" | "denied";

export function usePushSubscription() {
  const [permission, setPermission] = useState<PushPermission>("default");
  const [subscribed, setSubscribed] = useState(false);

  const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
  const supported =
    "serviceWorker" in navigator && "PushManager" in window && !!vapidKey;

  useEffect(() => {
    if (!supported) return;
    setPermission(Notification.permission as PushPermission);

    navigator.serviceWorker.ready.then((reg) =>
      reg.pushManager.getSubscription().then((sub) => setSubscribed(!!sub))
    );
  }, [supported]);

  const subscribe = useCallback(async () => {
    if (!supported || !vapidKey) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey),
    });
    setPermission("granted");
    setSubscribed(true);
    await savePushSubscription(sub.toJSON() as PushSubscriptionJSON);
  }, [supported, vapidKey]);

  const unsubscribe = useCallback(async () => {
    if (!supported) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (!sub) return;
    await removePushSubscription(sub.endpoint);
    await sub.unsubscribe();
    setSubscribed(false);
  }, [supported]);

  return { supported, permission, subscribed, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const arr = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) arr[i] = rawData.charCodeAt(i);
  return arr;
}
