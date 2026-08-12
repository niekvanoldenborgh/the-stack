import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import type { Route } from '../domain/types';
import { colors } from './theme';

/**
 * Route iconography.
 *
 * How a compound goes in changes almost everything about the day-to-day
 * experience of taking it — an injection is a different commitment from a
 * serum. Showing that as a glyph makes a dose list scannable in a way the word
 * "subcutaneous" in small grey text never is.
 */
const ROUTE_ICONS: Record<Route, { name: keyof typeof MaterialCommunityIcons.glyphMap; label: string }> = {
  subcutaneous: { name: 'needle', label: 'Subcutaneous injection' },
  intramuscular: { name: 'needle', label: 'Intramuscular injection' },
  oral: { name: 'pill', label: 'Oral' },
  topical: { name: 'lotion-outline', label: 'Topical' },
  nasal: { name: 'spray', label: 'Nasal spray' },
};

export function RouteIcon({
  route,
  size = 16,
  color = colors.textMuted,
}: {
  route: Route;
  size?: number;
  color?: string;
}) {
  const icon = ROUTE_ICONS[route];
  return (
    <MaterialCommunityIcons
      name={icon.name}
      size={size}
      color={color}
      accessibilityLabel={icon.label}
    />
  );
}

export function routeLabel(route: Route): string {
  return ROUTE_ICONS[route].label;
}

/** Severity iconography, matched to the app's one severity colour scale. */
export function SeverityIcon({
  severity,
  size = 16,
}: {
  severity: 'critical' | 'high' | 'moderate' | 'info';
  size?: number;
}) {
  const map = {
    critical: { name: 'alert-circle' as const, color: colors.critical },
    high: { name: 'warning' as const, color: colors.high },
    moderate: { name: 'information-circle' as const, color: colors.moderate },
    info: { name: 'information-circle' as const, color: colors.info },
  }[severity];

  return <Ionicons name={map.name} size={size} color={map.color} />;
}
