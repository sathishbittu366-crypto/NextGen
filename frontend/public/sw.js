/* NextGen SMS Web Push service worker. Keep this file dependency-free so it
 * remains available even when the application bundle is being rebuilt. */

self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try {
    payload = event.data.json();
  } catch (_) {
    payload = { title: "NextGen SMS", body: event.data.text() };
  }

  const title = payload.title || "NextGen SMS";
  const options = {
    body: payload.body || "You have a new update.",
    icon: "/logo.png",
    badge: "/logo.png",
    tag: `nextgen-${payload.notification_id || payload.data?.type || "update"}`,
    renotify: true,
    data: {
      url: payload.url || "/",
      ...(payload.data || {}),
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification?.data?.url || "/";
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clientsList) {
      try {
        await client.focus();
        if ("navigate" in client && typeof client.navigate === "function") {
          await client.navigate(new URL(target, self.location.origin).href);
        }
        return;
      } catch (_) {
        // Try the next open client, then open a new window below.
      }
    }
    await self.clients.openWindow(new URL(target, self.location.origin).href);
  })());
});
