import { useRouter } from 'expo-router';
import {
  Bell,
  BellRing,
  BookOpen,
  ChevronRight,
  Download,
  FileText,
  Gauge,
  IdCard,
  Layers,
  Lock,
  LogIn,
  Palette,
  Ruler,
  ShieldCheck,
  Target,
  Trash2,
  User,
} from 'lucide-react-native';
import { useMemo, type ReactNode } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { RISK_TOLERANCE_BY_LEVEL, GOALS_BY_ID } from '../../src/domain/goals';
import { getPeptide } from '../../src/domain/peptides';
import { generateSchedule } from '../../src/engine/cycle';
import { computeDose, formatDose } from '../../src/engine/dosing';
import { addDays, today } from '../../src/lib/date';
import { cancelAllReminders } from '../../src/lib/notifications';
import { formatLength, formatMass } from '../../src/lib/units';
import { selectAdherence, useActiveStack, useAppStore } from '../../src/store/useAppStore';
import { Badge, Body, Caption, Divider, Row, Screen, Small, Spacer } from '../../src/ui/components';
import { EvidenceBadge, PhaseBar, Tile } from '../../src/ui/nocturne';
import { Avatar, Disclosure } from '../../src/ui/primitives';
import { riskLevelTone, RiskPicker } from '../../src/ui/RiskPicker';
import { fonts, radius, spacing, typography, useTheme } from '../../src/ui/theme';

/**
 * Me — NOCTURNE (design-lab/agents/14-me.sh).
 *
 * The old version was ~10 identically-shaped bordered `Section` cards in one
 * scroll (design-lab/00-audit.md: "the worst screen in the app") — body,
 * recovery, goals, risk, current peptides, health, reminders, side-effects,
 * about, erase-data, all carrying equal weight regardless of how often they're
 * touched. This version ranks by real use: a compact identity header, then
 * exactly two promoted tiles (the risk dial and the current stack — the two
 * things the audit and the brief both call out), then everything else
 * demoted into a small number of quiet grouped rows, with the one genuinely
 * destructive action pulled out on its own.
 *
 * The risk dial in particular gets a real presentation here for the first
 * time on this screen (`RiskPicker`'s own doc comment already promised "the
 * Me tab" as one of its three homes — this was the missing one). It
 * communicates AGENTS.md's two load-bearing invariants visually rather than
 * in a paragraph: the gauge below only ever spans published low → typical →
 * high with nothing past the last segment, and "what moving it changes"
 * states plainly that only dose amount moves — selection and stack size are
 * fixed, mirrors the same two facts app/onboarding/index.tsx's review step
 * already states, so the two screens agree.
 */

function Chevron() {
  const { color } = useTheme();
  return <ChevronRight size={16} color={color.textTertiary} />;
}

/** Mirrors `RowIcon` in app/onboarding/index.tsx's risk-review step exactly,
 *  so the "what changes" comparison reads as the same component on both
 *  screens. */
function RowIcon({ accent = false, children }: { accent?: boolean; children: ReactNode }) {
  const { color } = useTheme();
  return (
    <View
      style={{
        width: 32,
        height: 32,
        borderRadius: radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: accent ? color.primarySoft : color.surfaceMuted,
      }}
    >
      {children}
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const { color } = useTheme();
  return (
    <View style={{ flex: 1 }}>
      <Text style={[typography.data, { fontSize: 17, color: color.textPrimary }]} numberOfLines={1}>
        {value}
      </Text>
      <Caption style={{ marginTop: 2 }}>{label}</Caption>
    </View>
  );
}

/** Five discrete positions, coloured up to the current level — status is
 *  never colour alone, so the numeral label always sits beside these. */
function RiskDots({ value }: { value: 1 | 2 | 3 | 4 | 5 }) {
  const theme = useTheme();
  const { color } = theme;
  const fg = theme.tone(riskLevelTone(value)).fg;
  return (
    <Row gap={spacing.xs}>
      {([1, 2, 3, 4, 5] as const).map((level) => (
        <View
          key={level}
          style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: level <= value ? fg : color.border }}
        />
      ))}
    </Row>
  );
}

function QuietGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <Caption style={{ marginBottom: spacing.sm }}>{title}</Caption>
      <Tile elevation="low">{children}</Tile>
    </View>
  );
}

function QuietRow({
  icon,
  label,
  value,
  onPress,
  last = false,
}: {
  icon: ReactNode;
  label: string;
  value?: string;
  onPress: () => void;
  last?: boolean;
}) {
  const theme = useTheme();
  const { color } = theme;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      onPress={onPress}
      style={({ pressed }) => [
        styles.quietRow,
        { borderBottomColor: color.divider, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={[styles.rowIconWrap, { backgroundColor: color.surfaceMuted }]}>{icon}</View>
      <Text style={[typography.body, { color: color.textPrimary, flex: 1 }]} numberOfLines={1}>
        {label}
      </Text>
      {value ? (
        <Text style={[typography.small, { color: color.textSecondary }]} numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      <Chevron />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const theme = useTheme();
  const { color } = theme;
  const router = useRouter();
  const profile = useAppStore((s) => s.profile);
  const settings = useAppStore((s) => s.settings);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const session = useAppStore((s) => s.session);
  const doseLogs = useAppStore((s) => s.doseLogs);
  const stack = useActiveStack();

  const goalSummary =
    profile && profile.goals.length > 0
      ? profile.goals.map((g) => GOALS_BY_ID[g]?.label ?? g).join(', ')
      : 'No goals set';

  const infoSummary = profile
    ? `${profile.age} yrs · ${formatMass(profile.weightKg, settings.massUnit)} · ${formatLength(profile.heightCm, settings.lengthUnit)}`
    : 'Complete your profile';

  const activeNotifications = [
    settings.notifications.doseReminders && settings.remindersEnabled,
    settings.notifications.titrationChanges,
    settings.notifications.cycleTransitions,
    settings.notifications.sideEffectCheckins,
  ].filter(Boolean).length;

  const alarmSummary =
    settings.alarmOffsetsMin.length === 1 && settings.alarmOffsetsMin[0] === 0
      ? 'At injection time'
      : `${settings.alarmOffsetsMin.length} alert${settings.alarmOffsetsMin.length === 1 ? '' : 's'} per dose`;

  // Same 14-day adherence math as the Today screen (selectAdherence over a
  // generated 14-day schedule) — reused, not reinvented, so the number
  // agrees wherever it's shown.
  const adherencePct = useMemo(() => {
    if (!stack) return null;
    const doses = generateSchedule(stack, addDays(today(), -13), today());
    const { pct, taken, skipped } = selectAdherence(doses, doseLogs);
    return taken + skipped === 0 ? null : pct;
  }, [stack, doseLogs]);

  const riskLevel = profile?.riskTolerance ?? 3;
  const activeRisk = RISK_TOLERANCE_BY_LEVEL[riskLevel];

  // Concrete proof of the two AGENTS.md invariants using real numbers: the
  // first non-withheld stack item's dose today vs. what it would be with the
  // dial turned all the way to Maximum. computeDose is a pure function — this
  // calls it a second time with a hypothetical risk value purely to render
  // the comparison, it changes nothing in the store.
  const workedExample = useMemo(() => {
    if (!stack || !profile) return null;
    const item = stack.items.find((i) => !i.doseWithheld);
    if (!item) return null;
    const peptide = getPeptide(item.peptideId);
    if (!peptide) return null;
    const current = computeDose(peptide, profile);
    const atMax = computeDose(peptide, { ...profile, riskTolerance: 5 });
    if (current.withheld || atMax.withheld) return null;
    return { peptide, current, atMax, same: current.dose.value === atMax.dose.value };
  }, [stack, profile]);

  const LOCK_MESSAGE =
    'You will need to accept the safety disclaimer again to get back in. Nothing is deleted — your profile, stacks and logs stay on this device.';

  const lockApp = () => {
    void cancelAllReminders();
    updateProfile({ acceptedDisclaimerAt: undefined, acceptedTermsAt: undefined });
    router.replace('/');
  };

  const onLockApp = () => {
    if (Platform.OS === 'web') {
      // eslint-disable-next-line no-alert
      if (typeof confirm === 'function' && !confirm(`Lock the app?\n\n${LOCK_MESSAGE}`)) return;
      lockApp();
      return;
    }
    Alert.alert('Lock the app?', LOCK_MESSAGE, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Lock', onPress: lockApp },
    ]);
  };

  return (
    <Screen>
      <Spacer size={spacing.md} />

      {/* Compact identity header — not a settings card. */}
      <Row gap={spacing.md} align="center">
        {session ? (
          <Avatar initials={session.email[0]?.toUpperCase()} size={52} />
        ) : (
          <Avatar icon={<User size={20} color={color.onPrimary} strokeWidth={2} />} size={52} />
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[typography.title, { color: color.textPrimary }]} numberOfLines={1}>
            {session ? session.email : 'Guest profile'}
          </Text>
          <Small style={{ marginTop: 2 }}>{infoSummary}</Small>
        </View>
      </Row>

      {/* At-a-glance — only real, already-computed dataset numbers. */}
      {profile ? (
        <Row style={{ marginTop: spacing.lg }} gap={spacing.lg}>
          <MiniStat label="Bodyweight" value={formatMass(profile.weightKg, settings.massUnit)} />
          <MiniStat label="Active compounds" value={`${stack?.items.length ?? 0}`} />
          <MiniStat label="Adherence · 14d" value={adherencePct === null ? '—' : `${adherencePct}%`} />
        </Row>
      ) : null}

      <Spacer size={spacing.xl} />

      {/* PROMOTED 1 — the risk dial. The most misunderstood control in the
       *  product (design-lab/00-audit.md), so it earns a real presentation
       *  rather than a picker + a caveat sentence. */}
      <Tile
        elevation="mid"
        icon={<Gauge size={15} color={color.textSecondary} />}
        caption="Risk dial"
        style={{ marginBottom: spacing.lg }}
      >
        <RiskDots value={riskLevel} />
        <Row align="baseline" gap={spacing.xs} style={{ marginTop: spacing.sm }}>
          <Text style={[typography.heading, { color: color.textPrimary }]}>{activeRisk.label}</Text>
          <Small>· {riskLevel} of 5</Small>
        </Row>
        <Small style={{ marginTop: 2 }}>Changes dose only — never which compounds are selected</Small>

        {profile ? (
          <View style={{ marginTop: spacing.md }}>
            <Disclosure label="How this works" summary="Anchors, the ceiling, and what stays fixed">
              <View style={{ gap: spacing.lg }}>
                <RiskPicker
                  value={profile.riskTolerance}
                  onChange={(next) => updateProfile({ riskTolerance: next })}
                />

                <View>
                  <Caption>Where this sits</Caption>
                  <View style={{ marginTop: spacing.sm }}>
                    {/* PhaseBar, reused from src/ui/nocturne.tsx: five equal
                     *  segments spanning published low → typical → high,
                     *  with a "current" marker — nothing rendered exists
                     *  past the fifth segment, which is the visual for
                     *  "never past the published maximum". */}
                    <RiskPhaseGauge value={riskLevel} />
                  </View>
                  <Small style={{ marginTop: spacing.sm }}>
                    Interpolates between the published low, typical and high doses — never past the published
                    maximum.
                  </Small>
                </View>

                <View>
                  <Caption>What moving it changes</Caption>
                  <Row justify="space-between" align="center" style={{ marginTop: spacing.md }}>
                    <Row gap={spacing.sm} align="center" style={{ flex: 1 }}>
                      <RowIcon accent>
                        <Gauge size={16} color={theme.tone('accent').fg} />
                      </RowIcon>
                      <Text style={[typography.bodyStrong, { color: color.textPrimary }]}>Dose amount</Text>
                    </Row>
                    <Badge label="Adjusts" tone="success" />
                  </Row>
                  <Divider />
                  <Row justify="space-between" align="center">
                    <Row gap={spacing.sm} align="center" style={{ flex: 1 }}>
                      <RowIcon>
                        <Lock size={14} color={color.textSecondary} />
                      </RowIcon>
                      <Text style={[typography.bodyStrong, { color: color.textPrimary }]}>Compounds &amp; stack size</Text>
                    </Row>
                    <Row gap={spacing.xs} align="center">
                      <Lock size={12} color={color.textSecondary} />
                      <Small>Fixed</Small>
                    </Row>
                  </Row>
                </View>

                {workedExample ? (
                  <View>
                    <Caption>Worked example · {workedExample.peptide.name}</Caption>
                    <Row justify="space-between" align="center" style={{ marginTop: spacing.sm }}>
                      <View>
                        <Small>Today · {riskLevel} of 5</Small>
                        <Text style={[typography.data, { fontSize: 20, color: color.textPrimary, marginTop: 2 }]}>
                          {formatDose(workedExample.current.dose)}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Small>Max · 5 of 5</Small>
                        <Text style={[typography.data, { fontSize: 20, color: color.primary, marginTop: 2 }]}>
                          {formatDose(workedExample.atMax.dose)}
                        </Text>
                      </View>
                    </Row>
                    <Small style={{ marginTop: spacing.sm }}>
                      {workedExample.same
                        ? `${formatDose(workedExample.current.dose)} is already ${workedExample.peptide.name}'s published ceiling — turning the dial up cannot add more.`
                        : `Turning the dial to Maximum would raise this to ${formatDose(workedExample.atMax.dose)} — still never above the published range.`}
                    </Small>
                  </View>
                ) : null}
              </View>
            </Disclosure>
          </View>
        ) : (
          <Small style={{ marginTop: spacing.md }}>Complete your profile to set your risk dial.</Small>
        )}
      </Tile>

      {/* PROMOTED 2 — current stack. */}
      <Tile
        elevation="mid"
        icon={<Layers size={15} color={color.textSecondary} />}
        caption={stack ? `Current stack · ${stack.items.length} active` : 'Current stack'}
        style={{ marginBottom: spacing.xl }}
      >
        {stack && stack.items.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            {stack.items.map((item) => {
              const peptide = getPeptide(item.peptideId);
              return (
                <Row key={item.peptideId} gap={spacing.sm} align="center">
                  {peptide ? <EvidenceBadge tier={peptide.evidence} size={22} /> : null}
                  <Text style={[typography.body, { color: color.textPrimary, flex: 1 }]} numberOfLines={1}>
                    {peptide?.name ?? item.peptideId}
                  </Text>
                  <Small>{item.doseWithheld ? 'Withheld' : formatDose(item.dose)}</Small>
                </Row>
              );
            })}
          </View>
        ) : (
          <Small>No active stack yet — build one to see it here.</Small>
        )}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={stack ? 'Manage stack' : 'Build a stack'}
          onPress={() => router.push('/builder')}
          style={({ pressed }) => [styles.tileLinkRow, { borderTopColor: color.divider, opacity: pressed ? 0.7 : 1 }]}
        >
          <Text style={[typography.small, { fontFamily: fonts.semibold, color: color.primary }]}>
            {stack ? 'Manage stack' : 'Build a stack'}
          </Text>
          <ChevronRight size={14} color={color.primary} />
        </Pressable>
      </Tile>

      {/* Demoted — quiet grouped rows, everything the audit found stacked as
       *  ten equal cards, now weighted well below the two tiles above. */}
      <QuietGroup title="Profile & goals">
        <QuietRow icon={<Target size={16} color={color.textSecondary} />} label="Goals" value={goalSummary} onPress={() => router.push('/settings/goals')} />
        <QuietRow icon={<IdCard size={16} color={color.textSecondary} />} label="My Info" value={infoSummary} onPress={() => router.push('/settings/my-info')} />
        <QuietRow
          icon={<Ruler size={16} color={color.textSecondary} />}
          label="Measurement units"
          value={`${settings.massUnit === 'kg' ? 'Kilograms' : 'Pounds'} · ${settings.lengthUnit === 'cm' ? 'Centimetres' : 'Feet & inches'}`}
          onPress={() => router.push('/settings/units')}
          last
        />
      </QuietGroup>

      <QuietGroup title="Reminders">
        <QuietRow icon={<Bell size={16} color={color.textSecondary} />} label="Alarm" value={alarmSummary} onPress={() => router.push('/settings/alarm')} />
        <QuietRow
          icon={<BellRing size={16} color={color.textSecondary} />}
          label="Notifications"
          value={`${activeNotifications} of 4 on`}
          onPress={() => router.push('/settings/notifications')}
          last
        />
      </QuietGroup>

      <QuietGroup title="App">
        <QuietRow
          icon={<Palette size={16} color={color.textSecondary} />}
          label="Theme"
          value={settings.theme === 'dark' ? 'Dark' : settings.theme === 'light' ? 'Light' : 'System'}
          onPress={() => router.push('/settings/theme')}
        />
        <QuietRow
          icon={<BookOpen size={16} color={color.textSecondary} />}
          label="Library"
          value="Every compound, with sources"
          onPress={() => router.push('/settings/library')}
          last
        />
      </QuietGroup>

      <QuietGroup title="Account">
        {session ? (
          <QuietRow icon={<User size={16} color={color.textSecondary} />} label={session.email} value="Signed in" onPress={() => router.push('/settings/account')} />
        ) : (
          <QuietRow
            icon={<LogIn size={16} color={color.textSecondary} />}
            label="Create account or sign in"
            value="Back up & sync"
            onPress={() => router.push('/settings/account')}
          />
        )}
        <QuietRow icon={<Lock size={16} color={color.textSecondary} />} label="Lock app" value="Re-locks the disclaimer" onPress={onLockApp} last />
      </QuietGroup>

      <QuietGroup title="Data & privacy">
        <QuietRow icon={<ShieldCheck size={16} color={color.textSecondary} />} label="Privacy" value="How your data is stored" onPress={() => router.push('/settings/privacy')} />
        <QuietRow icon={<Download size={16} color={color.textSecondary} />} label="Manage data" value="Export as PDF, CSV or JSON" onPress={() => router.push('/settings/manage-data')} />
        <QuietRow icon={<FileText size={16} color={color.textSecondary} />} label="Terms of Service" onPress={() => router.push('/settings/terms')} last />
      </QuietGroup>

      {/* Destructive — visually separated from every ordinary row above,
       *  critical colour earned here because this one action is genuinely
       *  irreversible. Label stays textPrimary rather than the critical hex:
       *  that hex doesn't reliably clear 4.5:1 body-text contrast on every
       *  surface in light mode, so only the icon, border and chevron (a 3:1
       *  non-text threshold) carry it. */}
      <View style={{ marginTop: spacing.xs }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Delete account — permanently erases all data on this device"
          onPress={() => router.push('/settings/delete-account')}
          style={({ pressed }) => [
            styles.destructiveRow,
            { backgroundColor: color.surface, borderColor: theme.tone('critical').fg, opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <View style={[styles.rowIconWrap, { backgroundColor: color.surfaceMuted }]}>
            <Trash2 size={16} color={theme.tone('critical').fg} />
          </View>
          <Text style={[typography.bodyStrong, { color: color.textPrimary, flex: 1 }]}>Delete account</Text>
          <ChevronRight size={16} color={theme.tone('critical').fg} />
        </Pressable>
      </View>

      <View style={{ marginTop: spacing.xl, alignItems: 'center' }}>
        <Body muted style={{ textAlign: 'center' }}>
          The Stack — educational use only. Not medical advice.
        </Body>
      </View>
    </Screen>
  );
}

/** Five equal segments (Low · · Typical · · Max) with a "current" marker at
 *  the dial's position — reuses `PhaseBar` from src/ui/nocturne.tsx rather
 *  than a bespoke gauge. Position is centred inside its own segment (never
 *  exactly on a boundary) so every level, including 5, gets the "current"
 *  highlight rather than reading as "done". */
function RiskPhaseGauge({ value }: { value: 1 | 2 | 3 | 4 | 5 }) {
  const segments = [
    { key: '1', label: 'Low', length: 1 },
    { key: '2', label: '', length: 1 },
    { key: '3', label: 'Typical', length: 1 },
    { key: '4', label: '', length: 1 },
    { key: '5', label: 'Max', length: 1 },
  ];
  return <PhaseBar segments={segments} position={(value - 0.5) / 5} />;
}

const styles = StyleSheet.create({
  quietRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  rowIconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    minHeight: 32,
  },
  destructiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 44,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderRadius: radius.lg,
  },
});
