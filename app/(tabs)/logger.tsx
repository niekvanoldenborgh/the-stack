import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { getPeptide } from '../../src/domain/peptides';
import { SEVERITY_MAX, SEVERITY_MIN, SIDE_EFFECT_OPTIONS, severityBand } from '../../src/domain/sideEffects';
import type { Dose, DoseUnit, InjectionSite, Peptide, PeptideClass } from '../../src/domain/types';
import { concentration, formatDose, reconstitute } from '../../src/engine/dosing';
import { formatShort, today } from '../../src/lib/date';
import { useActiveStack, useAppStore } from '../../src/store/useAppStore';
import { BodyFigure, INJECTION_SITE_LABELS } from '../../src/ui/BodyFigure';
import {
  Button,
  Callout,
  Caption,
  Data,
  EmptyState,
  Row,
  Screen,
  Small,
  Spacer,
  TextField,
} from '../../src/ui/components';
import { BigNumberField, FloatingCTA, List, ListItem, Section, SheetHeader } from '../../src/ui/primitives';
import { Segmented } from '../../src/ui/schedule';
import { fonts, radius, spacing, useTheme, type SeverityTone, typography } from '../../src/ui/theme';

/**
 * Logger, redesigned THEA-40, rebuilt to pulse-design-spec-v2 §5 (THEA-69 v2).
 *
 * KIMI's reference frames this screen as a modal sheet with a close X, but
 * Logger stays a tab here rather than becoming a pushed sheet — that's a
 * navigation-structure change out of scope for this spec (§5.1). The
 * `SheetHeader` close button is kept anyway as a "done" affordance back to
 * Summary; it reads as intentional rather than a missing feature.
 *
 * The primary save action is now a `FloatingCTA` instead of an inline
 * `Button` inside the last section — `canSave`/`save` still live inside
 * `InjectionLogger`/`SideEffectLogger` (unchanged logic), and are surfaced up
 * to this screen's floating action via `onCtaChange` so the CTA can render
 * outside the scroll view (`Screen`'s `floatingAction` prop) while staying in
 * sync with whichever mode is active.
 *
 * None of the underlying logic changed: every safety comment below (no
 * default unit, no default severity, warn-never-block on an over-max dose)
 * is carried over verbatim from the pre-redesign screen.
 *
 * THEA-83: the Compound picker is a tile grid instead of search + text list.
 * Selection/dose/save logic is untouched — this only changes how a peptide
 * gets picked. Per-class glyph is Picasso's THEA-82 spec — see
 * `PEPTIDE_TILE_GLYPH` below.
 */

type Mode = 'injection' | 'side-effect';

const MODES: { key: Mode; label: string }[] = [
  { key: 'injection', label: 'Injection' },
  { key: 'side-effect', label: 'Side-effect' },
];

/** Units a user can log an injection in. `pct` is topical-only, so excluded. */
const DOSE_UNITS: DoseUnit[] = ['mcg', 'mg', 'iu'];

/**
 * Per-class recognition glyph for a Compound tile — Picasso's THEA-82 spec.
 * Monochrome Ionicons rather than emoji: emoji carry fixed multicolour fills
 * (7 of 14 obvious choices land on a reserved severity/status hue) and can't
 * invert to white on the selected purple fill. An icon inherits `color`
 * instead, so it's collision-proof by construction. Keyed by class rather
 * than by peptide so every compound is covered by data, not a hand-
 * maintained per-peptide list.
 */
const PEPTIDE_TILE_GLYPH: Record<PeptideClass, keyof typeof Ionicons.glyphMap> = {
  ghrh_analog: 'pulse',
  ghrp_secretagogue: 'notifications',
  growth_hormone: 'barbell',
  igf: 'trending-up',
  incretin: 'restaurant',
  amylin: 'hourglass',
  mitochondrial: 'battery-charging',
  healing_repair: 'bandage',
  thymic_immune: 'shield',
  melanocortin: 'sunny',
  bone_anabolic: 'body',
  cosmetic_topical: 'sparkles',
  sleep_neuro: 'moon',
  metabolic_oral: 'nutrition',
};

/** Defensive fallback so an unmapped future `PeptideClass` never crashes the tile. */
const DEFAULT_TILE_GLYPH: keyof typeof Ionicons.glyphMap = 'ellipse-outline';

function tileGlyph(p: Peptide): keyof typeof Ionicons.glyphMap {
  for (const cls of p.classes) {
    const glyph = PEPTIDE_TILE_GLYPH[cls];
    if (glyph) return glyph;
  }
  return DEFAULT_TILE_GLYPH;
}

interface CtaState {
  label: string;
  disabled: boolean;
  onPress: () => void;
}

function nowHHmm(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function parseNumber(text: string): number {
  return Number(text.replace(',', '.'));
}

export default function LoggerScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('injection');
  const [cta, setCta] = useState<CtaState | null>(null);

  return (
    <Screen
      floatingAction={
        cta ? <FloatingCTA label={cta.label} disabled={cta.disabled} onPress={cta.onPress} /> : null
      }
    >
      <Spacer size={spacing.md} />
      <SheetHeader title="Logger" onClose={() => router.push('/(tabs)')} closeLabel="Done" />
      <Small>
        Record what you actually did. Every number here is yours — the app never suggests a dose, it only does the
        arithmetic on what you type.
      </Small>
      <Spacer size={spacing.xl} />

      <Segmented
        options={MODES.map((m) => ({ value: m.key, label: m.label }))}
        value={mode}
        onChange={setMode}
        tone="ink"
        fill={false}
      />

      <Spacer size={spacing.xl} />

      {mode === 'injection' ? <InjectionLogger onCtaChange={setCta} /> : <SideEffectLogger onCtaChange={setCta} />}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Injection logger
// ---------------------------------------------------------------------------

function InjectionLogger({ onCtaChange }: { onCtaChange: (cta: CtaState) => void }) {
  const theme = useTheme();
  const { color } = theme;
  const router = useRouter();
  const injectionLogs = useAppStore((s) => s.injectionLogs);
  const logInjection = useAppStore((s) => s.logInjection);
  const removeInjection = useAppStore((s) => s.removeInjection);
  const activeStack = useActiveStack();

  const [peptideId, setPeptideId] = useState<string | null>(null);
  const [doseValue, setDoseValue] = useState('');
  // No default unit (P&S sign-off, THEA-9): the user picks every time, so a
  // stale pre-selection can never carry a mg/mcg mistake into the log.
  const [doseUnit, setDoseUnit] = useState<DoseUnit | null>(null);
  const [drawn, setDrawn] = useState('');
  const [time, setTime] = useState(nowHHmm());
  const [site, setSite] = useState<InjectionSite | null>(null);
  const [pain, setPain] = useState(0);
  const [note, setNote] = useState('');

  // THEA-50: log candidates are the active stack's compounds, not the whole
  // library — "why would you log something other than the stack you're on".
  // Selection/dose logic below (unit mismatch, over-max) is unchanged; this
  // only narrows which peptides can be picked.
  const stackPeptides = useMemo<Peptide[]>(() => {
    if (!activeStack) return [];
    const seen = new Set<string>();
    const list: Peptide[] = [];
    for (const item of activeStack.items) {
      if (seen.has(item.peptideId)) continue;
      const p = getPeptide(item.peptideId);
      if (p) {
        seen.add(item.peptideId);
        list.push(p);
      }
    }
    return list;
  }, [activeStack]);

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

  // Tiles are togglable (THEA-83): tapping the selected tile again clears the
  // selection, same as the old "Change" affordance; tapping another tile
  // switches straight to it.
  const toggleSelect = (id: string) => setPeptideId((prev) => (prev === id ? null : id));

  const reset = () => {
    setPeptideId(null);
    setDoseValue('');
    setDoseUnit(null);
    setDrawn('');
    setTime(nowHHmm());
    setSite(null);
    setPain(0);
    setNote('');
  };

  const save = useCallback(() => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSave, peptideId, site, doseUnit, doseNum, drawnNum, time, pain, note, logInjection]);

  useEffect(() => {
    onCtaChange({ label: 'Log injection', disabled: !canSave, onPress: save });
  }, [canSave, save, onCtaChange]);

  return (
    <View>
      {/* Compound ----------------------------------------------------------- */}
      <Section title="Compound">
        {stackPeptides.length === 0 ? (
          <EmptyState
            title="No active stack"
            body="Build a stack first — the logger only lists compounds you're actually running."
            action={<Button label="Build a stack" onPress={() => router.push('/builder')} />}
            illustration="noStack"
          />
        ) : (
          <View style={styles.tileGrid}>
            {stackPeptides.map((p) => {
              const active = p.id === peptideId;
              const glyph = tileGlyph(p);
              return (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={p.name}
                  accessibilityState={{ selected: active }}
                  onPress={() => toggleSelect(p.id)}
                  style={[
                    styles.tile,
                    { backgroundColor: active ? color.primary : color.surfaceMuted, borderColor: active ? color.primary : color.border },
                  ]}
                >
                  <Ionicons
                    name={glyph}
                    size={26}
                    color={active ? color.onPrimary : color.textPrimary}
                    accessibilityElementsHidden
                    importantForAccessibility="no"
                  />
                  <Text
                    style={[typography.small, styles.tileLabel, { color: active ? color.onPrimary : color.textPrimary }]}
                    numberOfLines={2}
                  >
                    {p.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Section>

      {/* Dose — user entered -------------------------------------------------- */}
      {selectedPeptide ? (
        <View style={{ marginBottom: spacing.xxl, gap: spacing.md }}>
          <BigNumberField
            label="Dose you injected"
            value={doseValue}
            onChangeText={setDoseValue}
            units={DOSE_UNITS}
            unit={doseUnit}
            onUnitChange={(u) => setDoseUnit(u as DoseUnit)}
          />
          {unitMismatch ? (
            <Callout tone="moderate">
              {`Double-check the unit — ${selectedPeptide.name} is normally dosed in ${
                selectedPeptide.dosing.unit === 'iu' ? 'IU' : selectedPeptide.dosing.unit
              }, and you picked ${doseUnit === 'iu' ? 'IU' : doseUnit}. Logged as entered either way.`}
            </Callout>
          ) : null}
          {overMax ? (
            <Callout tone="moderate">
              {`Above the published maximum for ${selectedPeptide.name}: ${selectedPeptide.dosing.hardMax} ${
                selectedPeptide.dosing.unit === 'iu' ? 'IU' : selectedPeptide.dosing.unit
              } (${selectedPeptide.sources[0] ?? 'compound reference'}). This is logged as entered — nothing here is blocked or corrected.`}
            </Callout>
          ) : null}
          <TextField
            label="Amount drawn (syringe units, optional)"
            value={drawn}
            onChangeText={setDrawn}
            keyboardType="decimal-pad"
            placeholder="e.g. 10"
          />
        </View>
      ) : null}

      {/* When & where --------------------------------------------------------- */}
      <Section title="When & where" gap={spacing.lg}>
        <Row justify="space-between" align="center">
          <Caption color={color.textSecondary}>Time</Caption>
          <TextField
            value={time}
            onChangeText={setTime}
            placeholder="HH:mm"
            style={{ width: 120 }}
          />
        </Row>

        <View>
          <Caption color={color.textSecondary}>Injection site</Caption>
          <Small style={{ marginTop: spacing.xs }}>Tap where you injected. Left and right are your own.</Small>
          <Spacer size={spacing.md} />
          <BodyFigure value={site} onChange={setSite} />
          {site ? (
            <View
              style={{
                alignSelf: 'center',
                marginTop: spacing.sm,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.xs,
                borderRadius: radius.pill,
                backgroundColor: color.primarySoft,
              }}
            >
              <Small muted={false} style={{ color: color.primary }}>
                {INJECTION_SITE_LABELS[site]}
              </Small>
            </View>
          ) : null}
        </View>

        <View>
          <Caption color={color.textSecondary}>Pain level</Caption>
          <Spacer size={spacing.sm} />
          <PainScale value={pain} onChange={setPain} />
        </View>
      </Section>

      {/* Notes ------------------------------------------------------------------ */}
      <Section title="Notes" gap={spacing.md}>
        <TextField
          value={note}
          onChangeText={setNote}
          placeholder="Anything worth remembering (optional)"
          multiline
        />
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
                      <Data small color={color.textSecondary}>
                        {formatDose(log.dose)}
                      </Data>
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Delete ${p?.name ?? log.peptideId} log from ${formatShort(log.date)}`}
                        hitSlop={8}
                        onPress={() => removeInjection(log.id)}
                      >
                        <Text style={{ color: color.textTertiary, fontFamily: fonts.medium, fontSize: 15 }}>✕</Text>
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

/** 0–10 self-reported injection pain as a tap scale — flattened, full-width
 *  equal-flex tiles (spec-v2 §5.5), no wrap. */
function PainScale({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const theme = useTheme();
  const { color } = theme;
  return (
    <Row gap={4}>
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
              styles.scaleTile,
              { backgroundColor: active ? color.primary : color.surfaceMuted },
            ]}
          >
            <Text style={[styles.scaleLabel, { color: active ? color.onPrimary : color.textSecondary }]}>{n}</Text>
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
  const theme = useTheme();
  const { color } = theme;
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
              { backgroundColor: active ? color.primary : color.surfaceMuted, borderColor: active ? color.primary : color.border },
            ]}
          >
            <Text style={[styles.scaleLabel, { color: active ? color.onPrimary : color.textSecondary }]}>{n}</Text>
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

function SideEffectLogger({ onCtaChange }: { onCtaChange: (cta: CtaState) => void }) {
  const theme = useTheme();
  const { color } = theme;
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

  const save = useCallback(() => {
    if (!canSave || severity === null) return;
    const date = today();
    logSideEffects(chosenLabels.map((label) => ({ date, label, severity, note: note.trim() || undefined })));
    setSelected({});
    setOther('');
    setSeverity(null);
    setNote('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canSave, severity, chosenLabels, note, logSideEffects]);

  useEffect(() => {
    onCtaChange({ label: 'Log how you feel', disabled: !canSave, onPress: save });
  }, [canSave, save, onCtaChange]);

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
                    { backgroundColor: active ? color.primarySoft : color.surfaceMuted, borderColor: active ? color.primary : color.border },
                  ]}
                >
                  <Text style={[typography.small, { color: active ? color.primary : color.textPrimary }]}>{o.label}</Text>
                </Pressable>
              );
            })}
          </Row>
        </View>
        <TextField
          label="Something else (optional)"
          value={other}
          onChangeText={setOther}
          placeholder="Other symptom"
        />
      </Section>

      <Section title="How bad, overall?">
        <Small>1 is barely there, 10 is the worst you&apos;ve felt it. Pick a number — nothing is pre-selected.</Small>
        <Spacer size={spacing.sm} />
        <SeverityScale value={severity} onChange={setSeverity} />
      </Section>

      <Section title="Notes" gap={spacing.md}>
        <TextField
          value={note}
          onChangeText={setNote}
          placeholder="Context — timing, meals, dose changes (optional)"
          multiline
        />
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
                    <Data small color={color.textSecondary}>
                      {log.severity}/10
                    </Data>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Delete ${log.label} entry from ${formatShort(log.date)}`}
                      hitSlop={8}
                      onPress={() => removeSideEffect(log.id)}
                    >
                      <Text style={{ color: color.textTertiary, fontFamily: fonts.medium, fontSize: 15 }}>✕</Text>
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
  const theme = useTheme();
  const { color } = theme;
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
        <TextField
          label="Peptide in vial (mg)"
          value={vialMg}
          onChangeText={setVialMg}
          keyboardType="decimal-pad"
          placeholder="e.g. 5"
          style={{ flex: 1 }}
        />
        <TextField
          label="Bac. water (mL)"
          value={bacMl}
          onChangeText={setBacMl}
          keyboardType="decimal-pad"
          placeholder="e.g. 2"
          style={{ flex: 1 }}
        />
      </Row>

      {conc ? (
        <Data style={{ marginTop: spacing.md }}>
          {vial} mg in {water} mL = {conc.mgPerMl} mg/mL = {conc.mcgPerUnit} mcg per unit
        </Data>
      ) : null}

      <Spacer size={spacing.md} />
      <Caption color={color.textTertiary}>Your dose (optional — to see units to draw)</Caption>
      <Spacer size={spacing.xs} />
      <Row gap={spacing.sm} align="center">
        <TextField
          value={doseValue}
          onChangeText={setDoseValue}
          keyboardType="decimal-pad"
          placeholder="0"
          style={{ flex: 1 }}
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
                  { backgroundColor: active ? color.primarySoft : color.surfaceMuted, borderColor: active ? color.primary : color.border },
                ]}
              >
                <Text style={[styles.unitLabel, { color: active ? color.primary : color.textSecondary }]}>{u}</Text>
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
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  tile: {
    flexBasis: '30%',
    flexGrow: 1,
    minWidth: 96,
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderWidth: 1,
    borderRadius: radius.md,
  },
  tileLabel: {
    fontFamily: fonts.medium,
    textAlign: 'center',
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
    fontFamily: fonts.medium,
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
  scaleTile: {
    flex: 1,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  scaleLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
  },
});
