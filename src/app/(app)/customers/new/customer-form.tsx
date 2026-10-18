"use client";

import { useState } from "react";
import { createCustomerAction } from "@/app/actions/workflow";
import { ActionForm } from "@/components/action-form";
import { LEGAL_FORMS } from "@/lib/constants";
import { SME_BANDS } from "@/lib/sbp";

const ROLES = ["PROPRIETOR", "DIRECTOR", "PARTNER", "UBO", "GUARANTOR", "SIGNATORY"];

export function CustomerForm({ sectors }: { sectors: string[] }) {
  const [rows, setRows] = useState(1);
  const [turnover, setTurnover] = useState("");
  const t = Number(turnover);
  const band = t > 0 ? (SME_BANDS.find((b) => t <= b.max)?.label ?? "Not an SME — exceeds PKR 2,000m") : null;

  return (
    <ActionForm action={createCustomerAction} submitLabel="Onboard customer" geo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Legal name" name="legalName" required />
        <Field label="Trade name" name="tradeName" />
        <div>
          <label className="label">Legal form</label>
          <select name="legalForm" className="input" required>
            {Object.entries(LEGAL_FORMS).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </div>
        <Field label="NTN" name="ntn" required placeholder="1234567-8" />
        <Field label="STRN" name="strn" />
        <Field label="SECP / registration no." name="registrationNo" />
        <Field label="Date established" name="establishedOn" type="date" />
        <div>
          <label className="label">Sector</label>
          <select name="sector" className="input" required>
            {sectors.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </div>
        <Field label="Business activity" name="businessActivity" />
        <div>
          <label className="label">Annual sales turnover (PKR)</label>
          <input name="annualTurnover" type="number" min={1} required className="input" value={turnover} onChange={(e) => setTurnover(e.target.value)} />
          {band && <p className="mt-1 text-xs text-brand">SBP classification: {band}</p>}
        </div>
        <Field label="Business address" name="address" required />
        <Field label="City" name="city" required />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="womenLed" /> Women-led enterprise (SME PR R-1 v)
        </label>
      </div>

      <h3 className="pt-4 text-sm font-semibold">Owners, directors, UBOs & signatories</h3>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid gap-3 rounded-lg border border-line p-3 sm:grid-cols-5">
          <input name={`people.${i}.fullName`} placeholder="Full name (as per CNIC)" className="input sm:col-span-2" required={i === 0} />
          <input name={`people.${i}.cnic`} placeholder="00000-0000000-0" className="input" required={i === 0} pattern="\d{5}-\d{7}-\d" />
          <select name={`people.${i}.role`} className="input">
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <input name={`people.${i}.sharePct`} type="number" min={0} max={100} placeholder="Share %" className="input" />
        </div>
      ))}
      <button type="button" className="btn btn-sm" onClick={() => setRows((r) => r + 1)}>
        + Add person
      </button>
      <p className="text-xs text-muted">Business premises are geo-tagged from this device (SME PR R-14 iv). RCAD is notified to perform KYC/CDD.</p>
    </ActionForm>
  );
}

function Field({ label, name, type = "text", required, placeholder }: { label: string; name: string; type?: string; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input name={name} type={type} required={required} placeholder={placeholder} className="input" />
    </div>
  );
}
