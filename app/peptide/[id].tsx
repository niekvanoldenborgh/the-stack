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
  Data,
  Display,
  Divider,
  Row,
  Screen,
  Small,
  Spacer,
  Stepper,
} from '../../src/ui/components';
import { SeverityIcon } from '../../src/ui/icons';
import { Disclosure, FocalMetric, List, ListItem, Section } from '../../src/ui/primitives';
import { RangeBar } from '../../src/ui/RangeBar';
import { EVIDENCE_LABELS, LEGAL_LABELS, radius, spacing, useTheme } from '../../src/ui/theme';

/**
 * Peptide detail — redesigned THEA-38.
 *
 * The old version was ~12 stacked SectionTitle+Card blocks, all the same
 * weight — the purest "AI-made" tell in the app. This version puts a
 * compact header and the dose block above the fold, keeps the sections a
 * reader needs to act on (schedule, what it's for, side effects, red flags,
 * other contraindications) visible, and pushes reference-grade prose
 * (mechanism, cycling, monitoring, sources, "worth knowing") behind
 * `Disclosure` so the page reads as one compound, not a stack of cards.
 */

/**
 * The published low/typical/high in the same units the personalised dose is
 * shown in — per-kg compounds have to be scaled by bodyweight first, or the
 * range and the mark on it would be on different scales.
 */
function scaledDose(peptide: Peptide, profile: UserProfile, key: 'low' | 'typical' | 'high'): number {
  const scale = peptide.dosing.basis === 'per_kg' ? profile.weightKg : 1;
  return Math.round(peptide.dosing[key] * scale * 100) / 100;
}

function doseUnitLabel(unit: string): string {
  if (unit === 'pct') return '%';
  if (unit === 'iu') return 'IU';
  return unit;
}

export default function PeptideDetail() {
  const theme = useTheme();
  const { color } = theme;
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
        <Body>Compound not found</Body>
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
      {/* Compact header. */}
      <Spacer size={spacing.lg} />
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
            borderColor: theme.evidence(peptide.evidence),
          }}
        >
          <Caption color={theme.evidence(peptide.evidence)}>
            Evidence {peptide.evidence} · {EVIDENCE_LABELS[peptide.evidence]}
          </Caption>
        </View>
        {peptide.bannedInSport ? <Badge label="Banned in sport" tone="moderate" /> : null}
      </Row>

      <Spacer size={spacing.xl} />
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
              <Small muted={false} style={{ color: color.textPrimary }}>
                {c.reason}
              </Small>
            </Callout>
          ))}
        </View>
      ) : null}

      {/* Dose block — above the fold. */}
      <Spacer size={spacing.xl} />
      {peptide.doseGuidanceWithheld ? (
        <Callout tone="critical" title="This app shows no dose for this compound">
          <Small muted={false} style={{ color: color.textPrimary }}>
            {peptide.doseGuidanceWithheld.reason}
          </Small>
        </Callout>
      ) : (
        <>
          <Section title="Your dose" tone={2} gap={spacing.lg}>
            {computation && profile ? (
              <>
                <FocalMetric
                  eyebrow="Per administration"
                  value={`${computation.dose.value}`}
                  unit={doseUnitLabel(computation.dose.unit)}
                  tone={color.primary}
                  meta={
                    computation.startDose.value !== computation.dose.value
                      ? `Starts at ${formatDose(computation.startDose)} and ramps up.`
                      : undefined
                  }
                />
                <View>
                  <Caption color={color.textSecondary}>How this number was reached</Caption>
                  <List style={{ marginTop: spacing.sm }}>
                    {computation.factors.map((factor, index) => (
                      <ListItem key={index} title={factor} />
                    ))}
                  </List>
                </View>
                {computation.advisories.length > 0 ? (
                  <View>
                    {computation.advisories.map((advisory, index) => (
                      <Small key={index} muted={false} style={{ color: color.textPrimary, marginBottom: spacing.sm }}>
                        {advisory}
                      </Small>
                    ))}
                  </View>
                ) : null}
              </>
            ) : (
              <Small>Complete your profile to see a personalised dose.</Small>
            )}
          </Section>

          <Section title="Where your dose sits">
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
          </Section>

          {computation && !computation.withheld && peptide.dosing.unit !== 'pct' ? (
            <ReconstitutionSection doseValue={computation.dose.value} doseUnit={computation.dose.unit as 'mcg' | 'mg'} />
          ) : null}
        </>
      )}

      {/* Practical detail — visible, grouped. */}
      <Section title="Schedule">
        <Row justify="space-between">
          <Small>Route</Small>
          <Small muted={false}>{peptide.routes.map((r) => r.replace('_', ' ')).join(' or ')}</Small>
        </Row>
        <Row justify="space-between">
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
        <Row justify="space-between">
          <Small>Timing</Small>
          <Small muted={false}>{peptide.frequency.preferredTimes.map((t) => TIME_OF_DAY_LABELS[t]).join(', ')}</Small>
        </Row>
      </Section>

      {Object.keys(peptide.goalFit).length > 0 ? (
        <Section title="What it is used for">
          <List>
            {Object.entries(peptide.goalFit)
              .sort((a, b) => (b[1] ?? 0) - (a[1] ?? 0))
              .map(([goalId, fit]) => {
                const goal = GOALS_BY_ID[goalId as keyof typeof GOALS_BY_ID];
                if (!goal || fit === undefined) return null;
                const negative = fit < 0;
                return (
                  <ListItem
                    key={goalId}
                    title={goal.label}
                    tone={negative ? 'critical' : 'accent'}
                    meta={
                      <Small muted={false} style={{ color: negative ? theme.tone('critical').fg : color.primary }}>
                        {negative ? `works against · ${fit}` : `${fit}/5`}
                      </Small>
                    }
                  />
                );
              })}
          </List>
          <Small>
            Negative values mean the compound pushes against that goal — the engine treats them as penalties, not
            neutral.
          </Small>
        </Section>
      ) : null}

      {(['severe', 'moderate', 'mild'] as Severity[]).some((s) => grouped[s].length > 0) ? (
        <Section title="Side effects">
          {(['severe', 'moderate', 'mild'] as Severity[]).map((severity) =>
            grouped[severity].length > 0 ? (
              <View key={severity}>
                <Row gap={spacing.xs} align="center">
                  <SeverityIcon severity={severity === 'severe' ? 'critical' : severity === 'moderate' ? 'moderate' : 'info'} size={13} />
                  <Caption
                    color={
                      severity === 'severe'
                        ? theme.tone('critical').fg
                        : severity === 'moderate'
                          ? theme.tone('moderate').fg
                          : color.textSecondary
                    }
                  >
                    {severity}
                  </Caption>
                </Row>
                <List style={{ marginTop: spacing.sm }}>
                  {grouped[severity].map((effect) => (
                    <ListItem key={effect.label} title={effect.label} detail={effect.detail} meta={<Small>{effect.likelihood}</Small>} />
                  ))}
                </List>
              </View>
            ) : null,
          )}
        </Section>
      ) : null}

      {peptide.redFlags.length > 0 ? (
        <Section title="Stop and seek care if" tone={2}>
          <List>
            {peptide.redFlags.map((flag) => (
              <ListItem key={flag.symptom} tone="critical" title={flag.symptom} detail={flag.action} />
            ))}
          </List>
        </Section>
      ) : null}

      {otherContraindications.length > 0 ? (
        <Section title="Do not use if">
          <List>
            {otherContraindications.map((c) => (
              <ListItem
                key={c.flag}
                tone={c.kind === 'absolute' ? 'critical' : 'moderate'}
                title={HEALTH_FLAGS_BY_ID[c.flag]?.label ?? c.flag}
                detail={c.reason}
                meta={<Badge label={c.kind === 'absolute' ? 'Absolute' : 'Caution'} tone={c.kind === 'absolute' ? 'critical' : 'moderate'} />}
              />
            ))}
          </List>
        </Section>
      ) : null}

      {/* Reference detail — behind disclosure. */}
      <Section title="More about this compound" last gap={spacing.lg}>
        <Disclosure label="How it works">
          <Body>{peptide.mechanism}</Body>
        </Disclosure>

        <Disclosure label="Cycling" summary={peptide.cycle.rationale}>
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
              <Small muted={false}>{peptide.cycle.maxConsecutiveCycles} before an extended break</Small>
            </Row>
          ) : null}
          <Small style={{ marginTop: spacing.sm }}>{peptide.cycle.rationale}</Small>
        </Disclosure>

        {peptide.monitoring.length > 0 ? (
          <Disclosure label="Monitoring" summary={`${peptide.monitoring.length} item${peptide.monitoring.length === 1 ? '' : 's'} to arrange with a clinician`}>
            <List>
              {peptide.monitoring.map((item, index) => (
                <ListItem key={index} title={item} />
              ))}
            </List>
          </Disclosure>
        ) : null}

        {peptide.notes && peptide.notes.length > 0 ? (
          <Disclosure label="Worth knowing">
            <List>
              {peptide.notes.map((note, index) => (
                <ListItem key={index} title={note} />
              ))}
            </List>
          </Disclosure>
        ) : null}

        <Disclosure label="Sources" summary={`${peptide.sources.length} cited`}>
          <List>
            {peptide.sources.map((source, index) => (
              <Small key={index} style={{ marginBottom: spacing.sm }}>
                {index + 1}. {source}
              </Small>
            ))}
          </List>
        </Disclosure>
      </Section>

      <Spacer size={spacing.xxl} />
    </Screen>
  );
}

function ReconstitutionSection({ doseValue, doseUnit }: { doseValue: number; doseUnit: 'mcg' | 'mg' }) {
  const theme = useTheme();
  const { color } = theme;
  const [vialMg, setVialMg] = useState(5);
  const [waterMl, setWaterMl] = useState(2);

  const result = reconstitute(vialMg, waterMl, { value: doseValue, unit: doseUnit });

  return (
    <Section title="Reconstitution calculator" gap={spacing.lg}>
      <Small>
        Mixing up milligrams and syringe units is one of the most common ways people accidentally take ten times the
        dose they meant to. Work it out here before you draw.
      </Small>

      <View>
        <Small>Peptide in the vial</Small>
        <Spacer size={spacing.sm} />
        <Stepper value={vialMg} onChange={setVialMg} min={1} max={30} step={1} suffix="mg" />
      </View>

      <View>
        <Small>Bacteriostatic water added</Small>
        <Spacer size={spacing.sm} />
        <Stepper value={waterMl} onChange={setWaterMl} min={0.5} max={5} step={0.5} suffix="ml" />
      </View>

      {result ? (
        <View>
          <Divider />
          <Row justify="space-between">
            <Small>Concentration</Small>
            <Data>{result.mcgPerUnit} mcg / unit</Data>
          </Row>
          <Row justify="space-between" align="center" style={{ marginTop: spacing.sm }}>
            <Small>Draw for your dose</Small>
            <Row gap={spacing.xs} align="flex-end">
              <Data color={color.primary} style={{ fontSize: 24 }}>
                {result.unitsForDose}
              </Data>
              <Data color={color.textSecondary}>units</Data>
            </Row>
          </Row>
          <Small style={{ marginTop: spacing.sm }}>
            Units on a standard 1 ml U-100 insulin syringe, where 100 units = 1 ml.
          </Small>
          {result.warning ? (
            <Callout tone="moderate" title="Adjust your mix">
              <Small muted={false} style={{ color: color.textPrimary }}>
                {result.warning}
              </Small>
            </Callout>
          ) : null}
        </View>
      ) : (
        <Small>Not applicable for this compound.</Small>
      )}
    </Section>
  );
}
