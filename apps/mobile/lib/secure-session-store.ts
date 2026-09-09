import * as SecureStore from 'expo-secure-store';

/**
 * Supabase auth storage backed by `expo-secure-store`.
 *
 * The Supabase quickstart uses AsyncStorage, which is UNENCRYPTED on disk. This
 * app holds journals, finances and children's records, and the stack was locked
 * on `expo-secure-store` for exactly that reason — it stores through the iOS
 * Keychain and the Android Keystore.
 *
 * SecureStore warns and can fail above 2048 bytes per value, and a Supabase
 * session (access token + refresh token + user claims) regularly exceeds that.
 * So values are chunked. The chunk count lives at `<key>.n`; the parts at
 * `<key>.0`, `<key>.1`, and so on. A session that silently failed to persist
 * would log the user out on every cold start — the one thing session
 * persistence exists to prevent — so this is not a detail to leave to chance.
 */

// Comfortably under the 2048-byte limit, which counts encrypted bytes rather
// than the plaintext measured here.
const CHUNK_SIZE = 1536;

const countKey = (key: string) => `${key}.n`;
const partKey = (key: string, i: number) => `${key}.${i}`;

async function readCount(key: string): Promise<number> {
  const raw = await SecureStore.getItemAsync(countKey(key));
  const n = raw === null ? 0 : Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function deleteParts(key: string, from: number, to: number) {
  for (let i = from; i < to; i += 1) {
    await SecureStore.deleteItemAsync(partKey(key, i));
  }
}

export const SecureSessionStore = {
  async getItem(key: string): Promise<string | null> {
    const count = await readCount(key);
    if (count === 0) return null;

    const parts: string[] = [];
    for (let i = 0; i < count; i += 1) {
      const part = await SecureStore.getItemAsync(partKey(key, i));
      // A missing part means a torn write. Half a session is not a session —
      // report absence and let Supabase re-authenticate rather than hand back
      // a truncated token that fails in a way nothing explains.
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    const previousCount = await readCount(key);

    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }

    for (let i = 0; i < chunks.length; i += 1) {
      await SecureStore.setItemAsync(partKey(key, i), chunks[i] as string);
    }
    await SecureStore.setItemAsync(countKey(key), String(chunks.length));

    // A shorter session than last time leaves orphaned tail chunks behind.
    // They are unreachable once the count shrinks, but they are still decrypted
    // token material sitting in the keychain.
    if (previousCount > chunks.length) {
      await deleteParts(key, chunks.length, previousCount);
    }
  },

  async removeItem(key: string): Promise<void> {
    const count = await readCount(key);
    await deleteParts(key, 0, count);
    await SecureStore.deleteItemAsync(countKey(key));
  },
};
