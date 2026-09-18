import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { readFailedWrites } from '../../lib/writeLog.ts';
import {
  failedWriteWhen,
  writeFailureKindLabel,
  writeOpLabel,
  type WriteLogEntry,
} from '../../lib/writeLogEntry.ts';

/**
 * The failed-write log, read back — ADR-0012, build order step 9.
 *
 * The log is required so the beta week can be read honestly, and a log nobody
 * can see is not an instrument. It lives in Settings rather than anywhere in
 * the daily loop deliberately: it is evidence for the review, and putting a
 * failure count in front of someone at 6am would add friction to the thing
 * being measured.
 *
 * Reference, not a decision queue — so a scannable list, not a flow (IA §7.4).
 */

/** Enough to see a pattern on the device; the full log is on disk for the gate. */
const SHOWN = 10;

export function FailedWriteLog() {
  const [entries, setEntries] = useState<readonly WriteLogEntry[] | null>(null);

  useEffect(() => {
    let active = true;
    // `readFailedWrites` swallows its own failures and returns empty — the log
    // of last resort has nowhere left to report to. So there is no error state
    // here, and deliberately no empty-versus-broken distinction to draw.
    void readFailedWrites().then((e) => active && setEntries(e));
    return () => {
      active = false;
    };
  }, []);

  if (entries === null) {
    return <Text className="text-sm text-muted">Loading…</Text>;
  }

  /* ---------- NOTHING HAS FAILED ---------- */
  if (entries.length === 0) {
    return (
      <View className="gap-1 rounded-lg border-thin border-decorative bg-surface p-4">
        <Text className="text-base text-primary">Nothing has failed to save</Text>
        <Text className="text-sm leading-relaxed text-muted">
          This app needs a connection to save. When a save fails it is recorded
          here with the time, so a bad week of signal can be told apart from a
          bad week of using the app.
        </Text>
      </View>
    );
  }

  const now = new Date();
  const shown = entries.slice(0, SHOWN);

  return (
    <View className="gap-2">
      <Text className="text-base leading-relaxed text-muted">
        {entries.length === 1
          ? 'One save has failed. Nothing here was retried for you.'
          : `${entries.length} saves have failed. Nothing here was retried for you.`}
      </Text>

      {shown.map((entry, i) => (
        /*
          Keyed on time plus op plus index: two failures CAN share a millisecond
          — a flaky connection fails several writes at once — and a key collision
          would silently drop one from a list whose whole purpose is the count.
        */
        <View
          key={`${entry.at}-${entry.op}-${i}`}
          className="gap-1 rounded-lg border-thin border-decorative bg-surface p-4"
        >
          <Text className="text-base text-primary">{writeOpLabel(entry.op)}</Text>
          {/* The state is spoken in words; ember is not audible (4.8 §7). */}
          <Text className="text-sm text-muted">
            {failedWriteWhen(entry.at, now)} · {writeFailureKindLabel(entry.kind)}
          </Text>
        </View>
      ))}

      {entries.length > shown.length && (
        <Text className="text-sm text-muted">
          {entries.length - shown.length} older, kept on this device.
        </Text>
      )}
    </View>
  );
}
