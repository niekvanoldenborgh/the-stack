import { Tabs } from 'expo-router';
import { Calendar, House, SquarePlus, Settings, TrendingUp } from 'lucide-react-native';

import { fonts, radius, typography, useTheme, withOpacity } from '../../src/ui/theme';

export default function TabsLayout() {
  const theme = useTheme();
  const { color } = theme;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: color.background },
        headerTintColor: color.textPrimary,
        headerTitleStyle: typography.heading,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: color.background },
        // Floating inset pill (spec-v2 §3.9), not an edge-to-edge docked bar.
        // KIMI uses `backdrop-filter: blur(12px)` behind the bar — no literal
        // RN equivalent (AGENTS.md), and `expo-blur` would be a second
        // unplanned native module this redesign cycle (THEA-45 already added
        // one). Solid translucent fallback instead; reversible later if the
        // owner specifically wants the blur.
        tabBarStyle: {
          position: 'absolute',
          left: 14,
          right: 14,
          bottom: 14,
          height: 64,
          borderRadius: radius.xl,
          backgroundColor: withOpacity(color.surface, 0.92),
          borderTopWidth: 0,
          paddingBottom: 0,
          paddingTop: 0,
          // Hero-tier shadow reads closest to KIMI's 0 12px 32px -8px.
          ...theme.shadow(3),
        },
        tabBarItemStyle: { paddingVertical: 6 },
        tabBarActiveTintColor: color.primary,
        tabBarInactiveTintColor: color.textSecondary,
        tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.medium },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Summary',
          headerShown: false,
          tabBarIcon: ({ color: c, size }) => <House color={c} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="logger"
        options={{
          title: 'Logger',
          headerShown: false,
          tabBarIcon: ({ color: c, size }) => <SquarePlus color={c} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'Results',
          headerShown: false,
          tabBarIcon: ({ color: c, size }) => <TrendingUp color={c} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          headerShown: false,
          tabBarIcon: ({ color: c, size }) => <Calendar color={c} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color: c, size }) => <Settings color={c} size={size} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
