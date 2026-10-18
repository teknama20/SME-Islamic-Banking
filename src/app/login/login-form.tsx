"use client";

import { useActionState, useState } from "react";
import { loginAction, resendOtpAction, verifyOtpAction } from "@/app/actions/auth";
import { initialState } from "@/lib/action-state";

export function LoginForm({ defaultBank }: { defaultBank: string }) {
  const [loginState, login, loggingIn] = useActionState(loginAction, initialState);
  const [otpState, verify, verifying] = useActionState(verifyOtpAction, initialState);
  const [resendState, resend, resending] = useActionState(resendOtpAction, initialState);
  const [bank, setBank] = useState(defaultBank);
  const onOtp = loginState.data?.step === "otp" || otpState.data?.step === "otp";
  const devCode = resendState.data?.devCode ?? loginState.data?.devCode;

  if (onOtp) {
    return (
      <div className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold">Two-step verification</h2>
          <p className="text-sm text-muted">Enter the 6-digit code sent to your registered mobile number.</p>
        </div>
        {devCode && (
          <div className="rounded-lg border border-info/30 bg-info/10 p-3 text-sm text-info">
            Demo SMS gateway: your code is <strong className="font-mono tracking-widest">{String(devCode)}</strong>
          </div>
        )}
        <form action={verify} className="space-y-3">
          <input name="otp" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} required autoFocus className="input text-center font-mono text-lg tracking-[0.5em]" placeholder="••••••" />
          {otpState.error && <p className="text-sm text-bad">{otpState.error}</p>}
          <button className="btn btn-primary w-full" disabled={verifying}>
            {verifying ? "Verifying…" : "Verify & sign in"}
          </button>
        </form>
        <form action={resend}>
          <button className="text-sm text-muted underline hover:text-ink" disabled={resending}>
            Resend code
          </button>
          {resendState.message && <span className="ml-2 text-xs text-ok">{resendState.message}</span>}
        </form>
      </div>
    );
  }

  return (
    <form action={login} className="space-y-4">
      <div>
        <label className="label" htmlFor="bank">
          Bank code
        </label>
        <input id="bank" name="bank" value={bank} onChange={(e) => setBank(e.target.value.toUpperCase())} required className="input uppercase" autoComplete="organization" />
      </div>
      <div>
        <label className="label" htmlFor="username">
          Username
        </label>
        <input id="username" name="username" required className="input" autoComplete="username" autoFocus />
      </div>
      <div>
        <label className="label" htmlFor="password">
          Password
        </label>
        <input id="password" name="password" type="password" required className="input" autoComplete="current-password" />
      </div>
      {loginState.error && <p className="rounded-lg border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{loginState.error}</p>}
      <button className="btn btn-primary w-full" disabled={loggingIn}>
        {loggingIn ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
