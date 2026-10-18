"use client";

import { useActionState, useState } from "react";
import { initialState, type ActionState } from "@/lib/action-state";
import { GeoFields } from "@/components/geo-fields";

type Action = (prev: ActionState, fd: FormData) => Promise<ActionState>;

export function SignPanel({ capacity, fullName, hash, canDecline, requestOtp, sign }: { capacity: string; fullName: string; hash: string; canDecline: boolean; requestOtp: Action; sign: Action }) {
  const [otpState, askOtp, asking] = useActionState(requestOtp, initialState);
  const [signState, doSign, signing] = useActionState(sign, initialState);
  const [declining, setDeclining] = useState(false);
  const challengeId = otpState.data?.challengeId as string | undefined;

  if (signState.ok) {
    return <div className="rounded-lg border border-ok/30 bg-ok/10 p-4 text-sm text-ok">{signState.message}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-surface-2 p-3 text-sm">
        You are signing as <strong>{capacity}</strong>. Your electronic signature will be bound to document hash <code className="mono">{hash.slice(0, 16)}…</code>, the time, your location and this device (Electronic Transactions Ordinance 2002; SBP SME PR R-14 v).
      </div>
      {!challengeId ? (
        <form action={askOtp} className="space-y-2">
          <GeoFields />
          {otpState.error && <p className="text-sm text-bad">{otpState.error}</p>}
          <button className="btn btn-primary" disabled={asking}>
            {asking ? "Sending…" : "Send signing OTP to my mobile"}
          </button>
        </form>
      ) : (
        <form action={doSign} className="space-y-3">
          <GeoFields />
          <input type="hidden" name="challengeId" value={challengeId} />
          <input type="hidden" name="decision" value={declining ? "DECLINED" : "SIGNED"} />
          {otpState.message && <p className="text-sm text-muted">{otpState.message}</p>}
          {otpState.data?.devCode && (
            <p className="rounded-lg border border-info/30 bg-info/10 p-2 text-sm text-info">
              Demo SMS gateway — OTP: <strong className="font-mono tracking-widest">{String(otpState.data.devCode)}</strong>
            </p>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="label">Type your full name</label>
              <input name="typedName" className="input" placeholder={fullName} required autoComplete="off" />
            </div>
            <div>
              <label className="label">OTP</label>
              <input name="otp" inputMode="numeric" pattern="\d{6}" maxLength={6} className="input font-mono tracking-widest" required autoComplete="one-time-code" />
            </div>
          </div>
          {declining && <textarea name="reason" className="input" rows={2} placeholder="Reason for declining" required />}
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" name="consent" required className="mt-1" />
            <span>{declining ? "I confirm I am declining this document." : "I have read and understood this document, its Urdu summary where provided, and I agree to be bound by it. I intend this to be my electronic signature."}</span>
          </label>
          {signState.error && <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{signState.error}</p>}
          <div className="flex flex-wrap gap-2">
            <button className={declining ? "btn btn-danger" : "btn btn-primary"} disabled={signing}>
              {signing ? "Sealing…" : declining ? "Decline document" : "Sign electronically"}
            </button>
            {canDecline && (
              <button type="button" className="btn" onClick={() => setDeclining((d) => !d)}>
                {declining ? "Back to signing" : "Decline instead"}
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
