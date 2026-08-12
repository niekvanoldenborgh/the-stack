import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAppStore } from '../src/store/useAppStore';
import { colors } from '../src/ui/theme';

export default function Index() {
  const hydrated = useAppStore((state) => state.hydrated);
  const acceptedAt = useAppStore((state) => state.profile?.acceptedDisclaimerAt);
  const stackCount = useAppStore((state) => state.stacks.length);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (!acceptedAt) return <Redirect href="/onboarding" />;
  // Onboarding finished but nothing was ever accepted — resume at the
  // recommendation rather than dropping into an empty dashboard.
  if (stackCount === 0) return <Redirect href="/recommendation" />;
  return <Redirect href="/(tabs)" />;
}
