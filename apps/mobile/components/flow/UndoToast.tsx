import { Pressable, Text, View } from 'react-native';
import { LAYER, SPACE, TARGET } from '@life-os/tokens';

/**
 * The undo toast — artboard 1d, and the reason `z-toast` exists in the token
 * module ("Toasts, undo, pending-write notices", 4.7 §10.2).
 *
 * NO TIMER, deliberately. §5.3 bans them from the flow, and a self-dismissing
 * undo is the worst version of this control: it puts a deadline on noticing a
 * mistake, and the people this app is built for are precisely the ones who
 * will look up three seconds too late. It stays until the next answer replaces
 * it or the sequence ends.
 *
 * It floats rather than sitting in the layout because §5.2 makes position
 * load-bearing — the response row below must not shift down by a toast's
 * height between one card and the next.
 */

/**
 * Clear of the response row: the 48pt tap floor plus that row's own padding
 * (`pt-4` + `pb-8`), plus one step of air. Derived from the scale rather than
 * typed as a number so it tracks the row if the row is ever restyled.
 */
const ABOVE_RESPONSE_ROW =
  TARGET['tap-target-min'] +
  SPACE['space-4'] +
  SPACE['space-8'] +
  SPACE['space-2'];

export interface UndoToastProps {
  /** What just happened, stated flatly. No exclamation, no praise. */
  readonly message: string;
  readonly actionLabel: string;
  readonly actionHint: string;
  readonly onAction: () => void;
  readonly disabled?: boolean;
}

export function UndoToast({
  message,
  actionLabel,
  actionHint,
  onAction,
  disabled = false,
}: UndoToastProps) {
  return (
    <View
      style={{ zIndex: LAYER['z-toast'], bottom: ABOVE_RESPONSE_ROW }}
      className="absolute left-4 right-4 flex-row items-center justify-between gap-3 rounded-lg border-thin border-meaningful bg-elevated p-3"
      /*
        Android reads a live region on its own. iOS does not, and the honest
        position is that VoiceOver users reach this by swiping to it rather
        than being interrupted — which is the better behaviour for something
        that is not urgent and must not steal focus mid-sequence.
      */
      accessibilityLiveRegion="polite"
    >
      <Text className="flex-1 text-base text-primary">{message}</Text>
      <Pressable
        onPress={onAction}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={actionLabel}
        accessibilityHint={actionHint}
        accessibilityState={{ disabled }}
        hitSlop={TARGET['hit-slop-default']}
        style={{ minHeight: TARGET['tap-target-min'] }}
        className={[
          'justify-center rounded-md border-thin border-focus px-4',
          disabled ? 'opacity-disabled' : '',
        ].join(' ')}
      >
        <Text className="text-base font-semibold text-accent-primary">
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}
