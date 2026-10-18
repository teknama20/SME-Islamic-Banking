import { NextResponse } from "next/server";
import { evidenceMeta, submitEvidence } from "@/lib/engine/execution";
import { assertSameOrigin, errorResponse, fileFromForm, routeActor } from "@/lib/http";
import { RuleError } from "@/lib/rbac";

/** Multipart upload of possession / inspection evidence with GPS + device metadata. */
export async function POST(req: Request) {
  try {
    assertSameOrigin(req);
    const fd = await req.formData();
    const actor = await routeActor(fd);
    const file = await fileFromForm(fd, "file");
    if (!file) throw new RuleError("Attach a photo, video or PDF.");
    const stamped = await fileFromForm(fd, "stamped");
    const meta = evidenceMeta.parse({
      caseId: fd.get("caseId"),
      stepKey: fd.get("stepKey") || undefined,
      category: fd.get("category"),
      description: fd.get("description"),
      assetRef: fd.get("assetRef") ?? "",
      clientTime: fd.get("clientTime") ?? "",
      locationNote: fd.get("locationNote") ?? "",
    });
    const ev = await submitEvidence(actor, meta, file, stamped ?? undefined);
    return NextResponse.json({ id: ev.id, serverTime: ev.serverTime });
  } catch (e) {
    if (e && typeof e === "object" && "issues" in e) return NextResponse.json({ error: "Invalid evidence details." }, { status: 422 });
    return errorResponse(e);
  }
}
