"use client";

import { useMemo, useState } from "react";
import { ActionForm } from "@/components/action-form";
import type { ActionState } from "@/lib/action-state";
import type { FieldSpec } from "@/lib/products/types";

export type ProductOption = {
  code: string;
  name: string;
  nameUrdu: string;
  summary: string;
  fields: FieldSpec[];
  repaymentOptions: string[];
  maxTenorMonths: number;
};

type Defaults = {
  customerId?: string;
  productCode?: string;
  purpose?: string;
  amount?: number;
  tenorMonths?: number;
  profitRate?: number;
  benchmark?: string;
  repayment?: string;
  securityType?: string;
  collateral?: string;
  liquidLien?: number;
  ecibJustification?: string;
  structure?: Record<string, string>;
};

export function CaseForm({
  action,
  customers,
  products,
  defaults = {},
  editing = false,
}: {
  action: (prev: ActionState, fd: FormData) => Promise<ActionState>;
  customers: { id: string; label: string }[];
  products: ProductOption[];
  defaults?: Defaults;
  editing?: boolean;
}) {
  const [code, setCode] = useState(defaults.productCode ?? products[0].code);
  const [security, setSecurity] = useState(defaults.securityType ?? "SECURED");
  const product = useMemo(() => products.find((p) => p.code === code)!, [code, products]);
  const s = defaults.structure ?? {};

  return (
    <ActionForm action={action} submitLabel={editing ? "Save changes" : "Create draft request"} geo>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="label">Customer</label>
          <select name="customerId" className="input" defaultValue={defaults.customerId} required disabled={editing}>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {editing && <input type="hidden" name="customerId" value={defaults.customerId} />}
        </div>
        <div>
          <label className="label">Islamic mode of financing</label>
          <select name="productCode" className="input" value={code} onChange={(e) => setCode(e.target.value)} disabled={editing}>
            {products.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} — {p.nameUrdu}
              </option>
            ))}
          </select>
          {editing && <input type="hidden" name="productCode" value={code} />}
        </div>
      </div>
      <p className="rounded-lg bg-surface-2 p-3 text-sm text-muted">{product.summary}</p>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="sm:col-span-3">
          <label className="label">Purpose of financing</label>
          <input name="purpose" className="input" required defaultValue={defaults.purpose} />
        </div>
        <div>
          <label className="label">Financing amount (PKR)</label>
          <input name="amount" type="number" min={1} className="input" required defaultValue={defaults.amount} />
        </div>
        <div>
          <label className="label">Tenor (months, max {product.maxTenorMonths})</label>
          <input name="tenorMonths" type="number" min={1} max={product.maxTenorMonths} className="input" required defaultValue={defaults.tenorMonths} />
        </div>
        <div>
          <label className="label">Repayment</label>
          <select name="repayment" className="input" defaultValue={defaults.repayment} key={code}>
            {product.repaymentOptions.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Profit rate (% p.a.)</label>
          <input name="profitRate" type="number" step="0.01" min={0} className="input" required defaultValue={defaults.profitRate} />
        </div>
        <div>
          <label className="label">Benchmark</label>
          <input name="benchmark" className="input" defaultValue={defaults.benchmark ?? "6M KIBOR + spread"} />
        </div>
        <div>
          <label className="label">Liquid assets under lien (PKR, R-5)</label>
          <input name="liquidLien" type="number" min={0} className="input" defaultValue={defaults.liquidLien ?? 0} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="label">Security</label>
          <select name="securityType" className="input" value={security} onChange={(e) => setSecurity(e.target.value)}>
            <option value="SECURED">Secured (R-13)</option>
            <option value="CLEAN">Clean — personal guarantee only (R-9, max PKR 50m)</option>
          </select>
        </div>
        <div className="sm:col-span-2">
          <label className="label">{security === "CLEAN" ? "Notes (optional)" : "Securities & margin"}</label>
          <input name="collateral" className="input" required={security === "SECURED"} defaultValue={defaults.collateral} placeholder="e.g. Hypothecation of stocks with 25% margin; equitable mortgage (FSV PKR …)" />
        </div>
        <div>
          <label className="label">Guarantor (optional)</label>
          <input name="s_guarantorName" className="input" defaultValue={s.guarantorName} placeholder="Name of personal guarantor" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">e-CIB overdue justification (R-7, if applicable)</label>
          <input name="ecibJustification" className="input" defaultValue={defaults.ecibJustification} />
        </div>
      </div>

      <h3 className="pt-2 text-sm font-semibold">{product.name} structure</h3>
      <div className="grid gap-4 sm:grid-cols-2" key={code}>
        {product.fields.map((f) => (
          <div key={f.name} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
            <label className="label">{f.label}</label>
            {f.type === "textarea" ? (
              <textarea name={`s_${f.name}`} className="input" rows={2} required={f.required} defaultValue={s[f.name]} />
            ) : f.type === "select" ? (
              <select name={`s_${f.name}`} className="input" required={f.required} defaultValue={s[f.name]}>
                {f.options?.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            ) : (
              <input name={`s_${f.name}`} type={f.type} className="input" required={f.required} defaultValue={s[f.name]} />
            )}
            {f.help && <p className="mt-1 text-xs text-muted">{f.help}</p>}
          </div>
        ))}
      </div>
    </ActionForm>
  );
}
