import { Tabs } from 'expo-router';
import { Calendar, House, SquarePlus, Settings, TrendingUp } from 'lucide-react-native';
import { StyleSheet } from 'react-native';

import { colors, fonts, typography } from '../../src/ui/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        headerTitleStyle: typography.heading,
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textFaint,
        tabBarLabelStyle: { fontSize: 11, fontFamily: fonts.sansMedium },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Summary',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <House color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="logger"
        options={{
          title: 'Logger',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <SquarePlus color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="results"
        options={{
          title: 'Results',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <TrendingUp color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Calendar',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
