/* ClimbOS service worker: push notifications (content pulled from ClimbOS, never in the push itself). */
const params = new URL(self.location.href).searchParams;
const PULL = params.get("pull");

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      const sub = await self.registration.pushManager.getSubscription();
      let items = [];
      if (PULL && sub) {
        try {
          const res = await fetch(PULL, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
          if (res.ok) items = (await res.json()).items || [];
        } catch (e) {
          items = [];
        }
      }
      if (!items.length) items = [{ title: "ClimbOS", body: "Something needs you.", url: "/app" }];
      for (const it of items.slice(0, 3)) {
        await self.registration.showNotification(it.title, { body: it.body, icon: "/icon-192.png", badge: "/icon-192.png", data: { url: it.url || "/app" }, tag: it.tag || undefined });
      }
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/app";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const c of all) {
        if ("focus" in c) {
          await c.focus();
          if ("navigate" in c) await c.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
