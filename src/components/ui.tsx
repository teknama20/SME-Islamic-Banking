import Link from "next/link";
import type { ReactNode } from "react";
import { STAGE_LABELS, type Stage } from "@/lib/constants";

export type Tone = "ok" | "warn" | "bad" | "info" | "neutral" | "brand";

const TONES: Record<Tone, string> = {
  ok: "border-ok/30 bg-ok/10 text-ok",
  warn: "border-warn/30 bg-warn/10 text-warn",
  bad: "border-bad/30 bg-bad/10 text-bad",
  info: "border-info/30 bg-info/10 text-info",
  neutral: "border-line bg-surface-2 text-muted",
  brand: "border-brand/30 bg-brand/10 text-brand",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge ${TONES[tone]}`}>{children}</span>;
}

export function stageTone(stage: string): Tone {
  if (["ACTIVE", "SANCTIONED"].includes(stage)) return "ok";
  if (["RETURNED", "OFFERED"].includes(stage)) return "warn";
  if (["REJECTED", "DECLINED", "CANCELLED"].includes(stage)) return "bad";
  if (stage === "CLOSED") return "neutral";
  if (stage === "EXECUTION") return "brand";
  return "info";
}

export function StageBadge({ stage }: { stage: string }) {
  return <Badge tone={stageTone(stage)}>{STAGE_LABELS[stage as Stage]?.split(" (")[0] ?? stage}</Badge>;
}

export function statusTone(status: string): Tone {
  if (["CLEARED", "APPROVED", "EXECUTED", "DONE", "VERIFIED", "PASS", "PAID", "SIGNED", "ACTIVE"].includes(status)) return "ok";
  if (["PENDING", "READY", "ISSUED", "SUBMITTED", "WARN", "DUE", "DRAFT"].includes(status)) return "warn";
  if (["RETURNED", "REJECTED", "DECLINED", "FAIL", "OVERDUE", "LOCKED_ACCOUNT", "DISABLED", "LOCKED"].includes(status)) return "bad";
  return "neutral";
}

export function StatusBadge({ status, label }: { status: string; label?: string }) {
  return <Badge tone={statusTone(status)}>{label ?? status.replace(/_/g, " ").toLowerCase()}</Badge>;
}

export function PageHeader({ title, subtitle, actions, back }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-block text-xs text-muted hover:text-ink">
            ← {back.label}
          </Link>
        )}
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ title, actions, children, className = "" }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          {title && <h2 className="text-base font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">{children}</div>;
}

export function Stat({ label, value, hint, tone }: { label: string; value: ReactNode; hint?: ReactNode; tone?: Tone }) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium tracking-wide text-muted uppercase">{label}</div>
      <div className={`mt-1 text-2xl font-semibold tabular-nums ${tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : tone === "ok" ? "text-ok" : ""}`}>{value}</div>
      {hint && <div className="mt-1 text-xs text-muted">{hint}</div>}
    </div>
  );
}

export function KeyValues({ items, cols = 2 }: { items: [string, ReactNode][]; cols?: 2 | 3 | 4 }) {
  const grid = { 2: "sm:grid-cols-2", 3: "sm:grid-cols-3", 4: "sm:grid-cols-2 lg:grid-cols-4" }[cols];
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-3 ${grid}`}>
      {items.map(([k, v]) => (
        <div key={k} className="min-w-0">
          <dt className="text-xs text-muted">{k}</dt>
          <dd className="text-sm break-words">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Tabs({ base, current, tabs }: { base: string; current: string; tabs: { key: string; label: string; count?: number }[] }) {
  return (
    <nav className="no-print mb-5 flex gap-1 overflow-x-auto border-b border-line">
      {tabs.map((t) => (
        <Link
          key={t.key}
          href={`${base}?tab=${t.key}`}
          className={`-mb-px border-b-2 px-3 py-2 text-sm whitespace-nowrap ${current === t.key ? "border-brand font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}
        >
          {t.label}
          {t.count !== undefined && <span className="ml-1.5 rounded-full bg-surface-2 px-1.5 text-xs text-muted">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}

const PKT: Intl.DateTimeFormatOptions = { timeZone: "Asia/Karachi" };

export function fmtDate(d?: Date | string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-GB", { ...PKT, day: "2-digit", month: "short", year: "numeric" });
}

export function fmtDateTime(d?: Date | string | null) {
  if (!d) return "—";
  return `${new Date(d).toLocaleString("en-GB", { ...PKT, day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false })} PKT`;
}

export function GeoLink({ lat, lng, accuracy }: { lat?: number | null; lng?: number | null; accuracy?: number | null }) {
  if (lat == null || lng == null) return <span className="text-muted">not captured</span>;
  return (
    <a className="link mono" href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=17/${lat}/${lng}`} target="_blank" rel="noreferrer noopener">
      {lat.toFixed(5)}, {lng.toFixed(5)}
      {accuracy ? ` ±${Math.round(accuracy)}m` : ""}
    </a>
  );
}

export function Hash({ value, short = true }: { value: string; short?: boolean }) {
  return (
    <span className="mono text-muted" title={value}>
      {short ? `${value.slice(0, 12)}…${value.slice(-6)}` : value}
    </span>
  );
}
