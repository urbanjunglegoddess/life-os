import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { TodayFlow } from '../../components/today/TodayFlow.tsx';

export default function TodayRoute() {
  return (
    <SafeAreaView className="flex-1 bg-base">
      {/*
        A worked queue ends on the cleared screen, and the design's answer to
        "what now" there is capture — the app's other job, and the only one
        that makes sense at the moment nothing is owed. `replace`, not `push`:
        leaving Today on the stack would let a swipe drop the user back into a
        queue they have already worked.
      */}
      <TodayFlow onDone={() => router.replace('/capture')} />
    </SafeAreaView>
  );
}
