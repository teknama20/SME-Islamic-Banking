import Link from "next/link";
import { notFound } from "next/navigation";
import { customerUserAction, kycAction, verifyKycDocAction } from "@/app/actions/workflow";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, Empty, GeoLink, Hash, KeyValues, PageHeader, StageBadge, StatusBadge, fmtDate, fmtDateTime } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { EXPOSURE_STAGES, KYC_DOC_TYPES, LEGAL_FORMS } from "@/lib/constants";
import { db } from "@/lib/db";
import { pkr, pkrMillions } from "@/lib/pricing";
import { getProduct } from "@/lib/products/catalog";
import { can, roleLabel } from "@/lib/rbac";
import { CLEAN_EXPOSURE_CAP, SME_LABELS, perPartyLimit, type SmeCategory } from "@/lib/sbp";
import { customerScope } from "@/lib/scope";

export default async function CustomerPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ uploaded?: string; error?: string }> }) {
  const { id } = await params;
  const sp = await searchParams;
  const { actor } = await requireActor();
  const c = await db.customer.findFirst({
    where: { ...customerScope(actor), id },
    include: {
      rm: true,
      people: true,
      users: { orderBy: { createdAt: "asc" } },
      cases: { orderBy: { createdAt: "desc" } },
      kycDocs: { include: { file: true }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!c) notFound();
  const isBank = actor.kind === "BANK";
  const exposure = c.cases.filter((k) => EXPOSURE_STAGES.includes(k.stage as never));
  const bankExposure = exposure.reduce((s, k) => s + k.amount, 0);
  const cleanExposure = exposure.filter((k) => k.securityType === "CLEAN").reduce((s, k) => s + k.amount, 0);
  const limit = perPartyLimit(c.smeCategory as SmeCategory);
  const headroom = limit - bankExposure - c.otherBankExposure;
  const canUpload = isBank ? can(actor.role, "customer.edit") || actor.role === "RCAD" : actor.customerId === c.id;

  return (
    <>
      <PageHeader
        title={c.legalName}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            {c.cif} · {LEGAL_FORMS[c.legalForm]} · {c.city}
            <Badge tone="brand">{SME_LABELS[c.smeCategory as SmeCategory]}</Badge>
            {c.isStartup && <Badge tone="info">Start-up</Badge>}
            {c.womenLed && <Badge tone="info">Women-led</Badge>}
            <StatusBadge status={c.kycStatus} label={`KYC ${c.kycStatus.toLowerCase()}`} />
          </span>
        }
        back={isBank ? { href: "/customers", label: "Customers" } : undefined}
        actions={
          can(actor.role, "case.create") &&
          c.rmId === actor.userId && (
            <Link href={`/cases/new?customer=${c.id}`} className="btn btn-primary">
              New financing request
            </Link>
          )
        }
      />
      {sp.uploaded && <p className="mb-4 rounded-lg border border-ok/30 bg-ok/10 px-3 py-2 text-sm text-ok">Document uploaded, hashed and stored in the encrypted vault.</p>}
      {sp.error && <p className="mb-4 rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{sp.error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Business profile" className="lg:col-span-2">
          <KeyValues
            items={[
              ["NTN / STRN", `${c.ntn || "—"} / ${c.strn || "—"}`],
              ["Registration", c.registrationNo || "—"],
              ["Established", fmtDate(c.establishedOn)],
              ["Sector", c.sector],
              ["Annual turnover", pkr(c.annualTurnover)],
              ["Address", `${c.address}, ${c.city}`],
              ["Premises geo-tag (R-14)", <GeoLink key="g" lat={c.premisesLat} lng={c.premisesLng} />],
              ["Relationship Manager", `${c.rm.fullName}`],
              ["Risk category", c.riskCategory],
              ["e-CIB (R-7)", c.ecibCheckedAt ? `${fmtDate(c.ecibCheckedAt)}${c.ecibOverdue ? " — overdues reported" : " — clean"}` : "Not obtained"],
              ["Related party (R-11)", c.relatedParty ? "Yes — exposure prohibited" : "No"],
              ["KYC remarks", c.kycRemarks || "—"],
            ]}
          />
        </Card>

        {isBank && (
          <Card title="Exposure headroom">
            <KeyValues
              cols={2}
              items={[
                ["R-5 per-party limit", pkrMillions(limit)],
                ["This bank", pkrMillions(bankExposure)],
                ["Other banks (e-CIB)", pkrMillions(c.otherBankExposure)],
                ["Available headroom", <span key="h" className={headroom < 0 ? "text-bad" : "text-ok"}>{pkrMillions(headroom)}</span>],
                ["R-9 clean cap", pkrMillions(CLEAN_EXPOSURE_CAP)],
                ["Clean used", pkrMillions(cleanExposure)],
              ]}
            />
          </Card>
        )}
      </div>

      {actor.role === "RCAD" && (
        <Card title="RCAD — KYC / CDD decision" className="mt-6">
          <ActionForm action={kycAction.bind(null, c.id)} buttons={[{ label: "Clear KYC", name: "decision", value: "CLEARED" }, { label: "Return with deficiencies", name: "decision", value: "RETURNED", className: "btn" }]} geo>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label">Risk category</label>
                <select name="riskCategory" defaultValue={c.riskCategory} className="input">
                  <option>LOW</option>
                  <option>MEDIUM</option>
                  <option>HIGH</option>
                </select>
              </div>
              <div>
                <label className="label">Exposure with other banks (e-CIB, PKR)</label>
                <input name="otherBankExposure" type="number" min={0} defaultValue={c.otherBankExposure} className="input" />
              </div>
              <div>
                <label className="label">e-CIB remarks</label>
                <input name="ecibRemarks" defaultValue={c.ecibRemarks} className="input" />
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" name="ecibObtained" defaultChecked={!!c.ecibCheckedAt} /> Latest e-CIB / CIB report obtained (R-7)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="ecibOverdue" defaultChecked={c.ecibOverdue} /> Overdues reported
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" name="relatedParty" defaultChecked={c.relatedParty} /> Related party of bank director / 5% shareholder / CEO (R-11)
              </label>
            </div>
            <div>
              <label className="label">Remarks (sanctions / PEP / adverse media / UBO / NADRA Verisys)</label>
              <textarea name="remarks" required className="input" rows={2} />
            </div>
          </ActionForm>
        </Card>
      )}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card title="Owners, directors & signatories">
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>CNIC</th>
                <th>Role</th>
                <th>Share</th>
              </tr>
            </thead>
            <tbody>
              {c.people.map((p) => (
                <tr key={p.id}>
                  <td>{p.fullName}</td>
                  <td className="mono">{isBank ? p.cnic : `${p.cnic.slice(0, 6)}*******${p.cnic.slice(-2)}`}</td>
                  <td>{p.role}</td>
                  <td className="tabular-nums">{p.sharePct ? `${p.sharePct}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Customer users (linked to this SME)">
          {c.users.length === 0 ? (
            <Empty>No customer users yet.</Empty>
          ) : (
            <ul className="space-y-2 text-sm">
              {c.users.map((u) => (
                <li key={u.id} className="flex justify-between gap-2">
                  <span>
                    {u.fullName} <span className="mono text-muted">({u.username})</span>
                  </span>
                  <Badge>{roleLabel(u.role)}</Badge>
                </li>
              ))}
            </ul>
          )}
          {(can(actor.role, "customer.edit") || can(actor.role, "admin.manage")) && (
            <details className="mt-4">
              <summary className="cursor-pointer text-sm font-medium text-brand">Provision a customer user</summary>
              <ActionForm action={customerUserAction.bind(null, c.id)} submitLabel="Create user" resetOnSuccess className="mt-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <input name="fullName" placeholder="Full name (as per CNIC)" className="input" required />
                  <input name="username" placeholder="username" className="input" required />
                  <input name="email" type="email" placeholder="email" className="input" required />
                  <input name="mobile" placeholder="+92 3xx xxxxxxx" className="input" required />
                  <select name="role" className="input">
                    <option value="CUSTOMER_SIGNATORY">Authorised signatory</option>
                    <option value="CUSTOMER_USER">User / accountant (upload only)</option>
                    <option value="GUARANTOR">Guarantor</option>
                  </select>
                  <input name="password" type="password" placeholder="Temporary password" className="input" required />
                </div>
              </ActionForm>
            </details>
          )}
        </Card>
      </div>

      <Card title="KYC & business documents" className="mt-6">
        {c.kycDocs.length === 0 ? (
          <Empty>No documents uploaded.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Document</th>
                  <th>File</th>
                  <th>SHA-256</th>
                  <th>Uploaded</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {c.kycDocs.map((d) => (
                  <tr key={d.id}>
                    <td>{d.docType}</td>
                    <td>
                      <a href={`/api/files/${d.fileId}`} className="link" target="_blank">
                        {d.file.originalName}
                      </a>
                    </td>
                    <td>
                      <Hash value={d.file.sha256} />
                    </td>
                    <td className="text-xs text-muted">{fmtDateTime(d.createdAt)}</td>
                    <td>
                      <StatusBadge status={d.status} />
                    </td>
                    <td>
                      {actor.role === "RCAD" && d.status === "UPLOADED" && (
                        <ActionForm action={verifyKycDocAction.bind(null, d.id, "VERIFIED")} submitLabel="Verify" submitClass="btn btn-sm">
                          <input type="hidden" name="remarks" value="Verified against original" />
                        </ActionForm>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {canUpload && (
          <form action={`/api/customers/${c.id}/documents`} method="post" encType="multipart/form-data" className="mt-4 flex flex-wrap items-end gap-3">
            <div>
              <label className="label">Document type</label>
              <select name="docType" className="input">
                {KYC_DOC_TYPES.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">File (PDF / image, max 50 MB)</label>
              <input type="file" name="file" required accept="application/pdf,image/*" className="input" />
            </div>
            <button className="btn">Upload</button>
          </form>
        )}
      </Card>

      <Card title="Financing cases" className="mt-6">
        {c.cases.length === 0 ? (
          <Empty>No financing requests yet.</Empty>
        ) : (
          <ul className="divide-y divide-line">
            {c.cases.map((k) => (
              <li key={k.id} className="flex items-center justify-between gap-3 py-2.5">
                <Link href={`/cases/${k.id}`} className="link">
                  {k.ref} · {getProduct(k.productCode).name}
                </Link>
                <span className="flex items-center gap-3 text-sm tabular-nums">
                  {pkrMillions(k.amount)} <StageBadge stage={k.stage} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
