import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ban, Clock, Droplet, Info, Target, TriangleAlert } from 'lucide-react-native';
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
import { RouteIcon, SeverityIcon } from '../../src/ui/icons';
import { EvidenceBadge, Tile } from '../../src/ui/nocturne';
import { Disclosure, FocalMetric, List, ListItem } from '../../src/ui/primitives';
import { RangeBar } from '../../src/ui/RangeBar';
import { LEGAL_LABELS, spacing, useTheme } from '../../src/ui/theme';

/**
 * Peptide detail — NOCTURNE (design-lab/agents/14-me.sh).
 *
 * Restyle only, per design-lab/agents/IMPL.md — every sourced section from
 * the THEA-38 rebuild stays: uses, side effects, red flags, contraindications,
 * monitoring and the numbered Sources list are all still here, in the same
 * order, computing the same things. What changed is the surface: `Section`
 * (a borderless tone-shift) is replaced with `Tile` (src/ui/nocturne.tsx) so
 * this screen reads as the same chunky-tile system as Library and Me, with
 * exactly one `tile-hero` — the dose, the one number this page exists to
 * show — and everything else at `mid`/`low` weight underneath it.
 *
 * The published range block still comes straight from `RangeBar`, unchanged:
 * every `DosingModel` in the domain has a required `low`/`typical`/`high`, so
 * there is no "unknown range" state to fail closed on here — the fail-closed
 * case for this screen is `doseGuidanceWithheld`, which already skips the
 * whole dose block in favour of a callout and never renders a number.
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
      {/* Compact header — plain, not a tile, matching the Today/Me convention
       *  of headers sitting directly on the background. */}
      <Spacer size={spacing.lg} />
      <Display>{peptide.name}</Display>
      {peptide.aliases.length > 0 ? (
        <Small style={{ marginTop: spacing.xs }}>Also known as {peptide.aliases.join(', ')}</Small>
      ) : null}

      <Row gap={spacing.md} wrap style={{ marginTop: spacing.md }} align="center">
        <EvidenceBadge tier={peptide.evidence} showLabel size={26} />
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
              <Small muted={false} style={{ color: color.textPrimary }}>
                {c.reason}
              </Small>
            </Callout>
          ))}
        </View>
      ) : null}

      {/* Dose block — the one tile-hero on this screen. */}
      <Spacer size={spacing.xl} />
      {peptide.doseGuidanceWithheld ? (
        <Callout tone="critical" title="This app shows no dose for this compound">
          <Small muted={false} style={{ color: color.textPrimary }}>
            {peptide.doseGuidanceWithheld.reason}
          </Small>
        </Callout>
      ) : (
        <View style={{ gap: spacing.xl }}>
          <Tile elevation="hero" icon={<RouteIcon route={peptide.routes[0]!} size={15} color={color.textSecondary} />} caption="Your dose">
            {computation && profile ? (
              <View style={{ gap: spacing.lg }}>
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
              </View>
            ) : (
              <Small>Complete your profile to see a personalised dose.</Small>
            )}
          </Tile>

          <Tile elevation="mid" caption="Where your dose sits">
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
          </Tile>

          {computation && !computation.withheld && peptide.dosing.unit !== 'pct' ? (
            <ReconstitutionSection doseValue={computation.dose.value} doseUnit={computation.dose.unit as 'mcg' | 'mg'} />
          ) : null}
        </View>
      )}

      {/* Practical detail — visible, grouped, quiet weight. */}
      <Spacer size={spacing.xl} />
      <Tile elevation="low" icon={<Clock size={15} color={color.textSecondary} />} caption="Schedule">
        <View style={{ gap: spacing.sm }}>
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
        </View>
      </Tile>

      {Object.keys(peptide.goalFit).length > 0 ? (
        <>
          <Spacer size={spacing.xl} />
          <Tile elevation="mid" icon={<Target size={15} color={color.textSecondary} />} caption="What it is used for">
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
            <Small style={{ marginTop: spacing.md }}>
              Negative values mean the compound pushes against that goal — the engine treats them as penalties, not
              neutral.
            </Small>
          </Tile>
        </>
      ) : null}

      {(['severe', 'moderate', 'mild'] as Severity[]).some((s) => grouped[s].length > 0) ? (
        <>
          <Spacer size={spacing.xl} />
          <Tile elevation="mid" caption="Side effects">
            <View style={{ gap: spacing.lg }}>
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
            </View>
          </Tile>
        </>
      ) : null}

      {peptide.redFlags.length > 0 ? (
        <>
          <Spacer size={spacing.xl} />
          <Tile
            elevation="mid"
            icon={<TriangleAlert size={15} color={theme.tone('critical').fg} />}
            caption="Stop and seek care if"
            style={{ borderColor: theme.tone('critical').fg }}
          >
            <List>
              {peptide.redFlags.map((flag) => (
                <ListItem key={flag.symptom} tone="critical" title={flag.symptom} detail={flag.action} />
              ))}
            </List>
          </Tile>
        </>
      ) : null}

      {otherContraindications.length > 0 ? (
        <>
          <Spacer size={spacing.xl} />
          <Tile elevation="mid" icon={<Ban size={15} color={color.textSecondary} />} caption="Do not use if">
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
          </Tile>
        </>
      ) : null}

      {/* Reference detail — behind disclosure, quiet weight. */}
      <Spacer size={spacing.xl} />
      <Tile elevation="low" icon={<Info size={15} color={color.textSecondary} />} caption="More about this compound">
        <View style={{ gap: spacing.lg }}>
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
        </View>
      </Tile>

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
    <Tile elevation="mid" icon={<Droplet size={15} color={color.textSecondary} />} caption="Reconstitution calculator">
      <View style={{ gap: spacing.lg }}>
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
      </View>
    </Tile>
  );
}
