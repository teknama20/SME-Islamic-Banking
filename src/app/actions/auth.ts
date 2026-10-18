"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { login, logout, resendLoginOtp, verifyLoginOtp } from "@/lib/auth";

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const r = await login(String(fd.get("bank") ?? ""), String(fd.get("username") ?? ""), String(fd.get("password") ?? ""));
  if (!r.ok) return { error: r.error };
  if (!r.mfa) redirect("/dashboard");
  return { ok: true, data: { step: "otp", devCode: r.devCode } };
}

export async function verifyOtpAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const r = await verifyLoginOtp(String(fd.get("otp") ?? ""));
  if (!r.ok) return { error: r.error, data: { step: "otp" } };
  redirect("/dashboard");
}

export async function resendOtpAction(): Promise<ActionState> {
  const code = await resendLoginOtp();
  return { ok: true, message: "A new code has been sent.", data: { step: "otp", devCode: code } };
}

export async function logoutAction() {
  await logout();
  redirect("/login");
}
