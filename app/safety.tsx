import { useRouter } from 'expo-router';

import { riskBand } from '../src/engine/safety';
import { useActiveStack } from '../src/store/useAppStore';
import { Button, Caption, Display, EmptyState, Screen, Spacer } from '../src/ui/components';
import { SafetyReportView } from '../src/ui/SafetyReport';
import { colors, spacing } from '../src/ui/theme';

/** Unified safety-report surface (THEA-38) — see src/ui/SafetyReport.tsx. */
export default function SafetyScreen() {
  const router = useRouter();
  const stack = useActiveStack();

  if (!stack) {
    return (
      <Screen>
        <Spacer size={spacing.xl} />
        <EmptyState title="No active stack" body="There is nothing to evaluate yet." illustration="noStack" />
      </Screen>
    );
  }

  const band = riskBand(stack.safety.riskScore);

  return (
    <Screen>
      <Spacer size={spacing.md} />
      <Caption color={colors.textMuted}>{stack.name}</Caption>
      <Display style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>Safety report</Display>

      <SafetyReportView
        report={stack.safety}
        band={{ label: band.label, riskScore: stack.safety.riskScore, tone: band.tone }}
        bandNote="A composite of evidence quality, regulatory status, severe side effects, interactions and your health history. It is a comparison tool between stacks — not a probability that something will go wrong."
        blockingCopy={{
          title: 'This stack has a blocking finding',
          body: 'Either something is absolutely contraindicated for your health history, or there is a critical interaction. Both mean: do not run this as it stands.',
        }}
      />

      <Spacer size={spacing.lg} />
      <Button label="Back to stack" variant="secondary" onPress={() => router.back()} />
      <Spacer size={spacing.xxl} />
    </Screen>
  );
}
