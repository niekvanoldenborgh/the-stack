import { CircleAlert, Droplet, Info, OctagonAlert, Pill, SprayCan, Syringe, TriangleAlert } from 'lucide-react-native';

import type { Route } from '../domain/types';
import { useTheme } from './theme';

/**
 * All iconography in this app comes from Lucide (ISC) — one single-weight
 * family, never mixed with another icon set or with emoji. Route glyphs and
 * severity glyphs are the two places an icon carries real information rather
 * than decoration, so they are centralised here instead of picked ad hoc at
 * each call site.
 */

/**
 * Route iconography.
 *
 * How a compound goes in changes almost everything about the day-to-day
 * experience of taking it — an injection is a different commitment from a
 * serum. Showing that as a glyph makes a dose list scannable in a way the word
 * "subcutaneous" in small grey text never is.
 */
const ROUTE_ICONS: Record<Route, { Icon: typeof Syringe; label: string }> = {
  subcutaneous: { Icon: Syringe, label: 'Subcutaneous injection' },
  intramuscular: { Icon: Syringe, label: 'Intramuscular injection' },
  oral: { Icon: Pill, label: 'Oral' },
  topical: { Icon: Droplet, label: 'Topical' },
  nasal: { Icon: SprayCan, label: 'Nasal spray' },
};

export function RouteIcon({ route, size = 16, color }: { route: Route; size?: number; color?: string }) {
  const theme = useTheme();
  const { Icon, label } = ROUTE_ICONS[route];
  return <Icon size={size} color={color ?? theme.color.textSecondary} accessibilityLabel={label} />;
}

export function routeLabel(route: Route): string {
  return ROUTE_ICONS[route].label;
}

/**
 * Severity iconography, matched to the app's one severity colour scale.
 *
 * Shape carries the same information as colour on purpose — colour alone is
 * never the only signal for severity in this app. Critical gets the most
 * distinct shape (a stop-sign octagon) since that is the one blocking finding
 * a user must not misread.
 */
const SEVERITY_SHAPES = {
  critical: OctagonAlert,
  high: TriangleAlert,
  moderate: CircleAlert,
  info: Info,
} as const;

export function SeverityIcon({
  severity,
  size = 16,
}: {
  severity: 'critical' | 'high' | 'moderate' | 'info';
  size?: number;
}) {
  const theme = useTheme();
  const Icon = SEVERITY_SHAPES[severity];
  return <Icon size={size} color={theme.tone(severity).fg} />;
}
