// Shared wrapper for Server Actions: authenticates, attaches GPS/device
// forensics from the submitting form, enforces read-only roles and converts
// rule violations into user-facing messages.
import { refresh } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import type { ActionState } from "@/lib/action-state";
import { parseGeo, type Actor } from "@/lib/actor";
import { actorOrThrow } from "@/lib/auth";
import { AccessError, READ_ONLY_ROLES, RuleError, type Role } from "@/lib/rbac";

export function friendlyError(e: unknown): string {
  if (e instanceof RuleError || e instanceof AccessError) return e.message;
  if (e instanceof ZodError) return e.issues.map((i) => `${i.path.join(".") || "Input"}: ${i.message}`).join("; ");
  console.error(e);
  return "Something went wrong. The incident has been logged.";
}

export function actorWithForensics(actor: Actor, fd?: FormData): Actor {
  if (!fd) return actor;
  const geo = parseGeo(fd.get("geo_lat"), fd.get("geo_lng"), fd.get("geo_acc"));
  let device: Record<string, unknown> = {};
  try {
    device = JSON.parse(String(fd.get("device") || "{}"));
  } catch {
    /* ignore malformed device info */
  }
  return { ...actor, geo, device };
}

export async function run(
  fd: FormData | undefined,
  fn: (actor: Actor) => Promise<void | string | ActionState>,
  opts: { refresh?: boolean } = {},
): Promise<ActionState> {
  try {
    const actor = actorWithForensics(await actorOrThrow(), fd);
    if (READ_ONLY_ROLES.includes(actor.role as Role)) throw new AccessError("Your role has read-only access.");
    const r = await fn(actor);
    if (opts.refresh !== false) refresh();
    if (typeof r === "string") return { ok: true, message: r };
    return { ok: true, ...(r ?? {}) };
  } catch (e) {
    unstable_rethrow(e);
    return { ok: false, error: friendlyError(e) };
  }
}

export const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();
export const all = (fd: FormData, k: string) => fd.getAll(k).map(String);
