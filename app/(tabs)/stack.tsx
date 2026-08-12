import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { Alert, Pressable, View } from 'react-native';

import { getPeptide } from '../../src/domain/peptides';
import type { CyclePhase, Stack as StackType, StackItem } from '../../src/domain/types';
import { TIME_OF_DAY_LABELS, buildCyclePhases } from '../../src/engine/cycle';
import { formatDose } from '../../src/engine/dosing';
import { explainExclusions } from '../../src/engine/recommend';
import { riskBand } from '../../src/engine/safety';
import { WEEKDAY_LABELS, addDays, diffDays, formatRange, formatShort, today } from '../../src/lib/date';
import { useActiveStack, useAppStore } from '../../src/store/useAppStore';
import {
  Badge,
  Body,
  Button,
  Callout,
  Caption,
  Card,
  Display,
  Divider,
  EmptyState,
  Heading,
  Row,
  Screen,
  SectionTitle,
  Small,
  Spacer,
  Title,
} from '../../src/ui/components';
import { EVIDENCE_LABELS, LEGAL_LABELS, colors, fonts, evidenceColor, radius, spacing } from '../../src/ui/theme';

export default function StackScreen() {
  const router = useRouter();
  const stack = useActiveStack();
  const stacks = useAppStore((s) => s.stacks);
  const profile = useAppStore((s) => s.profile);
  const createGeneratedStack = useAppStore((s) => s.createGeneratedStack);
  const deleteStack = useAppStore((s) => s.deleteStack);
  const setActiveStack = useAppStore((s) => s.setActiveStack);
  const setStackStartDate = useAppStore((s) => s.setStackStartDate);

  const phases = useMemo(() => (stack ? buildCyclePhases(stack) : []), [stack]);
  const exclusions = useMemo(
    () => (stack && profile ? explainExclusions(profile, stack).slice(0, 8) : []),
    [stack, profile],
  );

  const regenerate = () => {
    Alert.alert(
      'Rebuild your stack?',
      'This creates a new stack from your current profile. Your existing one is kept in the list below.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Rebuild', onPress: () => createGeneratedStack() },
      ],
    );
  };

  const confirmDelete = (id: string, name: string) => {
    Alert.alert(`Delete "${name}"?`, 'The stack and its dose history will be removed. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteStack(id) },
    ]);
  };

  if (!stack) {
    return (
      <Screen>
        <Spacer size={spacing.lg} />
        <Display>Stack</Display>
        <Spacer size={spacing.xl} />
        <EmptyState
          title="No stack yet"
          body="Generate one from your profile, or build a custom stack with live interaction checking."
          action={
            <View style={{ width: '100%', gap: spacing.sm }}>
              <Button label="Generate from my profile" onPress={() => createGeneratedStack()} />
              <Button label="Build my own" variant="secondary" onPress={() => router.push('/builder')} />
            </View>
          }
        />
      </Screen>
    );
  }

  const band = riskBand(stack.safety.riskScore);
  const dayZero = stack.startDate;
  const dayOffset = diffDays(dayZero, today());

  return (
    <Screen>
      <Spacer size={spacing.lg} />
      <Row justify="space-between" align="flex-start">
        <View style={{ flex: 1 }}>
          <Caption color={colors.textMuted}>{stack.origin === 'generated' ? 'Generated' : 'Custom built'}</Caption>
          <Display style={{ marginTop: spacing.xs }}>{stack.name}</Display>
        </View>
      </Row>
      <Small style={{ marginTop: spacing.xs }}>
        Started {formatShort(stack.startDate)} · day {Math.max(0, dayOffset) + 1}
      </Small>

      <Spacer size={spacing.lg} />
      <Pressable onPress={() => router.push('/safety')} accessibilityRole="button">
        <Card tone={band.tone === 'severe' ? 'critical' : band.tone === 'low' ? 'accent' : band.tone}>
          <Row justify="space-between">
            <View style={{ flex: 1 }}>
              <Heading>{band.label}</Heading>
              <Small style={{ marginTop: 2 }}>
                {stack.safety.interactions.length} interaction
                {stack.safety.interactions.length === 1 ? '' : 's'} ·{' '}
                {stack.safety.contraindications.length} contraindication
                {stack.safety.contraindications.length === 1 ? '' : 's'} · {stack.safety.notices.length} notice
                {stack.safety.notices.length === 1 ? '' : 's'}
              </Small>
            </View>
            <Small muted={false} style={{ color: colors.accent }}>
              Review →
            </Small>
          </Row>
        </Card>
      </Pressable>

      <SectionTitle>Compounds</SectionTitle>
      {stack.items.map((item) => (
        <StackItemCard key={item.peptideId} item={item} onPress={() => router.push(`/peptide/${item.peptideId}`)} />
      ))}

      <SectionTitle>Cycle plan</SectionTitle>
      <Card>
        <Small style={{ marginBottom: spacing.md }}>
          Each bar is one compound across its planned cycle. Amber is washout — the off period is part of the plan,
          not a pause in it.
        </Small>
        {stack.items.map((item) => (
          <CycleTrack key={item.peptideId} peptideId={item.peptideId} phases={phases} startDate={stack.startDate} />
        ))}
        <Divider />
        <Row gap={spacing.lg} wrap>
          <LegendDot color={colors.info} label="Titration" />
          <LegendDot color={colors.accent} label="On cycle" />
          <LegendDot color={colors.moderate} label="Washout" />
        </Row>
      </Card>

      <Card>
        <Caption color={colors.textMuted}>Start date</Caption>
        <Spacer size={spacing.sm} />
        <Body>{formatShort(stack.startDate)}</Body>
        <Small style={{ marginTop: spacing.xs }}>
          Shifting the start date moves the whole cycle, including washouts and reminders.
        </Small>
        <Spacer size={spacing.md} />
        <Row gap={spacing.sm}>
          <Button
            label="− 1 week"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => setStackStartDate(stack.id, addDays(stack.startDate, -7))}
          />
          <Button
            label="Start today"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => setStackStartDate(stack.id, today())}
          />
          <Button
            label="+ 1 week"
            variant="secondary"
            style={{ flex: 1 }}
            onPress={() => setStackStartDate(stack.id, addDays(stack.startDate, 7))}
          />
        </Row>
      </Card>

      {exclusions.length > 0 ? (
        <>
          <SectionTitle>Why isn&apos;t X in here?</SectionTitle>
          <Card>
            {exclusions.map((exclusion, index) => (
              <View key={exclusion.peptideId}>
                {index > 0 ? <Divider /> : null}
                <Pressable onPress={() => router.push(`/peptide/${exclusion.peptideId}`)} accessibilityRole="button">
                  <Body>{exclusion.name}</Body>
                  <Small style={{ marginTop: 2 }}>{exclusion.reason}</Small>
                </Pressable>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <SectionTitle>Actions</SectionTitle>
      <Button label="Rebuild from my profile" variant="secondary" onPress={regenerate} />
      <Spacer size={spacing.sm} />
      <Button label="Build a custom stack" variant="secondary" onPress={() => router.push('/builder')} />

      {stacks.length > 1 ? (
        <>
          <SectionTitle>Saved stacks</SectionTitle>
          {stacks.map((saved) => (
            <SavedStackRow
              key={saved.id}
              stack={saved}
              active={saved.id === stack.id}
              onSelect={() => setActiveStack(saved.id)}
              onDelete={() => confirmDelete(saved.id, saved.name)}
            />
          ))}
        </>
      ) : null}

      <Spacer size={spacing.xxl} />
    </Screen>
  );
}

function StackItemCard({ item, onPress }: { item: StackItem; onPress: () => void }) {
  const peptide = getPeptide(item.peptideId);
  if (!peptide) return null;

  const days =
    item.daysPerWeek === 7
      ? 'daily'
      : peptide.frequency.fixedDays
        ? peptide.frequency.fixedDays.map((d) => WEEKDAY_LABELS[d]).join(', ')
        : `${item.daysPerWeek}× a week`;

  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card>
        <Row justify="space-between" align="flex-start">
          <View style={{ flex: 1 }}>
            <Title>{peptide.name}</Title>
            <Row gap={spacing.xs} wrap style={{ marginTop: spacing.sm }}>
              <Badge
                label={LEGAL_LABELS[peptide.legalStatus] ?? peptide.legalStatus}
                tone={peptide.legalStatus === 'research_chemical' ? 'high' : peptide.legalStatus === 'prescription' ? 'info' : 'accent'}
              />
              <View
                style={{
                  paddingHorizontal: spacing.sm,
                  paddingVertical: 3,
                  borderRadius: radius.sm,
                  borderWidth: 1,
                  borderColor: evidenceColor(peptide.evidence),
                }}
              >
                <Caption color={evidenceColor(peptide.evidence)}>
                  {peptide.evidence} · {EVIDENCE_LABELS[peptide.evidence]}
                </Caption>
              </View>
            </Row>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <Caption color={colors.textFaint}>Fit</Caption>
            <Heading style={{ color: colors.accent }}>{item.score}</Heading>
          </View>
        </Row>

        <Divider />

        {item.doseWithheld ? (
          <Callout tone="high" title="No dose shown">
            <Small muted={false} style={{ color: colors.text }}>
              Open the compound to see why this app withholds a number here.
            </Small>
          </Callout>
        ) : (
          <>
            <Row justify="space-between">
              <Small>Dose</Small>
              <Body style={{ fontFamily: fonts.sansMedium }}>
                {formatDose(item.dose)}
                {item.timesPerDay > 1 ? ` × ${item.timesPerDay}/day` : ''}
              </Body>
            </Row>
            {item.startDose.value !== item.dose.value ? (
              <Row justify="space-between" style={{ marginTop: spacing.xs }}>
                <Small>Starting at</Small>
                <Small muted={false}>{formatDose(item.startDose)} — ramping up</Small>
              </Row>
            ) : null}
          </>
        )}

        <Row justify="space-between" style={{ marginTop: spacing.xs }}>
          <Small>Schedule</Small>
          <Small muted={false}>{days}</Small>
        </Row>
        <Row justify="space-between" style={{ marginTop: spacing.xs }}>
          <Small>Timing</Small>
          <Small muted={false}>{item.preferredTimes.map((t) => TIME_OF_DAY_LABELS[t]).join(', ')}</Small>
        </Row>
        <Row justify="space-between" style={{ marginTop: spacing.xs }}>
          <Small>Cycle</Small>
          <Small muted={false}>
            {item.offWeeks === 0 ? `${item.onWeeks} weeks continuous` : `${item.onWeeks} on / ${item.offWeeks} off`}
          </Small>
        </Row>

        <Divider />
        <Small>{item.rationale}</Small>
      </Card>
    </Pressable>
  );
}

function CycleTrack({
  peptideId,
  phases,
  startDate,
}: {
  peptideId: string;
  phases: CyclePhase[];
  startDate: string;
}) {
  const mine = phases.filter((p) => p.peptideId === peptideId);
  if (mine.length === 0) return null;
  const peptide = getPeptide(peptideId);

  const totalDays = mine.reduce((sum, phase) => sum + diffDays(phase.startDate, phase.endDate) + 1, 0);
  const elapsed = diffDays(startDate, today());
  const progressPct = totalDays > 0 ? Math.min(100, Math.max(0, (elapsed / totalDays) * 100)) : 0;

  return (
    <View style={{ marginBottom: spacing.lg }}>
      <Row justify="space-between" style={{ marginBottom: spacing.xs }}>
        <Small muted={false}>{peptide?.name ?? peptideId}</Small>
        <Small>{formatRange(mine[0]!.startDate, mine[mine.length - 1]!.endDate)}</Small>
      </Row>
      <View style={{ height: 14, flexDirection: 'row', borderRadius: radius.sm, overflow: 'hidden' }}>
        {mine.map((phase) => {
          const days = diffDays(phase.startDate, phase.endDate) + 1;
          const color =
            phase.kind === 'titration' ? colors.info : phase.kind === 'on' ? colors.accent : colors.moderate;
          return <View key={`${phase.kind}-${phase.startDate}`} style={{ flex: days, backgroundColor: color }} />;
        })}
      </View>
      {elapsed >= 0 && elapsed <= totalDays ? (
        <View style={{ height: 3, marginTop: 3, backgroundColor: colors.surfaceHigh, borderRadius: 2 }}>
          <View style={{ width: `${progressPct}%`, height: 3, backgroundColor: colors.text, borderRadius: 2 }} />
        </View>
      ) : null}
    </View>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Row gap={spacing.xs}>
      <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
      <Small>{label}</Small>
    </Row>
  );
}

function SavedStackRow({
  stack,
  active,
  onSelect,
  onDelete,
}: {
  stack: StackType;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <Card style={{ borderColor: active ? colors.accent : colors.border, marginBottom: spacing.sm }}>
      <Row justify="space-between">
        <Pressable onPress={onSelect} style={{ flex: 1 }} accessibilityRole="button">
          <Body style={{ fontFamily: fonts.sansMedium }}>{stack.name}</Body>
          <Small style={{ marginTop: 2 }}>
            {stack.items.length} compound{stack.items.length === 1 ? '' : 's'} ·{' '}
            {stack.origin === 'generated' ? 'generated' : 'custom'} · risk {stack.safety.riskScore}
          </Small>
        </Pressable>
        {active ? (
          <Badge label="Active" tone="accent" />
        ) : (
          <Pressable onPress={onDelete} accessibilityRole="button" hitSlop={8}>
            <Small muted={false} style={{ color: colors.critical }}>
              Delete
            </Small>
          </Pressable>
        )}
      </Row>
    </Card>
  );
}
