import { Pressable } from 'react-native';

import { RISK_TOLERANCES } from '../domain/goals';
import type { RiskTolerance } from '../domain/types';
import { Badge, Card, Data, Divider, Heading, Row, Small, Spacer } from './components';
import { radius, spacing, useTheme, type SeverityTone } from './theme';

/**
 * Colour the dial by how far up it is turned, so level 5 never looks benign.
 *
 * PULSE (THEA-68 §3.6) moves level 3 off the brand accent onto `moderate` —
 * every level now sits inside the reserved severity scale, so the whole dial
 * stays visually clear of the violet brand colour (design spec §2.1). Dose
 * and selection logic are untouched; this is colour only.
 */
export function riskLevelTone(level: RiskTolerance): SeverityTone {
  if (level >= 5) return 'critical';
  if (level === 4) return 'high';
  if (level === 3) return 'moderate';
  return 'info';
}

/**
 * The risk dial. Shared between onboarding, the recommendation screen and
 * the Me tab, so the control the user sets is literally the same one they
 * later adjust.
 */
export function RiskPicker({
  value,
  onChange,
}: {
  value: RiskTolerance;
  onChange: (next: RiskTolerance) => void;
}) {
  const theme = useTheme();
  const { color } = theme;
  const active = RISK_TOLERANCES.find((r) => r.level === value);

  return (
    <Card>
      <Row gap={spacing.xs} justify="space-between">
        {RISK_TOLERANCES.map((option) => {
          const selected = option.level === value;
          const { fg, bg } = theme.tone(riskLevelTone(option.level));
          return (
            <Pressable
              key={option.level}
              onPress={() => onChange(option.level)}
              accessibilityRole="button"
              accessibilityLabel={`Risk level ${option.level}, ${option.label}`}
              accessibilityState={{ selected }}
              style={({ pressed }) => ({
                flex: 1,
                alignItems: 'center',
                paddingVertical: spacing.md,
                borderRadius: radius.sm,
                borderWidth: 1,
                borderColor: selected ? fg : color.border,
                backgroundColor: selected ? bg : color.surfaceMuted,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Data color={selected ? fg : color.textTertiary} style={{ fontSize: 19 }}>
                {option.level}
              </Data>
            </Pressable>
          );
        })}
      </Row>

      {active ? (
        <>
          <Divider />
          <Row justify="space-between">
            <Heading>{active.label}</Heading>
            <Badge label={`Level ${active.level}`} tone={riskLevelTone(active.level)} />
          </Row>
          <Small style={{ marginTop: spacing.xs }}>{active.blurb}</Small>
          <Spacer size={spacing.sm} />
          <Small muted={false}>{active.effect}</Small>
        </>
      ) : null}
    </Card>
  );
}
