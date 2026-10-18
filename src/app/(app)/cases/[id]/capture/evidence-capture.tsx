"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { deviceInfo, useGeo } from "@/components/geo-fields";

type Props = {
  caseId: string;
  caseRef: string;
  stepKey?: string;
  stepTitle: string;
  categories: { value: string; label: string }[];
  requireGps: boolean;
  checklist: string[];
  userLabel: string;
};

/** Burns a visible watermark (case, asset, time, GPS, user) into a JPEG copy; the original is kept intact. */
async function stampImage(file: File, lines: string[]): Promise<Blob | null> {
  if (!file.type.startsWith("image/")) return null;
  const bmp = await createImageBitmap(file).catch(() => null);
  if (!bmp) return null;
  // normalise to 960–1600 px wide so the watermark is legible on any input size
  const scale = Math.min(1600, Math.max(960, bmp.width)) / bmp.width;
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(bmp, 0, 0, w, h);
  const fs = Math.max(14, Math.round(w / 55));
  const band = fs * 1.45 * lines.length + fs;
  ctx.fillStyle = "rgba(0,0,0,0.62)";
  ctx.fillRect(0, h - band, w, band);
  ctx.fillStyle = "#fff";
  ctx.font = `${fs}px ui-monospace, Menlo, monospace`;
  lines.forEach((l, i) => ctx.fillText(l, fs * 0.6, h - band + fs * 1.3 + i * fs * 1.45));
  return new Promise((res) => canvas.toBlob((b) => res(b), "image/jpeg", 0.88));
}

export function EvidenceCapture(p: Props) {
  const router = useRouter();
  const geo = useGeo();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>([]);
  const [category, setCategory] = useState(p.categories[0]?.value ?? "OTHER");
  const [description, setDescription] = useState("");
  const [assetRef, setAssetRef] = useState("");
  const [inputKey, setInputKey] = useState(0);

  const gpsBlocked = p.requireGps && geo.status !== "ok";

  async function upload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const now = new Date();
      const lines = [
        `${p.caseRef} · ${category} · ${assetRef || "asset n/a"}`,
        `${now.toLocaleString("en-GB", { timeZone: "Asia/Karachi" })} PKT (device clock)`,
        geo.status === "ok" ? `GPS ${geo.lat!.toFixed(6)}, ${geo.lng!.toFixed(6)} ±${Math.round(geo.acc ?? 0)}m` : "GPS unavailable",
        p.userLabel,
      ];
      const stamped = await stampImage(file, lines);
      const fd = new FormData();
      fd.set("file", file);
      if (stamped) fd.set("stamped", new File([stamped], `stamped-${file.name.replace(/\.\w+$/, "")}.jpg`, { type: "image/jpeg" }));
      fd.set("caseId", p.caseId);
      if (p.stepKey) fd.set("stepKey", p.stepKey);
      fd.set("category", category);
      fd.set("description", description);
      fd.set("assetRef", assetRef);
      fd.set("clientTime", now.toISOString());
      if (geo.status === "ok") {
        fd.set("geo_lat", String(geo.lat));
        fd.set("geo_lng", String(geo.lng));
        fd.set("geo_acc", String(geo.acc ?? ""));
      }
      fd.set("device", JSON.stringify(deviceInfo()));
      const res = await fetch("/api/evidence", { method: "POST", body: fd });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Upload failed");
      setDone((d) => [...d, `${description} — sealed at ${new Date(body.serverTime).toLocaleString("en-GB", { timeZone: "Asia/Karachi" })} PKT`]);
      setFile(null);
      setPreview(null);
      setDescription("");
      setInputKey((k) => k + 1); // remount so the same file can be chosen again
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <div className={`rounded-lg border p-3 text-sm ${geo.status === "ok" ? "border-ok/30 bg-ok/10 text-ok" : p.requireGps ? "border-bad/30 bg-bad/10 text-bad" : "border-warn/30 bg-warn/10 text-warn"}`}>
          {geo.status === "ok" && `📍 Location locked: ${geo.lat!.toFixed(6)}, ${geo.lng!.toFixed(6)} (±${Math.round(geo.acc ?? 0)} m)`}
          {geo.status === "pending" && "📍 Acquiring GPS location… keep this screen open."}
          {(geo.status === "denied" || geo.status === "unsupported") && (p.requireGps ? "GPS is mandatory for this evidence. Allow location access in your browser and reload." : "Location unavailable — evidence will be recorded without GPS.")}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Evidence category</label>
            <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
              {p.categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">Asset tag / serial / lot no.</label>
            <input className="input" value={assetRef} onChange={(e) => setAssetRef(e.target.value)} placeholder="Scan or type QR / serial" />
          </div>
          <div className="sm:col-span-2">
            <label className="label">What does this show?</label>
            <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. 40 MT seed bags stacked in godown bay 3, bank tags visible" />
          </div>
        </div>

        <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line p-8 text-center hover:border-brand">
          <span className="text-sm font-medium">📷 Take photo / video or choose a file</span>
          <span className="text-xs text-muted">JPEG, PNG, HEIC, MP4, MOV or PDF · max 50 MB</span>
          <input
            key={inputKey}
            type="file"
            accept="image/*,video/*,application/pdf"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setPreview(f && (f.type.startsWith("image/") || f.type.startsWith("video/")) ? URL.createObjectURL(f) : null);
            }}
          />
        </label>
        {file && (
          <div className="rounded-lg border border-line p-3">
            {preview && file.type.startsWith("image/") && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="preview" className="mb-2 max-h-72 w-full rounded object-contain" />
            )}
            {preview && file.type.startsWith("video/") && <video src={preview} controls className="mb-2 max-h-72 w-full" />}
            <div className="text-xs text-muted">
              {file.name} · {(file.size / 1024 / 1024).toFixed(2)} MB · {file.type}
            </div>
          </div>
        )}
        {error && <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
        <div className="flex gap-2">
          <button className="btn btn-primary" disabled={!file || busy || gpsBlocked || description.trim().length < 3} onClick={upload}>
            {busy ? "Sealing & uploading…" : "Seal & upload evidence"}
          </button>
          <Link href={`/cases/${p.caseId}?tab=execution`} className="btn">
            Back to case
          </Link>
        </div>
        {done.length > 0 && (
          <ul className="space-y-1 rounded-lg border border-ok/30 bg-ok/10 p-3 text-sm text-ok">
            {done.map((d, i) => (
              <li key={i}>✓ {d}</li>
            ))}
          </ul>
        )}
      </div>
      <aside className="space-y-3 text-sm">
        <div className="card p-4">
          <div className="mb-2 font-medium">{p.stepTitle}</div>
          <p className="mb-2 text-xs text-muted">The verifier will confirm:</p>
          <ul className="list-disc space-y-1 pl-4 text-xs">
            {p.checklist.map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
        <div className="card p-4 text-xs text-muted">
          Each upload records the trusted server time, your GPS position and accuracy, device details and IP, and a SHA-256 hash of the original file. Images also get a watermarked copy. Files are encrypted at rest and every view is logged.
        </div>
      </aside>
    </div>
  );
}
