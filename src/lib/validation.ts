import { v } from "convex/values";

/**
 * Phone number validation. Accepts + international and common local formats
 * (7-15 digits after normalization). Returns null when invalid.
 */
export function parsePhone(input: string): {
  normalized: string;
  display: string;
} | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const plus = trimmed.startsWith("+");
  const digits = trimmed.replace(/[\s\-().]/g, "").replace(/^\+/, "");
  if (!/^\d{7,15}$/.test(digits)) return null;

  return {
    normalized: plus ? `+${digits}` : digits,
    display: plus ? `+${digits}` : digits,
  };
}

/** Basic email sanity check for trusted-contact emails. */
export function isValidEmail(email: string): boolean {
  const trimmed = email.trim();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) && trimmed.length <= 254;
}

export function sanitizeText(input: string, maxLength: number): string {
  return input.trim().replace(/\s+/g, " ").slice(0, maxLength);
}

// ---------------------------------------------------------------------------
// Convex validators mirroring the helpers above so the same rules run server
// side. Keep in sync with parsePhone / isValidEmail.
// ---------------------------------------------------------------------------

export const phoneValidator = v.string();
export const emailValidator = v.string();
