import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CaptureFlow } from '../components/capture/CaptureFlow.tsx';

export default function CaptureRoute() {
  return (
    <SafeAreaView className="flex-1 bg-base">
      <CaptureFlow onDone={() => router.replace('/')} />
    </SafeAreaView>
  );
}
