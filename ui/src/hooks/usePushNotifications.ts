import { useState, useEffect, useCallback } from "react";
import { useCompany } from "../context/CompanyContext";
import { api } from "../api/client";

export function usePushNotifications() {
  const { selectedCompanyId } = useCompany();
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof Notification !== "undefined" ? Notification.permission : "default",
  );
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    // Check if already subscribed
    if ("serviceWorker" in navigator && permission === "granted") {
      navigator.serviceWorker.ready.then((reg) => {
        reg.pushManager.getSubscription().then((sub) => {
          setSubscribed(!!sub);
        });
      });
    }
  }, [permission]);

  const subscribe = useCallback(async () => {
    if (!selectedCompanyId) return;

    const perm = await Notification.requestPermission();
    setPermission(perm);
    if (perm !== "granted") return;

    const reg = await navigator.serviceWorker.ready;

    // Get VAPID public key from env (Vite injects import.meta.env at build time)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const vapidKey = (import.meta as any).env?.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapidKey) {
      console.warn("[push] VITE_VAPID_PUBLIC_KEY not set");
      return;
    }

    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
    });

    // Send subscription to server
    await api.post(`/companies/${selectedCompanyId}/push-subscription`, {
      endpoint: sub.endpoint,
      keys: {
        p256dh: arrayBufferToBase64(sub.getKey("p256dh")!),
        auth: arrayBufferToBase64(sub.getKey("auth")!),
      },
    });

    setSubscribed(true);
  }, [selectedCompanyId]);

  const unsubscribe = useCallback(async () => {
    if (!selectedCompanyId) return;

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      // api.delete doesn't accept a body — use fetch directly
      await fetch(`/api/companies/${selectedCompanyId}/push-subscription`, {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      });
      await sub.unsubscribe();
    }
    setSubscribed(false);
  }, [selectedCompanyId]);

  return { permission, subscribed, subscribe, unsubscribe };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}
