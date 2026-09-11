import { z } from 'zod';

/**
 * Environment for the web app, validated at the boundary.
 *
 * NEXT_PUBLIC_ rather than EXPO_PUBLIC_ — the two apps have different build
 * systems and each only inlines its own prefix. Read as static expressions for
 * the same reason as the mobile app: Next substitutes these literally and cannot
 * see a dynamic lookup.
 *
 * The service-key check lives in scripts/check-secrets.sh rather than being
 * copied here. It is repo-wide and mechanical, and a second copy of the
 * detection constants is exactly the drift a single definition prevents.
 */
const RAW = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
};

const EnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_URL is missing — copy env.example to .env')
    .refine((v) => v.startsWith('https://'), 'Supabase URL must be https'),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing'),
});

export function readEnv() {
  const parsed = EnvSchema.safeParse(RAW);
  if (!parsed.success) {
    throw new Error(
      'Invalid environment:\n' +
        parsed.error.issues.map((i) => `  • ${i.message}`).join('\n'),
    );
  }
  return parsed.data;
}
