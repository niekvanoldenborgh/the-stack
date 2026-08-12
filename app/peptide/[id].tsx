import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';

import { GOALS_BY_ID, HEALTH_FLAGS_BY_ID } from '../../src/domain/goals';
import { getPeptide } from '../../src/domain/peptides';
import type { Peptide, Severity, SideEffect, UserProfile } from '../../src/domain/types';
import { TIME_OF_DAY_LABELS } from '../../src/engine/cycle';
import { computeDose, formatDose, reconstitute } from '../../src/engine/dosing';
import { useAppStore } from '../../src/store/useAppStore';
import { WEEKDAY_LABELS } from '../../src/lib/date';
import {
  Badge,
  Body,
  Callout,
  Caption,
  Card,
  Data,
  Display,
  Divider,
  Heading,
  Metric,
  Row,
  Screen,
  SectionTitle,
  Small,
  Spacer,
  Stepper,
  Title,
} from '../../src/ui/components';
import { RangeBar } from '../../src/ui/RangeBar';
import { EVIDENCE_LABELS, LEGAL_LABELS, colors, fonts, evidenceColor, radius, spacing } from '../../src/ui/theme';

/**
 * The published low/typical/high in the same units the personalised dose is
 * shown in — per-kg compounds have to be scaled by bodyweight first, or the
 * range and the mark on it would be on different scales.
 */
function scaledDose(peptide: Peptide, profile: UserProfile, key: 'low' | 'typical' | 'high'): number {
  const scale = peptide.dosing.basis === 'per_kg' ? profile.weightKg : 1;
  return Math.round(peptide.dosing[key] * scale * 100) / 100;
}

export default function PeptideDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const profile = useAppStore((s) => s.profile);
  const peptide = getPeptide(String(id));

  useEffect(() => {
    if (peptide) navigation.setOptions({ title: peptide.name });
  }, [navigation, peptide]);

  const computation = useMemo(
    () => (peptide && profile ? computeDose(peptide, profile) : null),
    [peptide, profile],
  );

  const userFlags = new Set(profile?.healthFlags ?? []);
  if (profile && profile.age < 18) userFlags.add('under_18');

  if (!peptide) {
    return (
      <Screen>
        <Spacer size={spacing.xl} />
        <Heading>Compound not found</Heading>
      </Screen>
    );
  }

  const matchingContraindications = peptide.contraindications.filter((c) => userFlags.has(c.flag));
  const otherContraindications = peptide.contraindications.filter((c) => !userFlags.has(c.flag));

  const grouped: Record<Severity, SideEffect[]> = {
    severe: peptide.sideEffects.filter((s) => s.severity === 'severe'),
    moderate: peptide.sideEffects.filter((s) => s.severity === 'moderate'),
    mild: peptide.sideEffects.filter((s) => s.severity === 'mild'),
  };

  return (
    <Screen>
      <Spacer size={spacing.md} />
      <Display>{peptide.name}</Display>
      {peptide.aliases.length > 0 ? (
        <Small style={{ marginTop: spacing.xs }}>Also known as {peptide.aliases.join(', ')}</Small>
      ) : null}

      <Row gap={spacing.xs} wrap style={{ marginTop: spacing.md }}>
        <Badge
          label={LEGAL_LABELS[peptide.legalStatus] ?? peptide.legalStatus}
          tone={
            peptide.legalStatus === 'research_chemical'
              ? 'high'
              : peptide.legalStatus === 'prescription'
                ? 'info'
                : 'accent'
          }
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
            Evidence {peptide.evidence} · {EVIDENCE_LABELS[peptide.evidence]}
          </Caption>
        </View>
        {peptide.bannedInSport ? <Badge label="Banned in sport" tone="moderate" /> : null}
      </Row>

      <Spacer size={spacing.lg} />
      <Body>{peptide.summary}</Body>

      {matchingContraindications.length > 0 ? (
        <View style={{ marginTop: spacing.lg }}>
          {matchingContraindications.map((c) => (
            <Callout
              key={c.flag}
              tone={c.kind === 'absolute' ? 'critical' : 'high'}
              title={
                c.kind === 'absolute'
                  ? `Contraindicated for you — ${HEALTH_FLAGS_BY_ID[c.flag]?.label ?? c.flag}`
                  : `Caution for you — ${HEALTH_FLAGS_BY_ID[c.flag]?.label ?? c.flag}`
              }
            >
              <Small muted={false} style={{ color: colors.text }}>
                {c.reason}
              </Small>
            </Callout>
          ))}
        </View>
      ) : null}

      {peptide.doseGuidanceWithheld ? (
        <View style={{ marginTop: spacing.lg }}>
          <Callout tone="critical" title="This app shows no dose for this compound">
            <Small muted={false} style={{ color: colors.text }}>
              {peptide.doseGuidanceWithheld.reason}
            </Small>
          </Callout>
        </View>
      ) : (
        <>
          <SectionTitle>Your dose</SectionTitle>
          {computation && profile ? (
            <Card tone="accent">
              <Row justify="space-between" align="flex-end">
                <View>
                  <Caption color={colors.textMuted}>Per administration</Caption>
                  <Metric color={colors.accent} style={{ marginTop: spacing.xs }}>
                    {formatDose(computation.dose)}
                  </Metric>
                </View>
                {computation.startDose.value !== computation.dose.value ? (
                  <View style={{ alignItems: 'flex-end' }}>
                    <Caption color={colors.textMuted}>Start at</Caption>
                    <Data style={{ fontSize: 19, marginTop: spacing.sm }}>
                      {formatDose(computation.startDose)}
                    </Data>
                  </View>
                ) : null}
              </Row>

              <Divider />
              <Caption color={colors.textMuted}>How this number was reached</Caption>
              <Spacer size={spacing.sm} />
              {computation.factors.map((factor, index) => (
                <Row key={index} gap={spacing.sm} align="flex-start" style={{ marginBottom: spacing.sm }}>
                  <Small muted={false} style={{ color: colors.accent }}>
                    ·
                  </Small>
                  <Small style={{ flex: 1 }}>{factor}</Small>
                </Row>
              ))}

              {computation.advisories.length > 0 ? (
                <>
                  <Divider />
                  {computation.advisories.map((advisory, index) => (
                    <Small key={index} muted={false} style={{ color: colors.text, marginBottom: spacing.sm }}>
                      {advisory}
                    </Small>
                  ))}
                </>
              ) : null}
            </Card>
          ) : (
            <Card>
              <Small>Complete your profile to see a personalised dose.</Small>
            </Card>
          )}

          <Card>
            <Caption color={colors.textMuted}>Where your dose sits</Caption>
            <Spacer size={spacing.lg} />
            {computation && profile ? (
              <RangeBar
                low={scaledDose(peptide, profile, 'low')}
                typical={scaledDose(peptide, profile, 'typical')}
                high={scaledDose(peptide, profile, 'high')}
                value={computation.dose.value}
                unit={peptide.dosing.unit === 'pct' ? '%' : peptide.dosing.unit}
                basis={
                  peptide.dosing.basis === 'per_kg'
                    ? `Scaled to ${profile.weightKg} kg — the published figures are per kg`
                    : undefined
                }
              />
            ) : (
              <Body>
                {peptide.dosing.low}–{peptide.dosing.high}{' '}
                {peptide.dosing.unit === 'pct' ? '%' : peptide.dosing.unit}
                {peptide.dosing.basis === 'per_kg' ? ' per kg' : ''} per administration
              </Body>
            )}
            <Divider />
            <Small>{peptide.dosing.note}</Small>
          </Card>

          {computation && !computation.withheld && peptide.dosing.unit !== 'pct' ? (
            <ReconstitutionCard
              doseValue={computation.dose.value}
              doseUnit={computation.dose.unit as 'mcg' | 'mg'}
            />
          ) : null}
        </>
      )}

      <SectionTitle>How it works</SectionTitle>
      <Card>
        <Body>{peptide.mechanism}</Body>
      </Card>

      <SectionTitle>Schedule</SectionTitle>
      <Card>
        <Row justify="space-between">
          <Small>Route</Small>
          <Small muted={false}>{peptide.routes.map((r) => r.replace('_', ' ')).join(' or ')}</Small>
        </Row>
        <Row justify="space-between" style={{ marginTop: spacing.sm }}>
          <Small>Frequency</Small>
          <Small muted={false}>
            {peptide.frequency.timesPerDay}× a day,{' '}
            {peptide.frequency.daysPerWeek === 7
              ? 'every day'
              : peptide.frequency.fixedDays
                ? peptide.frequency.fixedDays.map((d) => WEEKDAY_LABELS[d]).join(', ')
                : `${peptide.frequency.daysPerWeek} days a week`}
          </Small>
        </Row>
        <Row justify="space-between" style={{ marginTop: spacing.sm }}>
          <Small>Timing</Small>
          <Small muted={false}>{peptide.frequency.preferredTimes.map((t) => TIME_OF_DAY_LABELS[t]).join(', ')}</Small>
        </Row>
        <Divider />
        <Small>{peptide.frequency.timingRationale}</Small>
      </Card>

      <SectionTitle>Cycling</SectionTitle>
      <Card>
        <Row justify="space-between">
          <Small>On / off</Small>
          <Small muted={false}>
            {peptide.cycle.offWeeks === 0
              ? `${peptide.cycle.onWeeks} weeks continuous`
              : `${peptide.cycle.onWeeks} weeks on, ${peptide.cycle.offWeeks} weeks off`}
          </Small>
        </Row>
        {peptide.cycle.maxConsecutiveCycles !== null ? (
          <Row justify="space-between" style={{ marginTop: spacing.sm }}>
            <Small>Max cycles</Small>
            <Small muted={false}>
              {peptide.cycle.maxConsecutiveCycles} before an extended break
            </Small>
          </Row>
        ) : null}
        <Divider />
        <Small>{peptide.cycle.rationale}</Small>
      </Card>

      <SectionTitle>What it is used for</SectionTitle>
      <Card>
        {Object.entries(peptide.goalFit)
          .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
          .map(([goalId, fit]) => {
            const goal = GOALS_BY_ID[goalId as keyof typeof GOALS_BY_ID];
            if (!goal || fit === undefined) return null;
            const negative = fit < 0;
            return (
              <View key={goalId} style={{ marginBottom: spacing.md }}>
                <Row justify="space-between">
                  <Small muted={false}>
                    {goal.icon} {goal.label}
                  </Small>
                  <Small muted={false} style={{ color: negative ? colors.critical : colors.accent }}>
                    {negative ? `works against · ${fit}` : `${fit}/5`}
                  </Small>
                </Row>
                <View style={{ height: 5, backgroundColor: colors.surfaceHigh, borderRadius: 3, marginTop: 5 }}>
                  <View
                    style={{
                      width: `${(Math.abs(fit) / 5) * 100}%`,
                      height: 5,
                      borderRadius: 3,
                      backgroundColor: negative ? colors.critical : colors.accent,
                    }}
                  />
                </View>
              </View>
            );
          })}
        <Small>
          Negative values mean the compound pushes against that goal — the engine treats them as penalties, not
          neutral.
        </Small>
      </Card>

      <SectionTitle>Side effects</SectionTitle>
      {(['severe', 'moderate', 'mild'] as Severity[]).map((severity) =>
        grouped[severity].length > 0 ? (
          <Card key={severity} tone={severity === 'severe' ? 'critical' : severity === 'moderate' ? 'moderate' : undefined}>
            <Caption
              color={severity === 'severe' ? colors.critical : severity === 'moderate' ? colors.moderate : colors.textMuted}
            >
              {severity}
            </Caption>
            <Spacer size={spacing.sm} />
            {grouped[severity].map((effect) => (
              <View key={effect.label} style={{ marginBottom: spacing.md }}>
                <Row justify="space-between" align="flex-start" gap={spacing.md}>
                  <Body style={{ flex: 1 }}>{effect.label}</Body>
                  <Small>{effect.likelihood}</Small>
                </Row>
                {effect.detail ? <Small style={{ marginTop: 2 }}>{effect.detail}</Small> : null}
              </View>
            ))}
          </Card>
        ) : null,
      )}

      {peptide.redFlags.length > 0 ? (
        <>
          <SectionTitle>Stop and seek care if</SectionTitle>
          <Card tone="critical">
            {peptide.redFlags.map((flag, index) => (
              <View key={flag.symptom} style={{ marginBottom: index === peptide.redFlags.length - 1 ? 0 : spacing.lg }}>
                <Body style={{ fontFamily: fonts.sansMedium }}>{flag.symptom}</Body>
                <Small style={{ marginTop: 2 }}>{flag.action}</Small>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {otherContraindications.length > 0 ? (
        <>
          <SectionTitle>Do not use if</SectionTitle>
          <Card>
            {otherContraindications.map((c, index) => (
              <View key={c.flag}>
                {index > 0 ? <Divider /> : null}
                <Row gap={spacing.sm} align="flex-start">
                  <Badge label={c.kind === 'absolute' ? 'Absolute' : 'Caution'} tone={c.kind === 'absolute' ? 'critical' : 'moderate'} />
                </Row>
                <Body style={{ marginTop: spacing.sm }}>{HEALTH_FLAGS_BY_ID[c.flag]?.label ?? c.flag}</Body>
                <Small style={{ marginTop: 2 }}>{c.reason}</Small>
              </View>
            ))}
          </Card>
        </>
      ) : null}

      {peptide.monitoring.length > 0 ? (
        <>
          <SectionTitle>Monitoring</SectionTitle>
          <Card>
            {peptide.monitoring.map((item, index) => (
              <Row key={index} gap={spacing.sm} align="flex-start" style={{ marginBottom: spacing.sm }}>
                <Small muted={false} style={{ color: colors.accent }}>
                  ·
                </Small>
                <Small style={{ flex: 1 }}>{item}</Small>
              </Row>
            ))}
          </Card>
        </>
      ) : null}

      {peptide.notes && peptide.notes.length > 0 ? (
        <>
          <SectionTitle>Worth knowing</SectionTitle>
          {peptide.notes.map((note, index) => (
            <Callout key={index} tone="info" title="">
              <Small muted={false} style={{ color: colors.text }}>
                {note}
              </Small>
            </Callout>
          ))}
        </>
      ) : null}

      <SectionTitle>Sources</SectionTitle>
      <Card>
        {peptide.sources.map((source, index) => (
          <Small key={index} style={{ marginBottom: spacing.sm }}>
            {index + 1}. {source}
          </Small>
        ))}
      </Card>

      <Spacer size={spacing.xxl} />
    </Screen>
  );
}

function ReconstitutionCard({ doseValue, doseUnit }: { doseValue: number; doseUnit: 'mcg' | 'mg' }) {
  const [vialMg, setVialMg] = useState(5);
  const [waterMl, setWaterMl] = useState(2);

  const result = reconstitute(vialMg, waterMl, { value: doseValue, unit: doseUnit });

  return (
    <Card>
      <Caption color={colors.textMuted}>Reconstitution calculator</Caption>
      <Small style={{ marginTop: spacing.xs, marginBottom: spacing.lg }}>
        Mixing up milligrams and syringe units is one of the most common ways people accidentally take ten times the
        dose they meant to. Work it out here before you draw.
      </Small>

      <Small>Peptide in the vial</Small>
      <Spacer size={spacing.sm} />
      <Stepper value={vialMg} onChange={setVialMg} min={1} max={30} step={1} suffix="mg" />

      <Spacer size={spacing.lg} />
      <Small>Bacteriostatic water added</Small>
      <Spacer size={spacing.sm} />
      <Stepper value={waterMl} onChange={setWaterMl} min={0.5} max={5} step={0.5} suffix="ml" />

      <Divider />
      {result ? (
        <>
          <Row justify="space-between">
            <Small>Concentration</Small>
            <Data>{result.mcgPerUnit} mcg / unit</Data>
          </Row>
          <Row justify="space-between" align="center" style={{ marginTop: spacing.sm }}>
            <Small>Draw for your dose</Small>
            <Metric color={colors.accent} style={{ fontSize: 30, lineHeight: 34 }}>
              {result.unitsForDose}
              <Data color={colors.textMuted}> units</Data>
            </Metric>
          </Row>
          <Small style={{ marginTop: spacing.sm }}>
            Units on a standard 1 ml U-100 insulin syringe, where 100 units = 1 ml.
          </Small>
          {result.warning ? (
            <View style={{ marginTop: spacing.md }}>
              <Callout tone="moderate" title="Adjust your mix">
                <Small muted={false} style={{ color: colors.text }}>
                  {result.warning}
                </Small>
              </Callout>
            </View>
          ) : null}
        </>
      ) : (
        <Small>Not applicable for this compound.</Small>
      )}
    </Card>
  );
}
