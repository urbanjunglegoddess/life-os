import { SafeAreaView } from 'react-native-safe-area-context';

import { TodayFlow } from '../components/today/TodayFlow.tsx';

export default function TodayRoute() {
  return (
    <SafeAreaView className="flex-1 bg-base">
      <TodayFlow />
    </SafeAreaView>
  );
}
