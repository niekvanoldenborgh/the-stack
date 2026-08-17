import { Tabs } from 'expo-router';
import { Calendar, House, SquarePlus, Settings, TrendingUp } from 'lucide-react-native';

import { fonts, typography, useTheme } from '../../src/ui/theme';

export default function TabsLayout() {
  const theme = useTheme();
  const { color } = theme;
  // Floating/elevated feel (design spec §3.7): no top border, a soft shadow
  // instead. `theme.shadow(2)` is the "raised" tier's shadow only, without
  // pulling in its `surfaceElevated` background — the bar stays on `surface`.
  const barShadow = theme.shadow(2);

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: color.background },
        headerTintColor: color.textPrimary,
        headerTitleStyle: typography.heading,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: color.background },
        tabBarStyle: {
          backgroundColor: color.surface,
          borderTopWidth: 0,
          ...barShadow,
        },
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
