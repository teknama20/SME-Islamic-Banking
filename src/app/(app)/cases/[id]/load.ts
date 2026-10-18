import type { Actor } from "@/lib/actor";
import { db } from "@/lib/db";
import { canSeeCase } from "@/lib/scope";

export async function loadCase(actor: Actor, id: string) {
  const kase = await db.financingCase.findFirst({
    where: { id, tenantId: actor.tenantId },
    include: {
      customer: { include: { people: true } },
      rm: true,
      clearances: { orderBy: { track: "asc" } },
      approvals: { orderBy: [{ round: "desc" }, { level: "asc" }] },
      documents: { include: { signatures: { orderBy: { slot: "asc" } }, template: { select: { version: true, shariahRef: true, legalRef: true } } }, orderBy: { createdAt: "asc" } },
      steps: { orderBy: { seq: "asc" } },
      evidence: { include: { file: true, stampedFile: true }, orderBy: { serverTime: "asc" } },
      schedule: { orderBy: { seq: "asc" } },
      comments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!kase || !canSeeCase(actor, kase)) return null;
  const ids = new Set<string>();
  kase.clearances.forEach((c) => c.decidedById && ids.add(c.decidedById));
  kase.approvals.forEach((a) => a.decidedById && ids.add(a.decidedById));
  kase.steps.forEach((s) => s.completedById && ids.add(s.completedById));
  kase.evidence.forEach((e) => {
    ids.add(e.capturedById);
    if (e.verifiedById) ids.add(e.verifiedById);
  });
  kase.comments.forEach((c) => ids.add(c.authorId));
  const users = await db.user.findMany({ where: { id: { in: [...ids] } }, select: { id: true, fullName: true, role: true } });
  const people = Object.fromEntries(users.map((u) => [u.id, u]));
  return { kase, people };
}

export type LoadedCase = NonNullable<Awaited<ReturnType<typeof loadCase>>>;
