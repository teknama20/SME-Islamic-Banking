import { redirect } from "next/navigation";
import { brandingAction, createBankUserAction, createOrgUnitAction, settingsAction, userStatusAction } from "@/app/actions/admin";
import { ActionForm } from "@/components/action-form";
import { Badge, Card, PageHeader, StatusBadge, fmtDateTime } from "@/components/ui";
import { requireActor } from "@/lib/auth";
import { db } from "@/lib/db";
import { BANK_ROLES, can, roleLabel } from "@/lib/rbac";
import { parseSettings } from "@/lib/tenant";

export default async function AdminPage() {
  const { actor, session } = await requireActor();
  if (!can(actor.role, "admin.manage")) redirect("/dashboard");
  const tenant = session.tenant;
  const settings = parseSettings(tenant.settings);
  const [orgs, users] = await Promise.all([
    db.orgUnit.findMany({ where: { tenantId: tenant.id }, orderBy: { path: "asc" } }),
    db.user.findMany({ where: { tenantId: tenant.id, kind: "BANK" }, include: { orgUnit: true }, orderBy: [{ role: "asc" }, { fullName: "asc" }] }),
  ]);
  const depth = (p: string) => p.split("/").filter(Boolean).length - 1;

  return (
    <>
      <PageHeader title="Administration" subtitle={`${tenant.legalName} · tenant ${tenant.code} · ${tenant.bankType === "ISLAMIC" ? "Islamic bank" : "Conventional bank — Islamic Banking Window"}`} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="White-label branding">
          <ActionForm action={brandingAction} submitLabel="Save branding">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="label">Brand name</label>
                <input name="name" defaultValue={tenant.name} className="input" />
              </div>
              <div>
                <label className="label">Legal name</label>
                <input name="legalName" defaultValue={tenant.legalName} className="input" />
              </div>
              <div>
                <label className="label">Primary colour</label>
                <input name="primaryColor" type="color" defaultValue={tenant.primaryColor} className="input h-10 p-1" />
              </div>
              <div>
                <label className="label">Accent colour</label>
                <input name="accentColor" type="color" defaultValue={tenant.accentColor} className="input h-10 p-1" />
              </div>
              <div>
                <label className="label">Logo text (≤4)</label>
                <input name="logoText" defaultValue={tenant.logoText} maxLength={4} className="input" />
              </div>
              <div>
                <label className="label">Tagline</label>
                <input name="tagline" defaultValue={tenant.tagline} className="input" />
              </div>
              <div className="sm:col-span-2">
                <label className="label">Shariah Board reference</label>
                <input name="shariahBoardRef" defaultValue={tenant.shariahBoardRef} className="input" />
              </div>
            </div>
          </ActionForm>
        </Card>

        <Card title="Security policy & delegated authority">
          <ActionForm action={settingsAction} submitLabel="Save policy">
            <div className="grid gap-3 sm:grid-cols-2">
              {settings.approvalMatrix.slice(1).map((l) => (
                <div key={l.role}>
                  <label className="label">{roleLabel(l.role)} limit (PKR)</label>
                  <input name={`limit_${l.role}`} type="number" defaultValue={l.limit ?? 0} className="input" />
                </div>
              ))}
              <div>
                <label className="label">Clean facility escalation above (PKR)</label>
                <input name="cleanEscalationAmount" type="number" defaultValue={settings.cleanEscalationAmount} className="input" />
              </div>
              <div>
                <label className="label">Session idle timeout (min)</label>
                <input name="sessionIdleMinutes" type="number" defaultValue={settings.sessionIdleMinutes} className="input" />
              </div>
              <div>
                <label className="label">Lock after failed logins</label>
                <input name="maxFailedLogins" type="number" defaultValue={settings.maxFailedLogins} className="input" />
              </div>
              <div>
                <label className="label">TAT (working days, R-16 max 15)</label>
                <input name="tatWorkingDays" type="number" max={15} defaultValue={settings.tatWorkingDays} className="input" />
              </div>
              <div>
                <label className="label">OTP delivery</label>
                <select name="otpDelivery" defaultValue={settings.otpDelivery} className="input">
                  <option value="screen">On-screen (demo / UAT)</option>
                  <option value="sms">SMS gateway (production)</option>
                </select>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="mfaRequired" defaultChecked={settings.mfaRequired} /> Require OTP at login
              </label>
            </div>
            <fieldset className="rounded-lg border border-line p-3">
              <legend className="label px-1">Pre-sanction reviews (RCAD always reviews)</legend>
              <div className="flex flex-wrap gap-4 text-sm">
                {([["CREDIT", "Credit & Risk"], ["TRADE", "Trade (trade-based modes)"], ["LEGAL", "Legal"], ["SHARIAH", "Shariah (pre-sanction)"]] as const).map(([v, l]) => (
                  <label key={v} className="flex items-center gap-2">
                    <input type="checkbox" name="reviewTracks" value={v} defaultChecked={settings.reviewTracks.includes(v)} /> {l}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted">Shariah always reviews the complete file after disbursement.</p>
            </fieldset>
            <p className="text-xs text-muted">The Team Leader always recommends; each higher level approves up to its limit. Changes are audited with before/after values.</p>
          </ActionForm>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <Card title="Organisation hierarchy">
          <ul className="space-y-1 text-sm">
            {orgs.map((o) => (
              <li key={o.id} style={{ paddingLeft: depth(o.path) * 16 }}>
                <Badge>{o.type}</Badge> {o.name} <span className="mono text-muted">{o.code}</span>
              </li>
            ))}
          </ul>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-brand">Add org unit</summary>
            <ActionForm action={createOrgUnitAction} submitLabel="Create" className="mt-2" resetOnSuccess>
              <select name="parentId" className="input">
                {orgs
                  .filter((o) => o.type !== "TEAM")
                  .map((o) => (
                    <option key={o.id} value={o.id}>
                      under {o.name}
                    </option>
                  ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <input name="name" placeholder="Name" className="input" required />
                <input name="code" placeholder="Code" className="input" required />
              </div>
            </ActionForm>
          </details>
        </Card>

        <Card title={`Bank users (${users.length})`}>
          <div className="max-h-[28rem] overflow-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role / unit</th>
                  <th>Last login</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div className="font-medium">{u.fullName}</div>
                      <div className="mono text-muted">{u.username}</div>
                    </td>
                    <td className="text-xs">
                      {roleLabel(u.role)}
                      <div className="text-muted">{u.orgUnit?.name}</div>
                      {u.approvalLimit && <div className="text-muted">limit {u.approvalLimit.toLocaleString("en-PK")}</div>}
                    </td>
                    <td className="text-xs text-muted">{fmtDateTime(u.lastLoginAt)}</td>
                    <td>
                      <StatusBadge status={u.status} />
                    </td>
                    <td>
                      {u.id !== actor.userId &&
                        (u.status === "ACTIVE" ? (
                          <ActionForm action={userStatusAction.bind(null, u.id, "DISABLED")} submitLabel="Disable" submitClass="btn btn-sm" confirm={`Disable ${u.username}? Active sessions will be revoked.`} />
                        ) : (
                          <ActionForm action={userStatusAction.bind(null, u.id, "ACTIVE")} submitLabel={u.status === "LOCKED" ? "Unlock" : "Enable"} submitClass="btn btn-sm" />
                        ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="mt-4">
            <summary className="cursor-pointer text-sm font-medium text-brand">Onboard bank staff</summary>
            <ActionForm action={createBankUserAction} submitLabel="Create user" className="mt-3" resetOnSuccess>
              <div className="grid gap-3 sm:grid-cols-3">
                <input name="fullName" placeholder="Full name" className="input" required />
                <input name="username" placeholder="username" className="input" required />
                <input name="employeeId" placeholder="Employee ID" className="input" required />
                <input name="email" type="email" placeholder="Official e-mail" className="input" required />
                <input name="mobile" placeholder="Mobile (for OTP)" className="input" required />
                <select name="role" className="input">
                  {BANK_ROLES.map((r) => (
                    <option key={r} value={r}>
                      {roleLabel(r)}
                    </option>
                  ))}
                </select>
                <select name="orgUnitId" className="input">
                  {orgs.map((o) => (
                    <option key={o.id} value={o.id}>
                      {o.type}: {o.name}
                    </option>
                  ))}
                </select>
                <input name="approvalLimit" type="number" placeholder="Personal limit (optional)" className="input" />
                <input name="password" type="password" placeholder="Temporary password" className="input" required />
              </div>
              <p className="text-xs text-muted">Password policy: 10+ characters with upper, lower, digit and symbol. In production, staff identities are federated from the bank&apos;s directory (AD / SSO).</p>
            </ActionForm>
          </details>
        </Card>
      </div>
    </>
  );
}
