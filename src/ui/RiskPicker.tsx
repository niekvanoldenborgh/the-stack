import { Pressable } from 'react-native';

import { RISK_TOLERANCES } from '../domain/goals';
import type { RiskTolerance } from '../domain/types';
import { Badge, Card, Data, Divider, Heading, Row, Small, Spacer } from './components';
import { colors, radius, spacing, type SeverityTone } from './theme';

/** Colour the dial by how far up it is turned, so level 5 never looks benign. */
export function riskLevelTone(level: RiskTolerance): SeverityTone {
  if (level >= 5) return 'critical';
  if (level === 4) return 'high';
  if (level === 3) return 'accent';
  return 'info';
}

function toneColor(tone: SeverityTone): string {
  switch (tone) {
    case 'critical':
      return colors.critical;
    case 'high':
      return colors.high;
    case 'moderate':
      return colors.moderate;
    case 'info':
      return colors.info;
    case 'accent':
      return colors.accent;
  }
}

/**
 * The risk dial. Shared between onboarding and the recommendation screen so
 * the control the user sets is literally the same one they later adjust.
 */
export function RiskPicker({
  value,
  onChange,
}: {
  value: RiskTolerance;
  onChange: (next: RiskTolerance) => void;
}) {
  const active = RISK_TOLERANCES.find((r) => r.level === value);

  return (
    <Card>
      <Row gap={spacing.xs} justify="space-between">
        {RISK_TOLERANCES.map((option) => {
          const selected = option.level === value;
          const tint = toneColor(riskLevelTone(option.level));
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
                borderColor: selected ? tint : colors.border,
                backgroundColor: selected ? `${tint}1F` : colors.surfaceAlt,
                opacity: pressed ? 0.75 : 1,
              })}
            >
              <Data color={selected ? tint : colors.textFaint} style={{ fontSize: 19 }}>
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
          <Small muted={false} style={{ color: colors.text }}>
            {active.effect}
          </Small>
        </>
      ) : null}
    </Card>
  );
}
