import { z } from 'zod';

/**
 * Environment, validated at the boundary (CLAUDE.md — Zod at every boundary).
 *
 * Each variable is read as a STATIC `process.env.EXPO_PUBLIC_*` expression.
 * Expo's Babel transform substitutes these literally at build time; it cannot
 * see a dynamic lookup, so iterating over `process.env` would yield undefined
 * in a release bundle while working fine in dev.
 */
const RAW = {
  EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  EXPO_PUBLIC_WEB_URL: process.env.EXPO_PUBLIC_WEB_URL,
};

/**
 * Rule 4 exists because anything in a React Native bundle is extractable, and a
 * service key pasted into the wrong variable is invisible until someone dumps
 * the bundle.
 *
 * Two shapes to catch. `sb_secret_` is the modern prefix. The legacy key is a
 * JWT whose payload carries `"role":"service_role"` — and base64 encodes that
 * text differently depending on its byte offset within the payload, so there is
 * no single fragment to grep for. There are exactly three alignments, because
 * base64 works in three-byte groups; all three are listed. Matching only one of
 * them misses roughly two keys in three.
 */
const SERVICE_ROLE_BASE64_ALIGNMENTS = [
  'nJvbGUiOiJzZXJ2aWN',
  'Jyb2xlIjoic2Vydmlj',
  'icm9sZSI6InNlcnZpY',
];

function assertNotASecretKey(key: string): string {
  const looksSecret =
    key.startsWith('sb_secret_') ||
    SERVICE_ROLE_BASE64_ALIGNMENTS.some((fragment) => key.includes(fragment));
  if (looksSecret) {
    throw new Error(
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY holds a SERVICE-ROLE key. ' +
        'That key bypasses RLS and must never reach the client bundle. ' +
        'Use the publishable (sb_publishable_...) key.',
    );
  }
  return key;
}

const EnvSchema = z.object({
  EXPO_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1, 'EXPO_PUBLIC_SUPABASE_URL is missing — copy env.example to .env')
    .refine((v) => v.startsWith('https://'), 'Supabase URL must be https'),
  EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(
      1,
      'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing — copy env.example to .env',
    )
    .transform(assertNotASecretKey),
  /**
   * Origin of the `apps/web` compliance site — the privacy policy, the terms,
   * and the account-deletion request route Google Play requires (ADR-0014).
   *
   * OPTIONAL, and deliberately has no default. The site is not deployed and no
   * domain has been chosen, so a fallback here would be a guessed URL shipped
   * as a live link. Settings renders the paths as plain text until this is set
   * and links them once it is.
   */
  EXPO_PUBLIC_WEB_URL: z
    .string()
    .optional()
    // An unset variable and one set to the empty string mean the same thing —
    // not configured. Without this, `EXPO_PUBLIC_WEB_URL=` in a .env would
    // throw at startup on the https check.
    .transform((v) => (v === undefined || v.trim() === '' ? undefined : v.trim()))
    .refine(
      (v) => v === undefined || v.startsWith('https://'),
      'EXPO_PUBLIC_WEB_URL must be https',
    ),
});

const parsed = EnvSchema.safeParse(RAW);

if (!parsed.success) {
  // Failing loudly at import beats a client that constructs fine and then 401s
  // on every call with nothing pointing at the cause.
  throw new Error(
    'Invalid environment:\n' +
      parsed.error.issues.map((i) => `  • ${i.message}`).join('\n'),
  );
}

export const ENV = parsed.data;
