import { z } from "zod";
import { safeNextPath } from "./redirect";

export type AuthMode = "login" | "signup";
const emailSchema = z.string().trim().email().max(254);
const nameSchema = z.string().trim().min(2, "Enter your full name.").max(80);

export function authPageHref(mode: AuthMode, next: string): string {
  return `/${mode}?${new URLSearchParams({ next: safeNextPath(next) })}`;
}

export function authCallbackUrl(origin: string, next: string): string {
  const url = new URL(origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.origin !== origin || (url.protocol !== "https:" && !(url.protocol === "http:" && local))) throw new Error("Invalid sign-in origin.");
  const callback = new URL("/auth/callback", origin);
  callback.searchParams.set("next", safeNextPath(next));
  return callback.href;
}

/** The login screen must never silently create an email account. */
export function emailLinkRequest(mode: AuthMode, email: string, fullName: string, origin: string, next: string) {
  return {
    email: emailSchema.parse(email),
    options: {
      shouldCreateUser: mode === "signup",
      emailRedirectTo: authCallbackUrl(origin, next),
      ...(mode === "signup" ? { data: { full_name: nameSchema.parse(fullName) } } : {}),
    },
  };
}
