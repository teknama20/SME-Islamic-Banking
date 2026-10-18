"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

export type GeoState = { status: "pending" | "ok" | "denied" | "unsupported"; lat?: number; lng?: number; acc?: number };

export function deviceInfo() {
  if (typeof window === "undefined") return {};
  const nav = navigator as Navigator & { connection?: { effectiveType?: string } };
  return {
    platform: nav.platform,
    language: nav.language,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    screen: `${screen.width}x${screen.height}@${window.devicePixelRatio}`,
    network: nav.connection?.effectiveType ?? "unknown",
    online: nav.onLine,
    clientTime: new Date().toISOString(),
  };
}

const noopSubscribe = () => () => {};

export function useGeo(): GeoState {
  const supported = useSyncExternalStore(noopSubscribe, () => "geolocation" in navigator, () => true);
  const [geo, setGeo] = useState<GeoState>({ status: "pending" });
  useEffect(() => {
    if (!supported) return;
    const id = navigator.geolocation.watchPosition(
      (p) => setGeo({ status: "ok", lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      () => setGeo((g) => (g.status === "ok" ? g : { status: "denied" })),
      { enableHighAccuracy: true, maximumAge: 30_000, timeout: 20_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [supported]);
  return supported ? geo : { status: "unsupported" };
}

/** Hidden GPS + device fields attached to audited submissions. */
export function GeoFields() {
  const geo = useGeo();
  const device = typeof window === "undefined" ? "{}" : JSON.stringify(deviceInfo());
  return (
    <>
      <input type="hidden" name="geo_lat" value={geo.lat ?? ""} />
      <input type="hidden" name="geo_lng" value={geo.lng ?? ""} />
      <input type="hidden" name="geo_acc" value={geo.acc ?? ""} />
      <input type="hidden" name="device" value={device} readOnly suppressHydrationWarning />
      <p className="text-xs text-muted">
        {geo.status === "ok" && `📍 Location captured (${geo.lat!.toFixed(4)}, ${geo.lng!.toFixed(4)} ±${Math.round(geo.acc ?? 0)}m) — recorded in the audit trail`}
        {geo.status === "pending" && "📍 Acquiring location…"}
        {geo.status === "denied" && "⚠️ Location permission denied — the action will be recorded without GPS"}
        {geo.status === "unsupported" && "⚠️ This device does not provide location"}
      </p>
    </>
  );
}
