import { BricolageGrotesque_200ExtraLight } from '@expo-google-fonts/bricolage-grotesque/200ExtraLight';
import { BricolageGrotesque_800ExtraBold } from '@expo-google-fonts/bricolage-grotesque/800ExtraBold';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';
import { IBMPlexMono_600SemiBold } from '@expo-google-fonts/ibm-plex-mono/600SemiBold';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { configureNotificationHandler, ensureAndroidChannel } from '../src/lib/notifications';
import { colors, typography } from '../src/ui/theme';

// Must run at module scope, before the first render, and must not be awaited.
// The .catch only silences the unhandled-rejection warning.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // Deliberately deep-imported per weight. Each package's barrel entry eagerly
  // requires every face it ships, and Metro does not tree-shake them.
  // The map keys become the fontFamily strings used in src/ui/theme.ts.
  const [fontsLoaded, fontError] = useFonts({
    // Display voice, used at both extremes of the weight axis.
    BricolageGrotesque_800ExtraBold,
    BricolageGrotesque_200ExtraLight,
    // Reading text.
    IBMPlexSans_400Regular,
    IBMPlexSans_600SemiBold,
    // Every quantity, unit and label.
    IBMPlexMono_500Medium,
    IBMPlexMono_600SemiBold,
  });

  useEffect(() => {
    configureNotificationHandler();
    void ensureAndroidChannel();
  }, []);

  useEffect(() => {
    // Hide on error too — a font failure must not leave the app stuck behind
    // the splash screen forever.
    if (fontsLoaded || fontError) void SplashScreen.hideAsync();
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    // On native this is never seen; the native splash is still up. On web
    // expo-splash-screen is a no-op, so paint the app background rather than
    // returning null, which would flash white on a dark-themed app.
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: typography.heading,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding/index" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="recommendation" options={{ headerShown: false, gestureEnabled: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="peptide/[id]" options={{ title: '' }} />
        <Stack.Screen name="builder" options={{ title: 'Build a stack', presentation: 'modal' }} />
        <Stack.Screen name="safety" options={{ title: 'Safety report' }} />
        <Stack.Screen name="analytics" options={{ title: 'Analytics' }} />
        <Stack.Screen name="session/[id]" options={{ title: 'Log session' }} />
      </Stack>
    </SafeAreaProvider>
  );
}
