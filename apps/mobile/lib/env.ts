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
};

/**
 * Rule 4 exists because anything in a React Native bundle is extractable, and a
 * service key pasted into the wrong variable is invisible until someone dumps
 * the bundle. `sb_secret_` is the modern secret prefix; the legacy service key
 * is a JWT whose payload carries `"role":"service_role"`, which survives
 * base64 into the raw token as this fragment.
 */
function assertNotASecretKey(key: string): string {
  const looksSecret =
    key.startsWith('sb_secret_') || key.includes('InNlcnZpY2Vfcm9sZSI');
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
