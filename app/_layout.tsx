import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { configureNotificationHandler, ensureAndroidChannel } from '../src/lib/notifications';
import { ThemeProvider, typography, useTheme, useThemeMode } from '../src/ui/theme';

// Must run at module scope, before the first render, and must not be awaited.
// The .catch only silences the unhandled-rejection warning.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // Deliberately deep-imported per weight. Each package's barrel entry eagerly
  // requires every face it ships, and Metro does not tree-shake them.
  // The map keys become the fontFamily strings used in src/ui/theme.ts.
  // IBM Plex Mono is retired (PULSE — THEA-69): quantities now use Inter with
  // `tabular-nums` instead of a lab-notebook monospace voice.
  const [fontsLoaded, fontError] = useFonts({
    Inter_800ExtraBold,
    Inter_700Bold,
    Inter_600SemiBold,
    Inter_500Medium,
    Inter_400Regular,
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

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RootNavigator fontsReady={fontsLoaded || Boolean(fontError)} />
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Split out from `RootLayout` so it can call `useTheme()` — which reads the
 *  store via `ThemeProvider` — without the provider being an ancestor of
 *  itself. */
function RootNavigator({ fontsReady }: { fontsReady: boolean }) {
  const theme = useTheme();
  const mode = useThemeMode();

  if (!fontsReady) {
    // On native this is never seen; the native splash is still up. On web
    // expo-splash-screen is a no-op, so paint the theme background rather
    // than returning null, which would flash the wrong colour.
    return <View style={{ flex: 1, backgroundColor: theme.color.background }} />;
  }

  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.color.background },
          headerTintColor: theme.color.textPrimary,
          headerTitleStyle: typography.heading,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: theme.color.background },
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
    </>
  );
}
