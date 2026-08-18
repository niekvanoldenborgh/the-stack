import type { ReactNode } from 'react';
import { View } from 'react-native';

import { getPeptide } from '../domain/peptides';
import type {
  ContraindicationFinding,
  GoalConflictFinding,
  InteractionFinding,
  InteractionSeverity,
  RedFlag,
  SafetyNotice,
  SafetyReport as SafetyReportData,
  SideEffect,
} from '../domain/types';
import { GOALS_BY_ID, HEALTH_FLAGS_BY_ID } from '../domain/goals';
import { Badge, Callout, Caption, Display, Row, Small, Title } from './components';
import { List, ListItem, Section } from './primitives';
import { spacing, useTheme, type SeverityTone } from './theme';

/**
 * The one safety-report surface (THEA-38).
 *
 * Before this, `recommendation.tsx`, `builder.tsx` and `safety.tsx` each hand
 * rolled their own rendering of a `SafetyReport` — three slightly different
 * flat stacks of identically-coloured Callouts. This renders the same data
 * shape everywhere, organised into severity tiers (blocking → contraindicated
 * → interactions → red flags → goal conflicts → notices → reference data)
 * instead of one undifferentiated list, so the worst finding on the page is
 * always the first thing scanned.
 *
 * Every tier is optional-in — an empty array renders nothing — so a caller
 * with a partial report (e.g. no `interactionsWithCurrent` outside the
 * recommendation flow) doesn't need to special-case it.
 */

function severityTone(severity: InteractionSeverity): SeverityTone {
  return severity;
}

function peptideName(id: string): string {
  return getPeptide(id)?.name ?? id;
}

export function SafetyReportView({
  report,
  band,
  bandNote,
  blockingCopy,
  interactionsWithCurrentTitle = 'Against what you are already on',
}: {
  report: SafetyReportData;
  /** Risk-score header, shown at the top when supplied. Omit if the caller already shows this figure elsewhere on the page. */
  band?: { label: string; riskScore: number; tone: 'low' | 'moderate' | 'high' | 'severe' };
  /** Explanatory line under the risk header — what the score means, its limits. */
  bandNote?: string;
  /** Copy for the blocking banner. Defaults suit a builder/save context. */
  blockingCopy?: { title: string; body: string };
  interactionsWithCurrentTitle?: string;
}) {
  const theme = useTheme();
  const {
    interactions,
    interactionsWithCurrent,
    contraindications,
    goalConflicts,
    notices,
    sideEffects,
    redFlags,
    monitoring,
    blocking,
  } = report;

  const absolute = contraindications.filter((c) => c.kind === 'absolute');
  const relative = contraindications.filter((c) => c.kind === 'relative');
  const bandTone: SeverityTone | 'accent' | undefined = band
    ? band.tone === 'severe'
      ? 'critical'
      : band.tone === 'low'
        ? 'accent'
        : band.tone
    : undefined;

  const nothingToReport =
    !blocking &&
    interactions.length === 0 &&
    interactionsWithCurrent.length === 0 &&
    contraindications.length === 0 &&
    goalConflicts.length === 0 &&
    notices.length === 0 &&
    redFlags.length === 0 &&
    sideEffects.length === 0 &&
    monitoring.length === 0;

  return (
    <View>
      {band ? (
        <Section tone={2}>
          <Row justify="space-between" align="flex-end">
            <View style={{ flex: 1 }}>
              <Caption>Overall risk</Caption>
              <Title style={{ marginTop: spacing.xs }}>{band.label}</Title>
            </View>
            <Display
              style={{
                color:
                  bandTone === undefined
                    ? theme.color.textPrimary
                    : bandTone === 'accent'
                      ? theme.color.primary
                      : theme.tone(bandTone).fg,
              }}
            >
              {band.riskScore}
            </Display>
          </Row>
          {bandNote ? <Small style={{ marginTop: spacing.sm }}>{bandNote}</Small> : null}
        </Section>
      ) : null}

      {blocking ? (
        <Callout tone="critical" title={blockingCopy?.title ?? 'This has a blocking finding'}>
          <Small muted={false}>
            {blockingCopy?.body ??
              'Something here is absolutely contraindicated for your health history, or there is a critical interaction. Both mean: do not run this as it stands.'}
          </Small>
        </Callout>
      ) : null}

      {nothingToReport ? <Small>No safety findings for this selection.</Small> : null}

      {absolute.length > 0 || relative.length > 0 ? (
        <Section title="Contraindications">
          <List>
            {absolute.map((c) => (
              <ContraindicationRow key={`${c.peptideId}-${c.flag}`} finding={c} />
            ))}
            {relative.map((c) => (
              <ContraindicationRow key={`${c.peptideId}-${c.flag}`} finding={c} />
            ))}
          </List>
        </Section>
      ) : null}

      {interactionsWithCurrent.length > 0 ? (
        <Section title={interactionsWithCurrentTitle}>
          <List>
            {interactionsWithCurrent.map((finding) => (
              <InteractionRow key={`${finding.ruleId}-${finding.peptideIds.join('-')}`} finding={finding} />
            ))}
          </List>
        </Section>
      ) : null}

      {interactions.length > 0 ? (
        <Section title="Interactions in this stack">
          <List>
            {interactions.map((finding) => (
              <InteractionRow key={`${finding.ruleId}-${finding.peptideIds.join('-')}`} finding={finding} />
            ))}
          </List>
        </Section>
      ) : null}

      {redFlags.length > 0 ? (
        <Section title="Stop and seek care if" tone={2}>
          <List>
            {redFlags.map((flag) => (
              <RedFlagRow key={flag.symptom} flag={flag} />
            ))}
          </List>
        </Section>
      ) : null}

      {goalConflicts.length > 0 ? (
        <Section title="Conflicting goals">
          <List>
            {goalConflicts.map((conflict) => (
              <ListItem
                key={conflict.goals.join('-')}
                tone="moderate"
                title={`${GOALS_BY_ID[conflict.goals[0]]?.label ?? conflict.goals[0]} vs ${GOALS_BY_ID[conflict.goals[1]]?.label ?? conflict.goals[1]}`}
                detail={`${conflict.detail} ${conflict.guidance}`}
              />
            ))}
          </List>
        </Section>
      ) : null}

      {notices.length > 0 ? (
        <Section title="Notices">
          <List>
            {notices.map((notice) => (
              <NoticeRow key={notice.id} notice={notice} />
            ))}
          </List>
        </Section>
      ) : null}

      {sideEffects.length > 0 ? (
        <Section title="Combined side effects">
          <Small style={{ marginBottom: spacing.sm }}>
            Merged across your selection. Where several compounds share an effect, the risk is additive.
          </Small>
          <List>
            {sideEffects.map((effect) => (
              <SideEffectRow key={effect.label} effect={effect} />
            ))}
          </List>
        </Section>
      ) : null}

      {monitoring.length > 0 ? (
        <Section title="Monitoring checklist" last>
          <List>
            {monitoring.map((item, index) => (
              <ListItem key={index} title={item} checked={false} />
            ))}
          </List>
        </Section>
      ) : null}
    </View>
  );
}

function ContraindicationRow({ finding }: { finding: ContraindicationFinding }) {
  const tone = finding.kind === 'absolute' ? 'critical' : 'high';
  return (
    <ListItem
      tone={tone}
      title={`${peptideName(finding.peptideId)} — ${HEALTH_FLAGS_BY_ID[finding.flag]?.label ?? finding.flag}`}
      detail={finding.reason}
      meta={<Badge label={finding.kind === 'absolute' ? 'Absolute' : 'Caution'} tone={tone} />}
    />
  );
}

function InteractionRow({ finding }: { finding: InteractionFinding }) {
  const tone = severityTone(finding.severity);
  return (
    <ListItem
      tone={tone}
      title={finding.title}
      detail={`${finding.peptideIds.map(peptideName).join(' + ')} — ${finding.detail} ${finding.guidance}`}
      meta={<Badge label={finding.severity} tone={tone} />}
    />
  );
}

function RedFlagRow({ flag }: { flag: RedFlag & { peptideIds?: string[] } }) {
  return (
    <ListItem
      tone="critical"
      title={flag.symptom}
      detail={flag.peptideIds && flag.peptideIds.length > 0 ? `${flag.action} From: ${flag.peptideIds.map(peptideName).join(', ')}` : flag.action}
    />
  );
}

function NoticeRow({ notice }: { notice: SafetyNotice }) {
  const tone = notice.severity === 'critical' ? 'critical' : notice.severity === 'high' ? 'high' : notice.severity === 'moderate' ? 'moderate' : 'info';
  return <ListItem tone={tone} title={notice.title} detail={notice.detail} meta={<Badge label={notice.severity} tone={tone} />} />;
}

function SideEffectRow({ effect }: { effect: SideEffect & { peptideIds: string[] } }) {
  const tone = effect.severity === 'severe' ? 'critical' : effect.severity === 'moderate' ? 'moderate' : 'info';
  return (
    <ListItem
      tone={tone}
      title={effect.label}
      detail={
        `${effect.likelihood}` +
        (effect.peptideIds.length > 1 ? ` · ${effect.peptideIds.length} compounds` : ` · ${peptideName(effect.peptideIds[0]!)}`) +
        (effect.detail ? ` — ${effect.detail}` : '')
      }
      meta={<Badge label={effect.severity} tone={tone} />}
    />
  );
}

export type { SafetyReportData as SafetyReportShape };
