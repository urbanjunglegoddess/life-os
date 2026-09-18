import { Pressable, Text, View } from 'react-native';
import { TARGET } from '@life-os/tokens';

export type FlowActionEmphasis = 'primary' | 'secondary';

export interface FlowActionSpec {
  readonly label: string;
  /** What happens, for a screen reader (4.8 §7.1). Never "button". */
  readonly hint?: string;
  readonly emphasis?: FlowActionEmphasis;
  readonly onPress: () => void;
  readonly disabled?: boolean;
}

/**
 * One response in a flow's fixed action row.
 *
 * The 48pt floor is a functional requirement, not a visual one (4.5 §5): the
 * core interaction is repeated tapping on a phone, one-handed, at 6am, and a
 * target a few points short is a failed log rather than a cosmetic flaw. It is
 * `minHeight` rather than `height` because the label must be free to grow with
 * the OS font scale — a fixed height around scaled text is a defect (4.8 §6).
 */
export function FlowAction({
  label,
  hint,
  emphasis = 'secondary',
  onPress,
  disabled = false,
}: FlowActionSpec) {
  const isPrimary = emphasis === 'primary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled }}
      hitSlop={TARGET['hit-slop-default']}
      style={{ minHeight: TARGET['tap-target-min'], flex: 1 }}
      className={[
        'justify-center rounded-md px-4 py-3',
        isPrimary
          ? 'bg-accent-primary'
          : 'border-thin border-meaningful bg-surface',
        disabled ? 'opacity-disabled' : '',
      ].join(' ')}
    >
      {({ pressed }) => (
        <View className={pressed && !disabled ? 'opacity-pressed' : ''}>
          <Text
            className={[
              'text-center text-base font-semibold',
              isPrimary ? 'text-on-warm' : 'text-primary',
            ].join(' ')}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
