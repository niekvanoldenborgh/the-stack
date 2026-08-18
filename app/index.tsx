import { Redirect } from 'expo-router';
import { View } from 'react-native';

import { useAppStore } from '../src/store/useAppStore';
import { Logo } from '../src/ui/components';
import { useTheme } from '../src/ui/theme';

export default function Index() {
  const theme = useTheme();
  const hydrated = useAppStore((state) => state.hydrated);
  const acceptedAt = useAppStore((state) => state.profile?.acceptedDisclaimerAt);
  const acceptedTermsAt = useAppStore((state) => state.profile?.acceptedTermsAt);
  const stackCount = useAppStore((state) => state.stacks.length);

  if (!hydrated) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.color.background, alignItems: 'center', justifyContent: 'center' }}>
        <Logo size={44} />
      </View>
    );
  }

  // Both are stamped together in onboarding's finish() — checking both here
  // (rather than trusting `acceptedAt` alone) is what makes the ToS gate
  // (THEA-93) actually block, including for upgrading users whose profile
  // predates it and so has `acceptedTermsAt` absent.
  if (!acceptedAt || !acceptedTermsAt) return <Redirect href="/onboarding" />;
  // Onboarding finished but nothing was ever accepted — resume at the
  // recommendation rather than dropping into an empty dashboard.
  if (stackCount === 0) return <Redirect href="/recommendation" />;
  return <Redirect href="/(tabs)" />;
}
