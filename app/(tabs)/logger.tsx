import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { PEPTIDES, getPeptide, searchPeptides } from '../../src/domain/peptides';
import { SEVERITY_MAX, SEVERITY_MIN, SIDE_EFFECT_OPTIONS, severityBand } from '../../src/domain/sideEffects';
import type { Dose, DoseUnit, InjectionSite } from '../../src/domain/types';
import { concentration, formatDose, reconstitute } from '../../src/engine/dosing';
import { formatShort, today } from '../../src/lib/date';
import { useAppStore } from '../../src/store/useAppStore';
import { BodyFigure, INJECTION_SITE_LABELS } from '../../src/ui/BodyFigure';
import {
  Body,
  Button,
  Callout,
  Caption,
  Data,
  Display,
  Row,
  Screen,
  Small,
  Spacer,
} from '../../src/ui/components';
import { List, ListItem, Section } from '../../src/ui/primitives';
import { Segmented } from '../../src/ui/schedule';
import { colors, fonts, radius, spacing, type SeverityTone, typography } from '../../src/ui/theme';

/**
 * Logger, redesigned THEA-40.
 *
 * The old layout was six-odd flat blocks separated by `SectionTitle` labels
 * with no grouping beneath them — every field read at the same visual
 * weight, whether it was "pick a compound" or "optional note". Related
 * fields now share one `Section` panel (compound, dose, when-and-where,
 * notes) so the screen reads as four decisions instead of a dozen
 * ungrouped inputs, and both history lists use `List`/`ListItem` instead of
 * the old bordered `ListRow`.
 *
 * None of the underlying logic changed: every safety comment below (no
 * default unit, no default severity, warn-never-block on an over-max dose)
 * is carried over verbatim from the pre-redesign screen.
 */

type Mode = 'injection' | 'side-effect';

const MODES: { key: Mode; label: string }[] = [
  { key: 'injection', label: 'Injection' },
  { key: 'side-effect', label: 'Side-effect' },
];

/** Units a user can log an injection in. `pct` is topical-only, so excluded. */
const DOSE_UNITS: DoseUnit[] = ['mcg', 'mg', 'iu'];

function nowHHmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseNumber(text: string): number {
  return Number(text.replace(',', '.'));
}

export default function LoggerScreen() {
  const [mode, setMode] = useState<Mode>('injection');

  return (
    <Screen>
      <Caption color={colors.accent}>Log</Caption>
      <Display style={{ marginTop: spacing.sm }}>Logger</Display>
      <Small style={{ marginTop: spacing.xs }}>
        Record what you actually did. Every number here is yours — the app never suggests a dose, it only does the
        arithmetic on what you type.
      </Small>
      <Spacer size={spacing.lg} />

      <Segmented options={MODES.map((m) => ({ value: m.key, label: m.label }))} value={mode} onChange={setMode} />

      <Spacer size={spacing.xl} />

      {mode === 'injection' ? <InjectionLogger /> : <SideEffectLogger />}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Injection logger
// ---------------------------------------------------------------------------

function InjectionLogger() {
  const injectionLogs = useAppStore((s) => s.injectionLogs);
  const logInjection = useAppStore((s) => s.logInjection);
  const removeInjection = useAppStore((s) => s.removeInjection);

  const [peptideId, setPeptideId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [doseValue, setDoseValue] = useState('');
  // No default unit (P&S sign-off, THEA-9): the user picks every time, so a
  // stale pre-selection can never carry a mg/mcg mistake into the log.
  const [doseUnit, setDoseUnit] = useState<DoseUnit | null>(null);
  const [drawn, setDrawn] = useState('');
  const [time, setTime] = useState(nowHHmm());
  const [site, setSite] = useState<InjectionSite | null>(null);
  const [pain, setPain] = useState(0);
  const [note, setNote] = useState('');

  const results = useMemo(() => searchPeptides(search).slice(0, 8), [search]);
  const selectedPeptide = peptideId ? getPeptide(peptideId) : null;

  const doseNum = parseNumber(doseValue);
  const drawnNum = parseNumber(drawn);
  const canSave = Boolean(peptideId) && doseNum > 0 && doseUnit !== null && site !== null;

  // Warn, never block, when the entered dose exceeds the compound's published
  // maximum — the user already injected, so the log must stay true (AGENTS.md
  // invariant 6: only critical findings block, and this isn't a save gate).
  // Only compare when units match: converting mg/mcg here to "check" would be
  // exactly the implicit conversion invariant 8 rules out.
  const overMax =
    selectedPeptide && doseNum > 0 && doseUnit === selectedPeptide.dosing.unit
      ? doseNum > selectedPeptide.dosing.hardMax
      : false;

  // Double-check, not a default: flag it if the picked unit doesn't match how
  // the compound is normally dosed, so a mg/mcg mixup gets caught before save
  // rather than defaulted away (P&S sign-off, THEA-9).
  const unitMismatch =
    selectedPeptide && doseUnit !== null && doseUnit !== selectedPeptide.dosing.unit;

  const pickPeptide = (id: string) => {
    setPeptideId(id);
    setSearch('');
  };

  const reset = () => {
    setPeptideId(null);
    setSearch('');
    setDoseValue('');
    setDoseUnit(null);
    setDrawn('');
    setTime(nowHHmm());
    setSite(null);
    setPain(0);
    setNote('');
  };

  const save = () => {
    if (!canSave || !peptideId || !site || !doseUnit) return;
    const dose: Dose = { value: doseNum, unit: doseUnit };
    logInjection({
      date: today(),
      time: time.trim() || nowHHmm(),
      peptideId,
      dose,
      drawnUnits: drawnNum > 0 ? drawnNum : undefined,
      site,
      painLevel: pain,
      note: note.trim() || undefined,
    });
    reset();
  };

  return (
    <View>
      {/* Compound ----------------------------------------------------------- */}
      <Section title="Compound">
        {selectedPeptide ? (
          <Row justify="space-between">
            <View style={{ flex: 1 }}>
              <Body>{selectedPeptide.name}</Body>
              <Small>{selectedPeptide.dosing.note}</Small>
            </View>
            <Button label="Change" variant="ghost" onPress={() => setPeptideId(null)} />
          </Row>
        ) : (
          <View>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={`Search ${PEPTIDES.length} compounds`}
              placeholderTextColor={colors.textFaint}
              style={styles.input}
              autoCorrect={false}
            />
            {results.length > 0 ? (
              <List style={{ marginTop: spacing.md }}>
                {results.map((p) => (
                  <ListItem key={p.id} title={p.name} detail={p.summary} onPress={() => pickPeptide(p.id)} />
                ))}
              </List>
            ) : null}
          </View>
        )}
      </Section>

      {/* Dose — user entered -------------------------------------------------- */}
      <Section title="Dose you injected" gap={spacing.md}>
        <Row gap={spacing.sm} align="center">
          <TextInput
            value={doseValue}
            onChangeText={setDoseValue}
            keyboardType="decimal-pad"
            placeholder="0"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, { flex: 1 }]}
          />
          <Row gap={spacing.xs}>
            {DOSE_UNITS.map((u) => {
              const active = u === doseUnit;
              return (
                <Pressable
                  key={u}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setDoseUnit(u)}
                  style={[
                    styles.unitPill,
                    { backgroundColor: active ? colors.accentDim : colors.surfaceHigh, borderColor: active ? colors.accent : colors.border },
                  ]}
                >
                  <Text style={[styles.unitLabel, { color: active ? colors.accent : colors.textMuted }]}>
                    {u === 'iu' ? 'IU' : u}
                  </Text>
                </Pressable>
              );
            })}
          </Row>
        </Row>
        {unitMismatch && selectedPeptide ? (
          <Callout tone="moderate">
            {`Double-check the unit — ${selectedPeptide.name} is normally dosed in ${
              selectedPeptide.dosing.unit === 'iu' ? 'IU' : selectedPeptide.dosing.unit
            }, and you picked ${doseUnit === 'iu' ? 'IU' : doseUnit}. Logged as entered either way.`}
          </Callout>
        ) : null}
        {overMax && selectedPeptide ? (
          <Callout tone="moderate">
            {`Above the published maximum for ${selectedPeptide.name}: ${selectedPeptide.dosing.hardMax} ${
              selectedPeptide.dosing.unit === 'iu' ? 'IU' : selectedPeptide.dosing.unit
            } (${selectedPeptide.sources[0] ?? 'compound reference'}). This is logged as entered — nothing here is blocked or corrected.`}
          </Callout>
        ) : null}
        <View>
          <Caption color={colors.textFaint}>Amount drawn (syringe units, optional)</Caption>
          <Spacer size={spacing.xs} />
          <TextInput
            value={drawn}
            onChangeText={setDrawn}
            keyboardType="decimal-pad"
            placeholder="e.g. 10"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
          />
        </View>
      </Section>

      {/* When & where --------------------------------------------------------- */}
      <Section title="When & where" gap={spacing.lg}>
        <Row justify="space-between" align="center">
          <Caption color={colors.textMuted}>Time</Caption>
          <TextInput
            value={time}
            onChangeText={setTime}
            placeholder="HH:mm"
            placeholderTextColor={colors.textFaint}
            style={[styles.input, { width: 120 }]}
          />
        </Row>

        <View>
          <Caption color={colors.textMuted}>Injection site</Caption>
          <Small style={{ marginTop: spacing.xs }}>Tap where you injected. Left and right are your own.</Small>
          <Spacer size={spacing.md} />
          <BodyFigure value={site} onChange={setSite} />
          {site ? (
            <Small style={{ textAlign: 'center', marginTop: spacing.sm, color: colors.text }}>
              {INJECTION_SITE_LABELS[site]}
            </Small>
          ) : null}
        </View>

        <View>
          <Caption color={colors.textMuted}>Pain level</Caption>
          <Spacer size={spacing.sm} />
          <PainScale value={pain} onChange={setPain} />
        </View>
      </Section>

      {/* Notes + save ----------------------------------------------------------- */}
      <Section title="Notes" gap={spacing.md}>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Anything worth remembering (optional)"
          placeholderTextColor={colors.textFaint}
          style={[styles.input, styles.multiline]}
          multiline
        />
        <Button label="Log injection" onPress={save} disabled={!canSave} />
      </Section>

      {/* History -------------------------------------------------------------- */}
      <Section title="Recent injections" last>
        {injectionLogs.length === 0 ? (
          <Small>Your injections will appear here once you log one.</Small>
        ) : (
          <List>
            {injectionLogs.slice(0, 20).map((log) => {
              const p = getPeptide(log.peptideId);
              return (
                <ListItem
                  key={log.id}
                  title={p?.name ?? log.peptideId}
                  detail={`${formatShort(log.date)} ${log.time} · ${INJECTION_SITE_LABELS[log.site]} · pain ${log.painLevel}/10`}
                  meta={
                    <Row gap={spacing.md}>
                      <Data small color={colors.textMuted}>
                        {formatDose(log.dose)}
                      </Data>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${p?.name ?? log.peptideId} log from ${formatShort(log.date)}`}
                        hitSlop={8}
                        onPress={() => removeInjection(log.id)}
                      >
                        <Text style={{ color: colors.textFaint, fontFamily: fonts.sans, fontSize: 15 }}>✕</Text>
                      </Pressable>
                    </Row>
                  }
                />
              );
            })}
          </List>
        )}
      </Section>
    </View>
  );
}

/** 0–10 self-reported injection pain as a tap scale. */
function PainScale({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <Row gap={spacing.xs} wrap>
      {Array.from({ length: 11 }, (_, n) => {
        const active = n === value;
        return (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`Pain ${n} of 10`}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(n)}
            style={[
              styles.scaleDot,
              { backgroundColor: active ? colors.accent : colors.surfaceHigh, borderColor: active ? colors.accent : colors.border },
            ]}
          >
            <Text style={[styles.scaleLabel, { color: active ? colors.accentText : colors.textMuted }]}>{n}</Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

/**
 * 1–10 self-reported side-effect severity as a tap scale. `value` is `null`
 * until the user taps one — there is no default (P&S sign-off, THEA-9).
 */
function SeverityScale({ value, onChange }: { value: number | null; onChange: (n: number) => void }) {
  return (
    <Row gap={spacing.xs} wrap>
      {Array.from({ length: SEVERITY_MAX - SEVERITY_MIN + 1 }, (_, i) => i + SEVERITY_MIN).map((n) => {
        const active = n === value;
        return (
          <Pressable
            key={n}
            accessibilityRole="button"
            accessibilityLabel={`Severity ${n} of ${SEVERITY_MAX}`}
            accessibilityState={{ selected: active }}
            onPress={() => onChange(n)}
            style={[
              styles.scaleDot,
              { backgroundColor: active ? colors.accent : colors.surfaceHigh, borderColor: active ? colors.accent : colors.border },
            ]}
          >
            <Text style={[styles.scaleLabel, { color: active ? colors.accentText : colors.textMuted }]}>{n}</Text>
          </Pressable>
        );
      })}
    </Row>
  );
}

// ---------------------------------------------------------------------------
// Side-effect logger
// ---------------------------------------------------------------------------

const SEVERITY_ROW_TONE: SeverityTone = 'high';

function SideEffectLogger() {
  const sideEffectLogs = useAppStore((s) => s.sideEffectLogs);
  const logSideEffects = useAppStore((s) => s.logSideEffects);
  const removeSideEffect = useAppStore((s) => s.removeSideEffect);

  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [other, setOther] = useState('');
  // No default (P&S sign-off, THEA-9): the user picks a number, nothing is
  // pre-selected.
  const [severity, setSeverity] = useState<number | null>(null);
  const [note, setNote] = useState('');

  const chosenLabels = useMemo(() => {
    const labels = SIDE_EFFECT_OPTIONS.filter((o) => selected[o.id]).map((o) => o.label);
    const trimmed = other.trim();
    if (trimmed) labels.push(trimmed);
    return labels;
  }, [selected, other]);

  const canSave = chosenLabels.length > 0 && severity !== null;

  const toggle = (id: string) => setSelected((prev) => ({ ...prev, [id]: !prev[id] }));

  const save = () => {
    if (!canSave || severity === null) return;
    const date = today();
    logSideEffects(chosenLabels.map((label) => ({ date, label, severity, note: note.trim() || undefined })));
    setSelected({});
    setOther('');
    setSeverity(null);
    setNote('');
  };

  return (
    <View>
      <Section title="What did you feel?" gap={spacing.lg}>
        <View>
          <Small>Pick any that apply.</Small>
          <Spacer size={spacing.sm} />
          <Row gap={spacing.sm} wrap>
            {SIDE_EFFECT_OPTIONS.map((o) => {
              const active = Boolean(selected[o.id]);
              return (
                <Pressable
                  key={o.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => toggle(o.id)}
                  style={[
                    styles.symptomChip,
                    { backgroundColor: active ? colors.accentDim : colors.surfaceHigh, borderColor: active ? colors.accent : colors.border },
                  ]}
                >
                  <Text style={[typography.small, { color: active ? colors.accent : colors.text }]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </Row>
        </View>
        <View>
          <Caption color={colors.textFaint}>Something else (optional)</Caption>
          <Spacer size={spacing.xs} />
          <TextInput
            value={other}
            onChangeText={setOther}
            placeholder="Other symptom"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
          />
        </View>
      </Section>

      <Section title="How bad, overall?">
        <Small>1 is barely there, 10 is the worst you&apos;ve felt it. Pick a number — nothing is pre-selected.</Small>
        <Spacer size={spacing.sm} />
        <SeverityScale value={severity} onChange={setSeverity} />
      </Section>

      <Section title="Notes" gap={spacing.md}>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Context — timing, meals, dose changes (optional)"
          placeholderTextColor={colors.textFaint}
          style={[styles.input, styles.multiline]}
          multiline
        />
        <Button label="Log how you feel" onPress={save} disabled={!canSave} />
      </Section>

      <Section title="Reconstitution ratio">
        <ReconstitutionCalculator />
      </Section>

      <Section title="Recent side-effects" last>
        {sideEffectLogs.length === 0 ? (
          <Small>Symptoms you log will appear here.</Small>
        ) : (
          <List>
            {sideEffectLogs.slice(0, 30).map((log) => (
              <ListItem
                key={log.id}
                title={log.label}
                detail={`${formatShort(log.date)}${log.note ? ` · ${log.note}` : ''}`}
                tone={severityBand(log.severity) === 'severe' ? SEVERITY_ROW_TONE : undefined}
                meta={
                  <Row gap={spacing.md}>
                    <Data small color={colors.textMuted}>
                      {log.severity}/10
                    </Data>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${log.label} entry from ${formatShort(log.date)}`}
                      hitSlop={8}
                      onPress={() => removeSideEffect(log.id)}
                    >
                      <Text style={{ color: colors.textFaint, fontFamily: fonts.sans, fontSize: 15 }}>✕</Text>
                    </Pressable>
                  </Row>
                }
              />
            ))}
          </List>
        )}
      </Section>
    </View>
  );
}

/**
 * Peptide:water ratio calculator — an *instrument* surface under the THEA-6
 * no-dosage boundary (docs/pk-estimated-levels-spec.md §3.2, C1/C3). It only
 * does arithmetic on the numbers the user types, and spells out every
 * equivalent form with its unit. It never originates a dose.
 */
function ReconstitutionCalculator() {
  const [vialMg, setVialMg] = useState('');
  const [bacMl, setBacMl] = useState('');
  const [doseValue, setDoseValue] = useState('');
  const [doseUnit, setDoseUnit] = useState<'mcg' | 'mg'>('mcg');

  const vial = parseNumber(vialMg);
  const water = parseNumber(bacMl);
  const conc = vial > 0 && water > 0 ? concentration(vial, water) : null;

  const doseNum = parseNumber(doseValue);
  const recon = conc && doseNum > 0 ? reconstitute(vial, water, { value: doseNum, unit: doseUnit }) : null;

  return (
    <View>
      <Small>
        Enter what is in the vial and how much water you added. The app works out the concentration — you tell it the
        dose, it never tells you.
      </Small>
      <Spacer size={spacing.md} />
      <Row gap={spacing.sm} align="center">
        <View style={{ flex: 1 }}>
          <Caption color={colors.textFaint}>Peptide in vial (mg)</Caption>
          <Spacer size={spacing.xs} />
          <TextInput
            value={vialMg}
            onChangeText={setVialMg}
            keyboardType="decimal-pad"
            placeholder="e.g. 5"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Caption color={colors.textFaint}>Bac. water (mL)</Caption>
          <Spacer size={spacing.xs} />
          <TextInput
            value={bacMl}
            onChangeText={setBacMl}
            keyboardType="decimal-pad"
            placeholder="e.g. 2"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
          />
        </View>
      </Row>

      {conc ? (
        <Data style={{ marginTop: spacing.md }}>
          {vial} mg in {water} mL = {conc.mgPerMl} mg/mL = {conc.mcgPerUnit} mcg per unit
        </Data>
      ) : null}

      <Spacer size={spacing.md} />
      <Caption color={colors.textFaint}>Your dose (optional — to see units to draw)</Caption>
      <Spacer size={spacing.xs} />
      <Row gap={spacing.sm} align="center">
        <TextInput
          value={doseValue}
          onChangeText={setDoseValue}
          keyboardType="decimal-pad"
          placeholder="0"
          placeholderTextColor={colors.textFaint}
          style={[styles.input, { flex: 1 }]}
        />
        <Row gap={spacing.xs}>
          {(['mcg', 'mg'] as const).map((u) => {
            const active = u === doseUnit;
            return (
              <Pressable
                key={u}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setDoseUnit(u)}
                style={[
                  styles.unitPill,
                  { backgroundColor: active ? colors.accentDim : colors.surfaceHigh, borderColor: active ? colors.accent : colors.border },
                ]}
              >
                <Text style={[styles.unitLabel, { color: active ? colors.accent : colors.textMuted }]}>{u}</Text>
              </Pressable>
            );
          })}
        </Row>
      </Row>

      {recon ? (
        <View style={{ marginTop: spacing.md }}>
          <Data>
            {doseNum} {doseUnit} = {recon.unitsForDose} units to draw
          </Data>
          {recon.warning ? (
            <View style={{ marginTop: spacing.sm }}>
              <Callout tone="moderate">{recon.warning}</Callout>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  input: {
    backgroundColor: colors.surfaceHigh,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderBright,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md + 2,
    color: colors.text,
    ...typography.body,
  },
  multiline: {
    minHeight: 72,
    textAlignVertical: 'top',
  },
  unitPill: {
    minWidth: 44,
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  unitLabel: {
    fontFamily: fonts.sansMedium,
    fontSize: 13,
  },
  symptomChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderRadius: radius.pill,
  },
  scaleDot: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.md,
  },
  scaleLabel: {
    fontFamily: fonts.mono,
    fontSize: 14,
  },
});
