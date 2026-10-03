import { getNotificationConfig, registerPushSubscription, removePushSubscription } from "../api/notifications";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const normalized = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i);
  return output;
}

export function webPushSupported(): boolean {
  return typeof window !== "undefined"
    && "serviceWorker" in navigator
    && "PushManager" in window
    && "Notification" in window;
}

export async function getExistingPushSubscription(): Promise<PushSubscription | null> {
  if (!webPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return registration?.pushManager.getSubscription() ?? null;
}

export async function enableWebPush(): Promise<void> {
  if (!webPushSupported()) throw new Error("This browser does not support web push notifications.");
  if (Notification.permission === "denied") {
    throw new Error("Browser notifications are blocked. Allow notifications for this site in browser settings.");
  }

  // Request permission before any awaited network work so the browser still
  // sees this operation as originating from the user's button press.
  const permission = Notification.permission === "granted"
    ? "granted"
    : await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const config = await getNotificationConfig();
  if (!config.supported || !config.public_key) {
    throw new Error("Web push is not configured on this deployment yet.");
  }

  const registration = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(config.public_key),
  });
  await registerPushSubscription(subscription);
}

export async function disableWebPush(): Promise<void> {
  if (!webPushSupported()) return;
  const subscription = await getExistingPushSubscription();
  if (!subscription) return;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  await removePushSubscription(endpoint);
}
