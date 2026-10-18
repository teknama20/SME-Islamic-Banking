// Helpers for Route Handlers (which, unlike Server Actions, get no built-in
// CSRF origin check).
import { NextResponse } from "next/server";
import { parseGeo, type Actor } from "./actor";
import { actorOrThrow } from "./auth";
import { AccessError, RuleError } from "./rbac";

export function assertSameOrigin(req: Request) {
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) throw new AccessError("Cross-origin request rejected.");
}

export async function routeActor(fd?: FormData): Promise<Actor> {
  const actor = await actorOrThrow();
  if (!fd) return actor;
  let device: Record<string, unknown> = {};
  try {
    device = JSON.parse(String(fd.get("device") || "{}"));
  } catch {
    /* ignore */
  }
  return { ...actor, geo: parseGeo(fd.get("geo_lat"), fd.get("geo_lng"), fd.get("geo_acc")), device };
}

export function errorResponse(e: unknown) {
  if (e instanceof AccessError) return NextResponse.json({ error: e.message }, { status: 403 });
  if (e instanceof RuleError) return NextResponse.json({ error: e.message }, { status: 422 });
  console.error(e);
  return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
}

export async function fileFromForm(fd: FormData, key: string) {
  const f = fd.get(key);
  if (!f || typeof f === "string" || f.size === 0) return null;
  return { buffer: Buffer.from(await f.arrayBuffer()), name: f.name || key, type: f.type };
}
