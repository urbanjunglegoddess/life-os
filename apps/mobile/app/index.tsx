import { SafeAreaView } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';

/**
 * The shell. It exists to prove one thing end to end: a route renders and the
 * token module reaches the screen through NativeWind.
 *
 * It is deliberately not a stand-in for the Today flow. BUILD-SPEC §7 puts the
 * reusable flow primitive (§5.2, §5.3) BEFORE any screen that uses it, and a
 * plausible-looking Today screen built ahead of that primitive is the exact
 * shape of the mistake the build order is written to prevent.
 */
export default function Shell() {
  return (
    <SafeAreaView className="flex-1 bg-base">
      <View className="flex-1 gap-6 p-4">
        <View className="gap-1">
          <Text className="text-2xl font-semibold text-primary">Life OS</Text>
          <Text className="text-sm text-muted">Slice one · app shell</Text>
        </View>

        <View className="gap-2 rounded-lg border-thin border-decorative bg-surface p-4">
          <Text className="text-base text-primary">Wired</Text>
          <Text className="text-sm text-muted">
            Expo Router · NativeWind · @life-os/tokens
          </Text>
        </View>

        <Text className="text-sm text-muted">
          Next: Supabase client and email OTP, then the flow primitive.
        </Text>
      </View>
    </SafeAreaView>
  );
}
