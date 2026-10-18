"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { BellRing, Smartphone, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button, Callout, toast } from "@/components/ui";
import { errorMessage } from "../errors";

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((b64url.length + 3) % 4));
  const out = new Uint8Array(new ArrayBuffer(s.length));
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

function deviceLabel(): string {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad/.test(ua) ? "iPhone" : /Android/.test(ua) ? "Android" : /Mac/.test(ua) ? "Mac" : /Windows/.test(ua) ? "Windows" : "Device";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Safari\//.test(ua) ? "Safari" : /Firefox\//.test(ua) ? "Firefox" : "";
  return [os, br].filter(Boolean).join(" · ");
}

/** Phone and desktop notifications: approvals, replies, leads and chats, even when ClimbOS is closed. */
export function PushSettings() {
  const pub = useQuery(api.push.publicKey);
  const devices = useQuery(api.push.mine);
  const subscribe = useMutation(api.push.subscribe);
  const unsubscribe = useMutation(api.push.unsubscribe);
  const test = useMutation(api.push.test);
  const [support, setSupport] = useState<"unknown" | "yes" | "no" | "ios-install">("unknown");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const ios = /iPhone|iPad/.test(navigator.userAgent);
    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const ok = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    // Effects may sync with browser capabilities; this runs once.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupport(ok ? "yes" : ios && !standalone ? "ios-install" : "no");
  }, []);
  const turnOn = async () => {
    if (!pub) return;
    setBusy(true);
    try {
      const pull = `${process.env.NEXT_PUBLIC_CONVEX_SITE_URL ?? ""}/push/pull`;
      const reg = await navigator.serviceWorker.register(`/sw.js?pull=${encodeURIComponent(pull)}`, { scope: "/" });
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("Notifications are blocked for ClimbOS in this browser's settings.");
      const sub = (await reg.pushManager.getSubscription()) ?? (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes(pub) }));
      await subscribe({ endpoint: sub.endpoint, label: deviceLabel() });
      await test({});
      toast({ tone: "success", title: "Notifications are on", description: "We sent a test one." });
    } catch (e) {
      toast({ tone: "danger", title: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <section aria-labelledby="push-heading" className="flex flex-col gap-3 rounded-xl border border-line bg-surface p-5">
      <h2 id="push-heading" className="heading-section flex items-center gap-2">
        <BellRing className="size-4 text-brand-800" aria-hidden /> Phone notifications
      </h2>
      <p className="text-sm text-ink-3">Approve drafts and answer leads from your phone. We notify you about approvals, replies, new leads, chats and bookings.</p>
      {support === "ios-install" ? (
        <Callout tone="info" title="On iPhone, add ClimbOS to your Home Screen first">
          Tap Share → Add to Home Screen, open ClimbOS from there, then turn notifications on.
        </Callout>
      ) : support === "no" ? (
        <p className="text-sm text-ink-2">This browser doesn&apos;t support notifications.</p>
      ) : (
        <Button className="self-start" loading={busy} disabled={!pub} onClick={turnOn}>
          <Smartphone aria-hidden /> Turn on for this device
        </Button>
      )}
      {devices?.length ? (
        <ul className="flex flex-col divide-y divide-line text-sm">
          {devices.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 py-2">
              <span className="text-ink-2">{d.label}</span>
              <span className="flex gap-1">
                <Button size="sm" variant="ghost" onClick={() => test({}).then(() => toast({ tone: "success", title: "Test sent" }))}>
                  Test
                </Button>
                <Button size="sm" variant="ghost" aria-label={`Remove ${d.label}`} onClick={() => unsubscribe({ id: d.id })}>
                  <Trash2 aria-hidden />
                </Button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
