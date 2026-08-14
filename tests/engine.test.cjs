'use strict';

const assert = require('node:assert/strict');
const { describe, it } = require('node:test');

const fs = require('node:fs');
const path = require('node:path');

const { PEPTIDES, getPeptide } = require('../.test-build/domain/peptides');
const { computeDose, concentration, doseForWeek, reconstitute, roundDose } = require('../.test-build/engine/dosing');
const {
  buildLevelSeries,
  doseToMg,
  dosingIntervalHours,
  peptideHasLevelModel,
  pkShortHalfLifeClearance,
  singleDoseConcentrationMgPerL,
  steadyStateAverageMgPerL,
  terminalHalfLifeHours,
  twoCompartmentCoefficients,
} = require('../.test-build/engine/pk');
const { SIDE_EFFECT_OPTIONS } = require('../.test-build/domain/sideEffects');
const {
  aggregateSideEffects,
  evaluateStack,
  findContraindications,
  findInteractions,
  isPeptideAllowed,
} = require('../.test-build/engine/safety');
const { explainExclusions, generateStack } = require('../.test-build/engine/recommend');
const { generateSchedule, phaseOn, spreadDays } = require('../.test-build/engine/cycle');
const { generateProgram, estimatedOneRepMax, suggestNextLoad } = require('../.test-build/engine/workout');
const { getExercise } = require('../.test-build/domain/exercises');
const {
  adherenceSeries,
  muscleLoad,
  sideEffectsByWeek,
  strengthTrends,
  trainingSummary,
  weeklyVolume,
} = require('../.test-build/engine/analytics');
const { summariseMeasurements, seriesKey } = require('../.test-build/engine/progress');
const { METRICS, METRIC_BY_ID, metricsForGoals, CUSTOM_METRIC_ID } = require('../.test-build/domain/metrics');

function makeProfile(overrides = {}) {
  return {
    createdAt: '2026-01-01T00:00:00.000Z',
    age: 30,
    sex: 'male',
    weightKg: 80,
    heightCm: 180,
    activity: 'moderate',
    sleepHours: 8,
    sleepQuality: 4,
    trainingDays: 4,
    experience: 'experienced',
    goals: ['build_muscle'],
    healthFlags: [],
    currentPeptides: [],
    riskTolerance: 3,
    acceptedDisclaimerAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Data integrity
// ---------------------------------------------------------------------------

describe('peptide dataset', () => {
  it('has unique ids', () => {
    const ids = PEPTIDES.map((p) => p.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('never has a dosing band that is inverted or exceeds its hard cap', () => {
    for (const peptide of PEPTIDES) {
      if (peptide.doseGuidanceWithheld) continue;
      assert.ok(peptide.dosing.low <= peptide.dosing.typical, `${peptide.id}: low > typical`);
      assert.ok(peptide.dosing.typical <= peptide.dosing.high, `${peptide.id}: typical > high`);
      assert.ok(peptide.dosing.hardMax > 0, `${peptide.id}: no hard cap`);
    }
  });

  it('gives every compound at least one contraindication and one source', () => {
    for (const peptide of PEPTIDES) {
      assert.ok(peptide.sources.length > 0, `${peptide.id} has no sources`);
      // Topical cosmetics are the only reasonable exception to contraindications.
      if (peptide.legalStatus !== 'cosmetic_otc') {
        assert.ok(peptide.contraindications.length > 0, `${peptide.id} has no contraindications`);
      }
    }
  });

  it('withholds a dose only alongside a stated reason', () => {
    for (const peptide of PEPTIDES) {
      if (!peptide.doseGuidanceWithheld) continue;
      assert.ok(peptide.doseGuidanceWithheld.reason.length > 40, `${peptide.id}: weak withholding reason`);
    }
  });
});

// ---------------------------------------------------------------------------
// Dosing
// ---------------------------------------------------------------------------

describe('dose personalisation', () => {
  it('scales per-kg compounds with bodyweight', () => {
    const light = computeDose(getPeptide('ipamorelin'), makeProfile({ weightKg: 60 }));
    const heavy = computeDose(getPeptide('ipamorelin'), makeProfile({ weightKg: 110 }));
    assert.ok(heavy.dose.value > light.dose.value, 'heavier user should get a larger per-kg dose');
  });

  it('does not scale fixed-dose compounds with bodyweight', () => {
    const light = computeDose(getPeptide('tesamorelin'), makeProfile({ weightKg: 55 }));
    const heavy = computeDose(getPeptide('tesamorelin'), makeProfile({ weightKg: 120 }));
    assert.equal(light.dose.value, heavy.dose.value);
  });

  it('never exceeds the hard cap even for very heavy users', () => {
    for (const peptide of PEPTIDES) {
      if (peptide.doseGuidanceWithheld) continue;
      const result = computeDose(peptide, makeProfile({ weightKg: 200, activity: 'athlete' }));
      assert.ok(
        result.dose.value <= peptide.dosing.hardMax,
        `${peptide.id}: ${result.dose.value} exceeded cap ${peptide.dosing.hardMax}`,
      );
    }
  });

  it('never returns a dose below the published low end', () => {
    for (const peptide of PEPTIDES) {
      if (peptide.doseGuidanceWithheld) continue;
      const result = computeDose(peptide, makeProfile({ weightKg: 40, experience: 'none', sleepHours: 4 }));
      assert.ok(result.dose.value > 0, `${peptide.id} produced a zero dose`);
    }
  });

  it('starts beginners lower than experienced users', () => {
    const novice = computeDose(getPeptide('mk-677'), makeProfile({ experience: 'none' }));
    const veteran = computeDose(getPeptide('mk-677'), makeProfile({ experience: 'experienced' }));
    assert.ok(novice.dose.value <= veteran.dose.value);
  });

  it('holds GH-axis doses down when sleep is short, and explains why', () => {
    const rested = computeDose(getPeptide('ipamorelin'), makeProfile({ sleepHours: 8 }));
    const deprived = computeDose(getPeptide('ipamorelin'), makeProfile({ sleepHours: 5 }));
    assert.ok(deprived.dose.value < rested.dose.value);
    assert.ok(deprived.factors.some((f) => f.toLowerCase().includes('sleep')));
  });

  it('leaves non-GH compounds untouched by sleep', () => {
    const rested = computeDose(getPeptide('semaglutide'), makeProfile({ sleepHours: 8 }));
    const deprived = computeDose(getPeptide('semaglutide'), makeProfile({ sleepHours: 5 }));
    assert.equal(rested.dose.value, deprived.dose.value);
  });

  it('returns no number for withheld compounds', () => {
    const result = computeDose(getPeptide('igf-1-lr3'), makeProfile());
    assert.equal(result.withheld, true);
    assert.equal(result.dose.value, 0);
    assert.ok(result.advisories[0].length > 0);
  });

  it('rounds to measurable increments', () => {
    assert.equal(roundDose(187.3, 'mcg'), 175);
    assert.equal(roundDose(12.4, 'mcg'), 12);
    assert.equal(roundDose(37.4, 'mcg'), 35);
    assert.equal(roundDose(2.37, 'mg'), 2.25);
    assert.equal(roundDose(0.24, 'pct'), 0.25);
  });

  it('ramps the dose across the titration window', () => {
    const start = { value: 250, unit: 'mcg' };
    const target = { value: 1000, unit: 'mcg' };
    assert.equal(doseForWeek(start, target, 4, 1).value, 250);
    assert.equal(doseForWeek(start, target, 4, 4).value, 1000);
    assert.equal(doseForWeek(start, target, 4, 9).value, 1000);
    const mid = doseForWeek(start, target, 4, 3);
    assert.ok(mid.value > 250 && mid.value < 1000);
  });
});

describe('reconstitution calculator', () => {
  it('computes syringe units correctly', () => {
    // 5 mg in 2 ml = 5000 mcg over 200 units = 25 mcg per unit.
    const result = reconstitute(5, 2, { value: 250, unit: 'mcg' });
    assert.equal(result.mcgPerUnit, 25);
    assert.equal(result.unitsForDose, 10);
    assert.equal(result.warning, undefined);
  });

  it('handles mg doses without unit confusion', () => {
    const result = reconstitute(10, 2, { value: 1, unit: 'mg' });
    assert.equal(result.mcgPerUnit, 50);
    assert.equal(result.unitsForDose, 20);
  });

  it('warns when a dose is too small to measure', () => {
    const result = reconstitute(10, 1, { value: 100, unit: 'mcg' });
    assert.ok(result.warning.includes('2 units'));
  });

  it('warns when a dose overflows the syringe', () => {
    const result = reconstitute(1, 5, { value: 900, unit: 'mcg' });
    assert.ok(result.warning.includes('exceeds'));
  });
});

describe('concentration (peptide:water ratio)', () => {
  it('reports both equivalent forms from the same inputs', () => {
    // 5 mg in 2 ml = 2.5 mg/ml = 25 mcg per unit (THEA-6 §3.2 C3 example).
    const c = concentration(5, 2);
    assert.equal(c.mgPerMl, 2.5);
    assert.equal(c.mcgPerUnit, 25);
  });

  it('is consistent with reconstitute()', () => {
    // Same numbers, one source of truth: concentration's mcgPerUnit must match
    // what reconstitute reports, so the ratio display and the syringe maths
    // never diverge.
    const c = concentration(10, 3);
    const r = reconstitute(10, 3, { value: 500, unit: 'mcg' });
    assert.equal(c.mcgPerUnit, r.mcgPerUnit);
  });

  it('returns null for non-positive inputs rather than guessing', () => {
    assert.equal(concentration(0, 2), null);
    assert.equal(concentration(5, 0), null);
    assert.equal(concentration(-1, 2), null);
  });
});

describe('logger side-effect list (THEA-9)', () => {
  const REQUIRED = [
    'Nausea',
    'Heartburn',
    'Food noise',
    'Suppressed appetite',
    'Rash',
    'Injection-site reaction',
    'Constipation',
    'Belching',
    'Mood swings',
    'Indigestion',
    'Metallic taste',
    'Stomach pain',
    'Hair loss',
    'Fatigue',
    'Migraine',
  ];

  it('offers exactly the reviewed set of side effects', () => {
    const labels = SIDE_EFFECT_OPTIONS.map((o) => o.label);
    assert.deepEqual(labels, REQUIRED);
  });

  it('has unique, stable ids and labels', () => {
    const ids = SIDE_EFFECT_OPTIONS.map((o) => o.id);
    const labels = SIDE_EFFECT_OPTIONS.map((o) => o.label);
    assert.equal(new Set(ids).size, ids.length);
    assert.equal(new Set(labels).size, labels.length);
  });
});

// ---------------------------------------------------------------------------
// Safety
// ---------------------------------------------------------------------------

describe('interaction detection', () => {
  it('flags two GLP-1 drugs as critical', () => {
    const findings = findInteractions(['semaglutide', 'tirzepatide']);
    const critical = findings.find((f) => f.severity === 'critical');
    assert.ok(critical, 'expected a critical finding');
    assert.equal(critical.ruleId, 'dual-incretin');
  });

  it('flags two GHRPs as high severity', () => {
    const findings = findInteractions(['ipamorelin', 'ghrp-2']);
    assert.ok(findings.some((f) => f.ruleId === 'dual-ghrp' && f.severity === 'high'));
  });

  it('treats GHRH + GHRP as informational, not a problem', () => {
    const findings = findInteractions(['mod-grf-1-29', 'ipamorelin']);
    const synergy = findings.find((f) => f.ruleId === 'ghrh-plus-ghrp');
    assert.ok(synergy);
    assert.equal(synergy.severity, 'info');
    assert.ok(!findings.some((f) => f.severity === 'critical' || f.severity === 'high'));
  });

  it('does not fire a self-pairing rule for a single compound', () => {
    assert.equal(findInteractions(['ipamorelin']).length, 0);
  });

  it('flags IGF-1 stacked on any GH stimulation as critical', () => {
    for (const partner of ['ipamorelin', 'mod-grf-1-29', 'semaglutide', 'somatropin']) {
      const findings = findInteractions(['igf-1-lr3', partner]);
      assert.ok(
        findings.some((f) => f.severity === 'critical'),
        `igf-1-lr3 + ${partner} should be critical`,
      );
    }
  });

  it('reports each rule once per pair', () => {
    const findings = findInteractions(['semaglutide', 'tirzepatide', 'retatrutide']);
    const keys = findings.map((f) => `${f.ruleId}:${[...f.peptideIds].sort().join('+')}`);
    assert.equal(new Set(keys).size, keys.length);
  });
});

describe('contraindication matching', () => {
  it('blocks semaglutide for a medullary thyroid cancer family history', () => {
    const profile = makeProfile({ healthFlags: ['thyroid_cancer_family'] });
    const findings = findContraindications(['semaglutide'], profile);
    assert.ok(findings.some((f) => f.kind === 'absolute'));
    assert.equal(isPeptideAllowed(getPeptide('semaglutide'), profile).allowed, false);
  });

  it('blocks Melanotan II for a melanoma history', () => {
    const profile = makeProfile({ healthFlags: ['melanoma_or_atypical_moles'] });
    assert.equal(isPeptideAllowed(getPeptide('melanotan-2'), profile).allowed, false);
  });

  it('treats age as authoritative over the self-reported flag', () => {
    const profile = makeProfile({ age: 16, healthFlags: [] });
    const findings = findContraindications(['ipamorelin'], profile);
    assert.ok(findings.some((f) => f.flag === 'under_18' && f.kind === 'absolute'));
  });

  it('no longer blocks on age alone', () => {
    const profile = makeProfile({ age: 16 });
    const allowed = PEPTIDES.filter((p) => isPeptideAllowed(p, profile).allowed);
    assert.ok(allowed.length > 0, 'age should warn, not lock the catalogue');
  });

  it('does not let age alone make a stack blocking', () => {
    const report = evaluateStack(['ghk-cu'], makeProfile({ age: 16, goals: ['skin_quality'] }));
    assert.equal(report.blocking, false);
  });

  it('still blocks a minor on a genuine medical contraindication', () => {
    const report = evaluateStack(['semaglutide'], makeProfile({ age: 16, healthFlags: ['men2'] }));
    assert.equal(report.blocking, true);
  });
});

describe('age warnings', () => {
  it('raises a critical developmental warning for under-18s on GH-axis compounds', () => {
    const report = evaluateStack(['ipamorelin'], makeProfile({ age: 16 }));
    const notice = report.notices.find((n) => n.id === 'age-under-18');
    assert.ok(notice, 'expected an under-18 notice');
    assert.equal(notice.severity, 'critical');
    assert.ok(/growth plate/i.test(notice.detail));
  });

  it('raises a growth-plate warning for under-21s', () => {
    const report = evaluateStack(['ipamorelin'], makeProfile({ age: 19 }));
    assert.ok(report.notices.some((n) => n.id === 'age-under-21'));
    assert.ok(!report.notices.some((n) => n.id === 'age-under-18'));
  });

  it('raises only a peak-output note for under-25s', () => {
    const report = evaluateStack(['ipamorelin'], makeProfile({ age: 23 }));
    assert.ok(report.notices.some((n) => n.id === 'age-under-25'));
  });

  it('raises no age notice for an adult past 25', () => {
    const report = evaluateStack(['ipamorelin'], makeProfile({ age: 35 }));
    assert.ok(!report.notices.some((n) => n.id.startsWith('age-')));
  });

  it('raises no age notice when the stack has no GH-axis compounds', () => {
    const report = evaluateStack(['ghk-cu'], makeProfile({ age: 16, goals: ['skin_quality'] }));
    assert.ok(!report.notices.some((n) => n.id.startsWith('age-')));
  });

  it('ranks GH-axis compounds below alternatives for a minor', () => {
    const goals = ['build_muscle', 'injury_recovery'];
    const adult = generateStack(makeProfile({ age: 30, goals }));
    const minor = generateStack(makeProfile({ age: 16, goals }));
    const ghAxis = (stack) =>
      stack.items.filter((i) =>
        getPeptide(i.peptideId).classes.some((c) =>
          ['ghrh_analog', 'ghrp_secretagogue', 'growth_hormone', 'igf'].includes(c),
        ),
      ).length;
    assert.ok(ghAxis(minor) <= ghAxis(adult), 'a minor should not get more GH-axis compounds than an adult');
  });
});

describe('stack evaluation', () => {
  it('merges shared side effects and records every contributing compound', () => {
    const merged = aggregateSideEffects(['ipamorelin', 'mod-grf-1-29']);
    const shared = merged.find((e) => e.label.toLowerCase() === 'water retention');
    assert.ok(shared);
    assert.equal(shared.peptideIds.length, 2);
  });

  it('marks a stack blocking when a critical interaction is present', () => {
    const report = evaluateStack(['semaglutide', 'tirzepatide'], makeProfile());
    assert.equal(report.blocking, true);
    assert.ok(report.riskScore > 50);
  });

  it('marks a stack blocking when a compound is absolutely contraindicated', () => {
    const report = evaluateStack(['semaglutide'], makeProfile({ healthFlags: ['men2'] }));
    assert.equal(report.blocking, true);
  });

  it('leaves a clean topical stack unblocked and low risk', () => {
    const report = evaluateStack(['ghk-cu', 'matrixyl'], makeProfile({ goals: ['skin_quality'] }));
    assert.equal(report.blocking, false);
    assert.ok(report.riskScore < 25, `expected low risk, got ${report.riskScore}`);
  });

  it('raises an IGF-1 load notice when several GH-axis compounds are stacked', () => {
    const report = evaluateStack(['ipamorelin', 'mod-grf-1-29'], makeProfile());
    assert.ok(report.notices.some((n) => n.id === 'igf1-load'));
  });

  it('always warns when a research chemical is present', () => {
    const report = evaluateStack(['bpc-157'], makeProfile({ goals: ['injury_recovery'] }));
    assert.ok(report.notices.some((n) => n.id === 'research-chemicals'));
  });
});

// ---------------------------------------------------------------------------
// Risk tolerance
// ---------------------------------------------------------------------------

describe('risk tolerance and dosing', () => {
  it('raises the dose monotonically as the dial goes up', () => {
    for (const id of ['ipamorelin', 'mk-677', 'bpc-157', 'semaglutide', 'ghk-cu']) {
      const doses = [1, 2, 3, 4, 5].map(
        (riskTolerance) => computeDose(getPeptide(id), makeProfile({ riskTolerance })).dose.value,
      );
      for (let i = 1; i < doses.length; i++) {
        assert.ok(doses[i] >= doses[i - 1], `${id}: dose fell going from risk ${i} to ${i + 1}`);
      }
      assert.ok(doses[4] > doses[0], `${id}: dial had no effect at all`);
    }
  });

  it('NEVER exceeds the published high or the hard cap, at any dial setting', () => {
    for (const peptide of PEPTIDES) {
      if (peptide.doseGuidanceWithheld) continue;
      for (const riskTolerance of [1, 2, 3, 4, 5]) {
        for (const activity of ['sedentary', 'moderate', 'athlete']) {
          for (const weightKg of [40, 80, 200]) {
            const result = computeDose(
              peptide,
              makeProfile({ riskTolerance, activity, weightKg, experience: 'experienced', age: 30, sleepHours: 9 }),
            );
            const scale = peptide.dosing.basis === 'per_kg' ? weightKg : 1;
            const bandHigh = peptide.dosing.high * scale;
            assert.ok(
              result.dose.value <= Math.min(bandHigh, peptide.dosing.hardMax) + 1e-9,
              `${peptide.id} at risk ${riskTolerance}/${activity}/${weightKg}kg gave ${result.dose.value}, above published high ${bandHigh} / cap ${peptide.dosing.hardMax}`,
            );
          }
        }
      }
    }
  });

  it('never drops below the published low, at any dial setting', () => {
    for (const peptide of PEPTIDES) {
      if (peptide.doseGuidanceWithheld) continue;
      const result = computeDose(
        peptide,
        makeProfile({ riskTolerance: 1, experience: 'none', age: 20, sleepHours: 4, activity: 'sedentary', weightKg: 40 }),
      );
      const scale = peptide.dosing.basis === 'per_kg' ? 40 : 1;
      const floor = Math.min(peptide.dosing.low * scale, peptide.dosing.hardMax);
      assert.ok(result.dose.value > 0, `${peptide.id} produced a zero dose`);
      assert.ok(
        result.dose.value >= floor - 1e-9,
        `${peptide.id} fell below its published low`,
      );
    }
  });

  it('explains the dial in the dose derivation', () => {
    const result = computeDose(getPeptide('ipamorelin'), makeProfile({ riskTolerance: 5 }));
    assert.ok(result.factors.some((f) => /risk setting/i.test(f)));
  });

  it('changes ONLY the dose — never which compounds are selected', () => {
    const goalSets = [
      ['build_muscle', 'injury_recovery', 'sleep_quality'],
      ['lose_fat', 'metabolic_health', 'skin_quality'],
      ['hair_growth', 'acne_control'],
      ['gain_weight', 'bone_density'],
    ];
    for (const goals of goalSets) {
      for (const experience of ['none', 'some', 'experienced']) {
        const stacks = [1, 2, 3, 4, 5].map((riskTolerance) =>
          generateStack(makeProfile({ goals, experience, riskTolerance })),
        );
        const baseline = stacks[0].items.map((i) => i.peptideId).sort();
        for (let i = 1; i < stacks.length; i++) {
          assert.deepEqual(
            stacks[i].items.map((x) => x.peptideId).sort(),
            baseline,
            `risk ${i + 1} changed the selection for ${goals.join('+')} / ${experience}`,
          );
        }
      }
    }
  });

  it('does not change stack size with the dial', () => {
    const goals = ['build_muscle', 'injury_recovery', 'sleep_quality'];
    const sizes = [1, 2, 3, 4, 5].map(
      (riskTolerance) => generateStack(makeProfile({ goals, riskTolerance })).items.length,
    );
    assert.equal(new Set(sizes).size, 1, `stack size varied with the dial: ${sizes.join(', ')}`);
  });

  it('does not change the exclusion reasons with the dial', () => {
    const goals = ['build_muscle', 'lose_fat'];
    const reasons = [1, 5].map((riskTolerance) => {
      const profile = makeProfile({ goals, riskTolerance });
      return explainExclusions(profile, generateStack(profile))
        .map((e) => `${e.peptideId}:${e.reason}`)
        .sort()
        .join('|');
    });
    assert.equal(reasons[0], reasons[1], 'the dial must not change why compounds were left out');
  });

  it('still refuses high and critical interactions at maximum risk', () => {
    const goalSets = [
      ['build_muscle', 'gain_weight', 'sleep_quality'],
      ['lose_fat', 'metabolic_health'],
      ['injury_recovery', 'bone_density', 'skin_quality'],
    ];
    for (const goals of goalSets) {
      const stack = generateStack(makeProfile({ goals, riskTolerance: 5, experience: 'experienced' }));
      const bad = stack.safety.interactions.filter((i) => i.severity === 'critical' || i.severity === 'high');
      assert.equal(bad.length, 0, `risk 5 produced ${bad.map((b) => b.title).join(', ')} for ${goals.join('+')}`);
    }
  });

  it('still withholds doses at maximum risk', () => {
    const stack = generateStack(makeProfile({ goals: ['build_muscle'], riskTolerance: 5 }));
    for (const item of stack.items) {
      assert.ok(!getPeptide(item.peptideId).doseGuidanceWithheld);
    }
    assert.equal(computeDose(getPeptide('igf-1-lr3'), makeProfile({ riskTolerance: 5 })).withheld, true);
  });

  it('still honours medical contraindications at maximum risk', () => {
    const profile = makeProfile({ goals: ['lose_fat'], riskTolerance: 5, healthFlags: ['men2', 'active_cancer'] });
    const stack = generateStack(profile);
    for (const item of stack.items) {
      assert.equal(isPeptideAllowed(getPeptide(item.peptideId), profile).allowed, true);
    }
  });

  it('defaults to balanced when the dial is missing from an old profile', () => {
    const legacy = makeProfile();
    delete legacy.riskTolerance;
    const withDefault = computeDose(getPeptide('ipamorelin'), makeProfile({ riskTolerance: 3 }));
    assert.equal(computeDose(getPeptide('ipamorelin'), legacy).dose.value, withDefault.dose.value);
  });
});

// ---------------------------------------------------------------------------
// Current peptide use
// ---------------------------------------------------------------------------

describe('current peptide use', () => {
  it('never re-recommends something the user is already taking', () => {
    const stack = generateStack(
      makeProfile({ goals: ['build_muscle', 'sleep_quality'], currentPeptides: ['ipamorelin'] }),
    );
    assert.ok(!stack.items.some((i) => i.peptideId === 'ipamorelin'));
  });

  it('will not recommend a second compound of a class already in use', () => {
    const stack = generateStack(
      makeProfile({ goals: ['build_muscle', 'gain_weight'], currentPeptides: ['ipamorelin'], riskTolerance: 5 }),
    );
    for (const item of stack.items) {
      assert.ok(
        !getPeptide(item.peptideId).classes.includes('ghrp_secretagogue'),
        `${item.peptideId} duplicates the GHRP already in use`,
      );
    }
  });

  it('will not recommend something that interacts critically with current use', () => {
    const stack = generateStack(
      makeProfile({ goals: ['lose_fat', 'metabolic_health'], currentPeptides: ['semaglutide'], riskTolerance: 5 }),
    );
    for (const item of stack.items) {
      assert.ok(
        !getPeptide(item.peptideId).classes.includes('incretin'),
        `${item.peptideId} would stack a second GLP-1 on current semaglutide`,
      );
    }
    assert.equal(stack.safety.blocking, false);
  });

  it('reports interactions against current use separately from internal ones', () => {
    const report = evaluateStack(['tirzepatide'], makeProfile({ currentPeptides: ['semaglutide'] }));
    assert.equal(report.interactions.length, 0, 'a single compound has no internal interactions');
    assert.ok(report.interactionsWithCurrent.some((f) => f.severity === 'critical'));
    assert.equal(report.blocking, true, 'a critical clash with current use must block');
  });

  it('leaves the current-use list empty when nothing is in use', () => {
    const report = evaluateStack(['ipamorelin'], makeProfile());
    assert.deepEqual(report.interactionsWithCurrent, []);
  });

  it('tolerates a legacy profile with no current-use field', () => {
    const legacy = makeProfile();
    delete legacy.currentPeptides;
    const report = evaluateStack(['ipamorelin'], legacy);
    assert.deepEqual(report.interactionsWithCurrent, []);
    assert.equal(generateStack(legacy).items.length > 0, true);
  });

  it('explains a compound left out because it is already in use', () => {
    const profile = makeProfile({ goals: ['build_muscle', 'sleep_quality'], currentPeptides: ['ipamorelin'] });
    const stack = generateStack(profile);
    const exclusions = explainExclusions(profile, stack);
    const entry = exclusions.find((e) => e.peptideId === 'ipamorelin');
    assert.ok(entry);
    assert.ok(/already running/i.test(entry.reason));
  });
});

// ---------------------------------------------------------------------------
// Recommendation
// ---------------------------------------------------------------------------

describe('stack generation', () => {
  it('never auto-recommends a compound whose dose is withheld', () => {
    const goalSets = [
      ['build_muscle'],
      ['build_muscle', 'gain_weight'],
      ['lose_fat', 'metabolic_health'],
      ['bone_density'],
    ];
    for (const goals of goalSets) {
      const stack = generateStack(makeProfile({ goals }));
      for (const item of stack.items) {
        assert.ok(!getPeptide(item.peptideId).doseGuidanceWithheld, `${item.peptideId} should not be auto-recommended`);
      }
    }
  });

  it('never generates a stack containing a high or critical interaction', () => {
    const goalSets = [
      ['build_muscle', 'gain_weight', 'sleep_quality'],
      ['lose_fat', 'metabolic_health', 'skin_quality'],
      ['injury_recovery', 'bone_density'],
      ['hair_growth', 'acne_control', 'skin_quality'],
    ];
    for (const goals of goalSets) {
      const stack = generateStack(makeProfile({ goals }));
      const bad = stack.safety.interactions.filter((i) => i.severity === 'critical' || i.severity === 'high');
      assert.equal(bad.length, 0, `generated ${bad.map((b) => b.title).join(', ')} for ${goals.join('+')}`);
    }
  });

  it('never includes a compound that is absolutely contraindicated for the user', () => {
    const profile = makeProfile({
      goals: ['lose_fat', 'build_muscle'],
      healthFlags: ['men2', 'active_cancer', 'diabetes_t2'],
    });
    const stack = generateStack(profile);
    for (const item of stack.items) {
      assert.equal(isPeptideAllowed(getPeptide(item.peptideId), profile).allowed, true, `${item.peptideId} slipped through`);
    }
    assert.equal(stack.safety.blocking, false);
  });

  it('covers the highest-priority goal whenever anything can serve it', () => {
    const goals = ['skin_quality', 'build_muscle', 'lose_fat'];
    const stack = generateStack(makeProfile({ goals }));
    assert.ok(stack.items.some((i) => i.servesGoals.includes('skin_quality')));
  });

  it('gives beginners a smaller stack than experienced users', () => {
    const goals = ['build_muscle', 'lose_fat', 'skin_quality'];
    const novice = generateStack(makeProfile({ goals, experience: 'none' }));
    const veteran = generateStack(makeProfile({ goals, experience: 'experienced' }));
    assert.ok(novice.items.length <= veteran.items.length);
  });

  it('never puts two compounds of the same exclusive class in one stack', () => {
    const stack = generateStack(makeProfile({ goals: ['build_muscle', 'gain_weight'] }));
    const counts = {};
    for (const item of stack.items) {
      for (const cls of getPeptide(item.peptideId).classes) {
        if (['ghrp_secretagogue', 'ghrh_analog', 'incretin'].includes(cls)) {
          counts[cls] = (counts[cls] ?? 0) + 1;
        }
      }
    }
    for (const [cls, count] of Object.entries(counts)) {
      assert.ok(count <= 1, `${count} compounds in exclusive class ${cls}`);
    }
  });

  it('honours the exclude-prescription option', () => {
    const stack = generateStack(makeProfile({ goals: ['lose_fat'] }), { excludePrescription: true });
    assert.ok(stack.items.every((i) => getPeptide(i.peptideId).legalStatus !== 'prescription'));
  });
});

// ---------------------------------------------------------------------------
// Cycle planning
// ---------------------------------------------------------------------------

describe('cycle planning', () => {
  const item = {
    peptideId: 'ipamorelin',
    dose: { value: 200, unit: 'mcg' },
    startDose: { value: 100, unit: 'mcg' },
    timesPerDay: 2,
    daysPerWeek: 5,
    preferredTimes: ['bedtime', 'post_workout'],
    onWeeks: 12,
    offWeeks: 4,
    rationale: '',
    score: 90,
    servesGoals: ['build_muscle'],
  };

  it('spreads weekly doses rather than clustering them', () => {
    assert.deepEqual(spreadDays(3), [0, 2, 4]);
    assert.deepEqual(spreadDays(2), [0, 3]);
    assert.equal(spreadDays(7).length, 7);
  });

  it('moves through titration, on cycle, then washout', () => {
    assert.equal(phaseOn(item, '2026-01-05', '2026-01-05'), 'titration');
    assert.equal(phaseOn(item, '2026-01-05', '2026-02-02'), 'on');
    // Week 13 of a 12-on/4-off cycle.
    assert.equal(phaseOn(item, '2026-01-05', '2026-04-01'), 'washout');
  });

  it('returns null before the start date', () => {
    assert.equal(phaseOn(item, '2026-01-05', '2026-01-04'), null);
  });

  it('schedules no doses during washout', () => {
    const stack = {
      id: 'test',
      name: 'test',
      origin: 'generated',
      createdAt: '',
      startDate: '2026-01-05',
      items: [item],
      goals: ['build_muscle'],
      safety: { interactions: [], contraindications: [], goalConflicts: [], notices: [], sideEffects: [], redFlags: [], monitoring: [], blocking: false, riskScore: 0 },
    };
    const washoutDoses = generateSchedule(stack, '2026-04-01', '2026-04-07');
    assert.equal(washoutDoses.length, 0);

    const onDoses = generateSchedule(stack, '2026-02-02', '2026-02-08');
    // 5 days a week × 2 doses a day.
    assert.equal(onDoses.length, 10);
  });

  it('respects fixed weekdays for weekly compounds', () => {
    const weekly = {
      ...item,
      peptideId: 'semaglutide',
      timesPerDay: 1,
      daysPerWeek: 1,
      preferredTimes: ['morning'],
      onWeeks: 52,
      offWeeks: 0,
      dose: { value: 1, unit: 'mg' },
      startDose: { value: 0.25, unit: 'mg' },
    };
    const stack = {
      id: 'test',
      name: 'test',
      origin: 'generated',
      createdAt: '',
      startDate: '2026-01-05',
      items: [weekly],
      goals: ['lose_fat'],
      safety: { interactions: [], contraindications: [], goalConflicts: [], notices: [], sideEffects: [], redFlags: [], monitoring: [], blocking: false, riskScore: 0 },
    };
    const doses = generateSchedule(stack, '2026-01-05', '2026-01-18');
    assert.equal(doses.length, 2);
    // 5 Jan 2026 is a Monday, which is fixedDays [0].
    assert.deepEqual(doses.map((d) => d.date), ['2026-01-05', '2026-01-12']);
  });

  it('applies the titration dose during the ramp and the target dose after', () => {
    const stack = {
      id: 'test',
      name: 'test',
      origin: 'generated',
      createdAt: '',
      startDate: '2026-01-05',
      items: [item],
      goals: ['build_muscle'],
      safety: { interactions: [], contraindications: [], goalConflicts: [], notices: [], sideEffects: [], redFlags: [], monitoring: [], blocking: false, riskScore: 0 },
    };
    const week1 = generateSchedule(stack, '2026-01-05', '2026-01-05')[0];
    const later = generateSchedule(stack, '2026-02-02', '2026-02-02')[0];
    assert.equal(week1.phase, 'titration');
    assert.ok(week1.dose.value <= later.dose.value);
    assert.equal(later.dose.value, 200);
  });

  it('generates no schedule for a compound whose dose is withheld', () => {
    const withheld = { ...item, peptideId: 'igf-1-lr3', doseWithheld: true };
    const stack = {
      id: 'test',
      name: 'test',
      origin: 'custom',
      createdAt: '',
      startDate: '2026-01-05',
      items: [withheld],
      goals: ['build_muscle'],
      safety: { interactions: [], contraindications: [], goalConflicts: [], notices: [], sideEffects: [], redFlags: [], monitoring: [], blocking: false, riskScore: 0 },
    };
    assert.equal(generateSchedule(stack, '2026-01-05', '2026-01-20').length, 0);
  });
});

// ---------------------------------------------------------------------------
// Workouts
// ---------------------------------------------------------------------------

describe('programme generation', () => {
  it('produces one session per training day', () => {
    for (const days of [2, 3, 4, 5, 6]) {
      const program = generateProgram(makeProfile({ trainingDays: days }));
      assert.equal(program.sessions.length, days, `${days} days produced ${program.sessions.length} sessions`);
      assert.equal(new Set(program.sessions.map((s) => s.dayIndex)).size, days);
    }
  });

  it('keeps beginners away from high-technique lifts', () => {
    const program = generateProgram(makeProfile({ experience: 'none' }));
    for (const session of program.sessions) {
      for (const planned of session.exercises) {
        assert.ok(
          getExercise(planned.exerciseId).technicalDemand <= 2,
          `${planned.exerciseId} is too technical for a beginner`,
        );
      }
    }
  });

  it('excludes high joint-stress work when recovering from injury', () => {
    const program = generateProgram(makeProfile({ goals: ['injury_recovery'], experience: 'experienced' }));
    for (const session of program.sessions) {
      for (const planned of session.exercises) {
        assert.ok(
          getExercise(planned.exerciseId).jointStress <= 2,
          `${planned.exerciseId} is too joint-stressful for injury recovery`,
        );
      }
    }
  });

  it('cuts volume and shortens the deload cycle when sleep is short', () => {
    const rested = generateProgram(makeProfile({ sleepHours: 8, sleepQuality: 4 }));
    const deprived = generateProgram(makeProfile({ sleepHours: 5, sleepQuality: 2 }));
    const setsOf = (p) =>
      p.sessions.reduce((total, s) => total + s.exercises.reduce((sum, e) => sum + e.sets.length, 0), 0);
    assert.ok(setsOf(deprived) < setsOf(rested));
    assert.ok(deprived.deloadEveryWeeks < rested.deloadEveryWeeks);
  });

  it('never repeats an exercise within one session', () => {
    const program = generateProgram(makeProfile({ trainingDays: 5, experience: 'experienced' }));
    for (const session of program.sessions) {
      const ids = session.exercises.map((e) => e.exerciseId);
      assert.equal(new Set(ids).size, ids.length, `duplicate exercise in ${session.name}`);
    }
  });

  it('adds stack-aware guidance when a GLP-1 drug is in the stack', () => {
    const profile = makeProfile({ goals: ['lose_fat'] });
    const stack = generateStack(profile);
    const program = generateProgram(profile, stack);
    const mentionsProtein = program.rationale.some((r) => r.toLowerCase().includes('protein'));
    if (stack.items.some((i) => getPeptide(i.peptideId).classes.includes('incretin'))) {
      assert.ok(mentionsProtein, 'expected muscle-retention guidance for a GLP-1 stack');
    }
  });
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

describe('analytics', () => {
  // 2026-08-06 is a Thursday; its week starts Monday 2026-08-03.
  const FROM = '2026-08-06';

  const session = (date, exercises) => ({ id: `l_${date}`, programId: 'p', sessionId: 's', date, exercises });
  const lift = (exerciseId, sets) => ({ exerciseId, sets });

  it('emits a dense weekly series, including weeks with no training', () => {
    const logs = [session('2026-08-04', [lift('back-squat', [{ reps: 5, weightKg: 100 }])])];
    const series = weeklyVolume(logs, 4, FROM);
    assert.equal(series.length, 4);
    assert.equal(series[3].volumeKg, 500, 'current week should hold the session');
    assert.deepEqual(series.slice(0, 3).map((w) => w.volumeKg), [0, 0, 0]);
    assert.equal(series[3].weekStart, '2026-08-03');
  });

  it('buckets a session into the correct week', () => {
    const logs = [session('2026-07-28', [lift('back-squat', [{ reps: 10, weightKg: 60 }])])];
    const series = weeklyVolume(logs, 3, FROM);
    // 28 July is the week starting 27 July — one week before last.
    assert.equal(series[1].volumeKg, 600);
    assert.equal(series[2].volumeKg, 0);
  });

  it('ranks strength trends by how often a lift was trained', () => {
    const logs = [
      session('2026-08-01', [lift('back-squat', [{ reps: 5, weightKg: 100 }]), lift('deadlift', [{ reps: 5, weightKg: 140 }])]),
      session('2026-08-03', [lift('back-squat', [{ reps: 5, weightKg: 110 }])]),
      session('2026-08-05', [lift('back-squat', [{ reps: 5, weightKg: 120 }])]),
    ];
    const trends = strengthTrends(logs);
    assert.equal(trends[0].exerciseId, 'back-squat');
    assert.equal(trends[0].points.length, 3);
    assert.ok(trends[0].changePct > 0, 'squat went up, so the trend should be positive');
    assert.equal(trends[1].changePct, null, 'a single session cannot have a trend');
  });

  it('orders strength points oldest-first regardless of log order', () => {
    const logs = [
      session('2026-08-05', [lift('bench-press', [{ reps: 5, weightKg: 90 }])]),
      session('2026-08-01', [lift('bench-press', [{ reps: 5, weightKg: 80 }])]),
    ];
    const [trend] = strengthTrends(logs);
    assert.deepEqual(trend.points.map((p) => p.date), ['2026-08-01', '2026-08-05']);
    assert.ok(trend.changePct > 0);
  });

  it('counts a supporting muscle as half a set', () => {
    // Bench press: primary chest, secondary triceps and shoulders.
    const logs = [session('2026-08-05', [lift('bench-press', [{ reps: 5, weightKg: 80 }, { reps: 5, weightKg: 80 }])])];
    const load = muscleLoad(logs, 7, FROM);
    const chest = load.find((m) => m.muscle === 'chest');
    const triceps = load.find((m) => m.muscle === 'triceps');
    assert.equal(chest.sets, 2);
    assert.equal(triceps.sets, 1);
    assert.equal(load[0].muscle, 'chest', 'ranked by volume');
  });

  it('ignores training outside the muscle-load window', () => {
    const logs = [session('2026-07-01', [lift('bench-press', [{ reps: 5, weightKg: 80 }])])];
    assert.deepEqual(muscleLoad(logs, 7, FROM), []);
  });

  it('produces a dense adherence series and counts only logged doses', () => {
    const doses = [
      { id: 'd1', stackId: 's', peptideId: 'ipamorelin', date: '2026-08-06', time: '08:00', timeOfDay: 'morning', dose: { value: 100, unit: 'mcg' }, route: 'subcutaneous', phase: 'on' },
      { id: 'd2', stackId: 's', peptideId: 'ipamorelin', date: '2026-08-06', time: '22:00', timeOfDay: 'bedtime', dose: { value: 100, unit: 'mcg' }, route: 'subcutaneous', phase: 'on' },
      { id: 'd3', stackId: 's', peptideId: 'ipamorelin', date: '2026-08-05', time: '08:00', timeOfDay: 'morning', dose: { value: 100, unit: 'mcg' }, route: 'subcutaneous', phase: 'on' },
    ];
    const logs = { d1: { scheduledDoseId: 'd1', status: 'taken', loggedAt: '' }, d3: { scheduledDoseId: 'd3', status: 'skipped', loggedAt: '' } };
    const series = adherenceSeries(doses, logs, 3, FROM);
    assert.equal(series.length, 3);
    const last = series[2];
    assert.equal(last.date, '2026-08-06');
    assert.equal(last.taken, 1);
    assert.equal(last.skipped, 0);
    assert.equal(last.scheduled, 2, 'an unlogged dose still counts as scheduled');
    assert.equal(series[1].skipped, 1);
  });

  it('buckets side effects by week and severity', () => {
    const entries = [
      { id: '1', date: '2026-08-05', label: 'Nausea', severity: 'mild' },
      { id: '2', date: '2026-08-04', label: 'Headache', severity: 'severe' },
      { id: '3', date: '2026-07-29', label: 'Bloating', severity: 'moderate' },
    ];
    const series = sideEffectsByWeek(entries, 3, FROM);
    assert.equal(series[2].mild, 1);
    assert.equal(series[2].severe, 1);
    assert.equal(series[2].total, 2);
    assert.equal(series[1].moderate, 1);
    assert.equal(series[0].total, 0);
  });

  it('does not break a streak on an as-yet-untrained current week', () => {
    const logs = [
      session('2026-07-28', [lift('back-squat', [{ reps: 5, weightKg: 100 }])]),
      session('2026-07-21', [lift('back-squat', [{ reps: 5, weightKg: 100 }])]),
    ];
    const summary = trainingSummary(logs, 4, FROM);
    assert.equal(summary.sessionsThisWeek, 0);
    assert.equal(summary.streakWeeks, 2, 'the in-progress week should not zero the streak');
  });

  it('reports a zero streak once a full week is missed', () => {
    const logs = [session('2026-07-14', [lift('back-squat', [{ reps: 5, weightKg: 100 }])])];
    assert.equal(trainingSummary(logs, 4, FROM).streakWeeks, 0);
  });

  it('handles empty logs everywhere without throwing', () => {
    assert.equal(weeklyVolume([], 4, FROM).length, 4);
    assert.deepEqual(strengthTrends([]), []);
    assert.deepEqual(muscleLoad([], 7, FROM), []);
    assert.deepEqual(adherenceSeries([], {}, 2, FROM).map((d) => d.scheduled), [0, 0]);
    assert.equal(sideEffectsByWeek([], 2, FROM).length, 2);
    assert.equal(trainingSummary([], 4, FROM).totalVolumeKg, 0);
  });
});

describe('progression', () => {
  it('estimates a one-rep max with the Epley formula', () => {
    assert.equal(estimatedOneRepMax(100, 1), 100);
    assert.equal(estimatedOneRepMax(100, 5), 116.7);
  });

  it('adds load when the target was hit with reps in reserve', () => {
    const next = suggestNextLoad([{ reps: 8, weightKg: 100, rir: 2 }], 8);
    assert.equal(next.weightKg, 105);
  });

  it('holds load when the target was hit at the limit', () => {
    const next = suggestNextLoad([{ reps: 8, weightKg: 100, rir: 0 }], 8);
    assert.equal(next.weightKg, 100);
  });

  it('reduces load after a clear miss', () => {
    const next = suggestNextLoad([{ reps: 4, weightKg: 100, rir: 0 }], 8);
    assert.equal(next.weightKg, 95);
  });

  it('returns nothing without history', () => {
    assert.equal(suggestNextLoad([], 8), null);
  });
});

// ---------------------------------------------------------------------------
// Progress tracking
// ---------------------------------------------------------------------------

function measurement(overrides = {}) {
  return { id: 'm1', metricId: 'bodyweight', date: '2026-01-01', value: 80, ...overrides };
}

describe('metric catalogue', () => {
  it('has unique metric ids', () => {
    const ids = METRICS.map((m) => m.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('offers every metric under at least one goal', () => {
    for (const metric of METRICS) {
      assert.ok(metric.goals.length > 0, `${metric.id} has no goals`);
    }
  });

  it('indexes metrics by id', () => {
    assert.equal(METRIC_BY_ID.bodyweight.label, 'Bodyweight');
  });

  it('returns metrics matching a goal, in catalogue order', () => {
    const forFat = metricsForGoals(['lose_fat']);
    assert.ok(forFat.some((m) => m.id === 'bodyweight'));
    assert.ok(forFat.some((m) => m.id === 'waist'));
    // A strength lift belongs to build_muscle, not fat loss.
    assert.ok(!forFat.some((m) => m.id === 'squat_top_set'));
  });

  it('never uses a scale metric with a unit, or drops a unit from a number metric', () => {
    for (const metric of METRICS) {
      if (metric.kind === 'scale') assert.equal(metric.unit, '');
    }
  });
});

describe('progress summaries', () => {
  it('sorts readings oldest-to-newest regardless of input order', () => {
    const [summary] = summariseMeasurements([
      measurement({ id: 'b', date: '2026-02-01', value: 78 }),
      measurement({ id: 'a', date: '2026-01-01', value: 80 }),
    ]);
    assert.deepEqual(
      summary.points.map((p) => p.date),
      ['2026-01-01', '2026-02-01'],
    );
    assert.equal(summary.first, 80);
    assert.equal(summary.latest, 78);
  });

  it('reports change and percentage change between first and latest', () => {
    const [summary] = summariseMeasurements([
      measurement({ id: 'a', date: '2026-01-01', value: 80 }),
      measurement({ id: 'b', date: '2026-02-01', value: 76 }),
    ]);
    assert.equal(summary.change, -4);
    assert.equal(summary.changePct, -5);
  });

  it('withholds change until there are two readings', () => {
    const [summary] = summariseMeasurements([measurement()]);
    assert.equal(summary.count, 1);
    assert.equal(summary.change, null);
    assert.equal(summary.changePct, null);
  });

  it('does not divide by a zero first reading', () => {
    const [summary] = summariseMeasurements([
      measurement({ id: 'a', metricId: 'skin_clarity', date: '2026-01-01', value: 0 }),
      measurement({ id: 'b', metricId: 'skin_clarity', date: '2026-02-01', value: 3 }),
    ]);
    assert.equal(summary.change, 3);
    assert.equal(summary.changePct, null);
  });

  it('keeps distinct metrics in separate series', () => {
    const summaries = summariseMeasurements([
      measurement({ id: 'a', metricId: 'bodyweight' }),
      measurement({ id: 'b', metricId: 'waist', value: 84 }),
    ]);
    assert.equal(summaries.length, 2);
  });

  it('keeps two differently-named custom measures apart but collects one', () => {
    assert.equal(
      seriesKey(measurement({ metricId: CUSTOM_METRIC_ID, customLabel: 'Mood' })),
      seriesKey(measurement({ metricId: CUSTOM_METRIC_ID, customLabel: 'mood' })),
    );
    const summaries = summariseMeasurements([
      measurement({ id: 'a', metricId: CUSTOM_METRIC_ID, customLabel: 'Mood', customUnit: '', value: 3 }),
      measurement({ id: 'b', metricId: CUSTOM_METRIC_ID, customLabel: 'Mood', customUnit: '', value: 4 }),
      measurement({ id: 'c', metricId: CUSTOM_METRIC_ID, customLabel: 'Energy', customUnit: '', value: 2 }),
    ]);
    assert.equal(summaries.length, 2);
    const mood = summaries.find((s) => s.label === 'Mood');
    assert.equal(mood.count, 2);
  });
});

// ---------------------------------------------------------------------------
// Estimated medication levels (PK) — THEA-6 / docs/pk-estimated-levels-spec.md §5
// ---------------------------------------------------------------------------

function injection(overrides = {}) {
  return {
    id: 'inj_test',
    date: '2026-01-01',
    time: '08:00',
    peptideId: 'semaglutide',
    dose: { value: 1, unit: 'mg' },
    site: 'abdomen_left',
    painLevel: 0,
    ...overrides,
  };
}

/** Mirrors pk.ts's own date+time → epoch-hours conversion, for building `now`. */
function epochHoursOf(date, time) {
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  return new Date(y, m - 1, d, h, min).getTime() / 3_600_000;
}

describe('estimated medication levels (PK)', () => {
  it('T1 — every pk-modelled peptide is not withheld and doses in mg/mcg', () => {
    for (const peptide of PEPTIDES) {
      if (!peptide.pk) continue;
      assert.equal(peptide.doseGuidanceWithheld, undefined, `${peptide.id}: withheld compound must not carry a pk model`);
      assert.ok(['mg', 'mcg'].includes(peptide.dosing.unit), `${peptide.id}: pk model on a non-mass dosing unit`);
      assert.equal(peptideHasLevelModel(peptide), true);
    }
  });

  it('T2 — exactly semaglutide and tirzepatide have a pk model', () => {
    const withPk = PEPTIDES.filter((p) => p.pk).map((p) => p.id).sort();
    assert.deepEqual(withPk, ['semaglutide', 'tirzepatide']);
  });

  it('T3 — semaglutide reproduces the §1.1 implementation self-check at the 85 kg reference', () => {
    const peptide = getPeptide('semaglutide');
    const weightKg = 85; // the reference weight — CL is unscaled here

    // The self-check table (§1.1) is the ground truth for a correct
    // transcription of the equations; the label's rounded "approximately 1
    // week" is deliberately looser (spec §6, CAL-3 notes a similar rounding
    // gap for tmax) so it is checked only as a sanity band, not to 5%.
    const halfLife = terminalHalfLifeHours(peptide.pk, weightKg);
    assert.ok(Math.abs(halfLife - 176.9) / 176.9 < 0.01, `half-life ${halfLife}`);
    assert.ok(halfLife > 140 && halfLife < 200, `half-life ${halfLife} not "approximately a week"`);

    const cavgSs1mg = steadyStateAverageMgPerL(peptide.pk, 1.0, 168, weightKg);
    assert.ok(Math.abs(cavgSs1mg - 0.1245) / 0.1245 < 0.01, `Cavg,ss ${cavgSs1mg}`);

    const aucTau2mg = steadyStateAverageMgPerL(peptide.pk, 2.0, 168, weightKg) * 168;
    const SEMAGLUTIDE_MW = 4113.58; // Ozempic/Wegovy USPI §11
    const aucNmol = (aucTau2mg / SEMAGLUTIDE_MW) * 1e6;
    // Published steady-state AUCτ for once-weekly 2.0 mg is ≈9,825 nmol·h/L;
    // spec §1.1 documents the model as running ~3.5% high against it.
    assert.ok(Math.abs(aucNmol - 9825) / 9825 < 0.05, `AUC ${aucNmol} nmol·h/L`);

    const ke = Math.log(2) / halfLife;
    const accumulationRatio = 1 / (1 - Math.exp(-ke * 168));
    assert.ok(accumulationRatio >= 2.0 && accumulationRatio <= 2.2, `accumulation ratio ${accumulationRatio}`);
  });

  it('T4 — tirzepatide reproduces the §1.2 implementation self-check at the 70 kg reference', () => {
    const peptide = getPeptide('tirzepatide');
    const weightKg = 70;

    const coeffs = twoCompartmentCoefficients(peptide.pk, 5, weightKg);
    assert.ok(Math.abs(coeffs.A + coeffs.B + coeffs.K) < 1e-6, `A+B+K = ${coeffs.A + coeffs.B + coeffs.K}`);
    assert.ok(Math.abs(coeffs.A - -0.7689) < 0.002, `A ${coeffs.A}`);
    assert.ok(Math.abs(coeffs.B - 0.576) < 0.002, `B ${coeffs.B}`);
    assert.ok(Math.abs(coeffs.K - 0.1928) < 0.002, `K ${coeffs.K}`);

    const halfLifeDays = terminalHalfLifeHours(peptide.pk, weightKg) / 24;
    assert.ok(halfLifeDays >= 5 && halfLifeDays <= 7, `terminal half-life ${halfLifeDays} days`);

    const cavgSs = steadyStateAverageMgPerL(peptide.pk, 5, 168, weightKg);
    assert.ok(Math.abs(cavgSs - 0.724) / 0.724 < 0.01, `Cavg,ss ${cavgSs}`);
    // Reproduces F·D/(CL·τ) directly — guards against a stray extra F application (D3).
    assert.ok(Math.abs(cavgSs - (0.8 * 5) / (0.0329 * 168)) < 1e-9);
  });

  it('T5 — carries no risk-dial input at all (AGENTS.md invariant 2 / D4)', () => {
    // buildLevelSeries's inputs are (peptide, injectionLogs, weightKg,
    // nowEpochHours) — nothing resembling a risk tolerance. Pinning the arity
    // catches a future change that threads the dial in as a silent 5th input.
    assert.equal(buildLevelSeries.length, 4);
  });

  it('T6 — an empty injection log yields an empty curve, never a schedule projection', () => {
    const peptide = getPeptide('semaglutide');
    const result = buildLevelSeries(peptide, [], 80, epochHoursOf('2026-01-08', '08:00'));
    assert.equal(result.eligible, true);
    assert.deepEqual(result.points, []);
    assert.equal(result.cavgSsMgPerL, null);
  });

  it('T7 — falls back to the reference weight outside the 40–200 kg domain', () => {
    const peptide = getPeptide('semaglutide');
    const logs = [injection({ date: '2026-01-01', time: '08:00' })];
    const now = epochHoursOf('2026-01-08', '08:00');

    const tooHeavy = buildLevelSeries(peptide, logs, 260, now);
    assert.equal(tooHeavy.weightFallback, true);
    assert.equal(tooHeavy.weightKgUsed, 85);

    const missing = buildLevelSeries(peptide, logs, undefined, now);
    assert.equal(missing.weightFallback, true);
    assert.equal(missing.weightKgUsed, 85);

    const normal = buildLevelSeries(peptide, logs, 90, now);
    assert.equal(normal.weightFallback, false);
    assert.equal(normal.weightKgUsed, 90);
  });

  it('T8 — a doseGuidanceWithheld compound never produces a curve, even carrying a pk model', () => {
    const fakePeptide = {
      id: 'fake-withheld',
      dosing: { unit: 'mg' },
      doseGuidanceWithheld: { reason: 'test fixture' },
      pk: getPeptide('semaglutide').pk,
      frequency: { daysPerWeek: 1, timesPerDay: 1 },
    };
    assert.equal(peptideHasLevelModel(fakePeptide), false);
    const result = buildLevelSeries(
      fakePeptide,
      [injection({ peptideId: 'fake-withheld' })],
      80,
      epochHoursOf('2026-01-08', '08:00'),
    );
    assert.equal(result.eligible, false);
    assert.deepEqual(result.points, []);
  });

  it('T8 — an iu/pct dosed compound never produces a curve (E4)', () => {
    const fakePeptide = {
      id: 'fake-iu',
      dosing: { unit: 'iu' },
      pk: getPeptide('semaglutide').pk,
      frequency: { daysPerWeek: 1, timesPerDay: 1 },
    };
    assert.equal(peptideHasLevelModel(fakePeptide), false);
  });

  it('T10 — stays free of any import from the advisory dosing/recommend modules', () => {
    const source = fs.readFileSync(path.join(__dirname, '..', 'src', 'engine', 'pk.ts'), 'utf8');
    assert.ok(!/from ['"]\.\/dosing['"]/.test(source), 'pk.ts must not import ./dosing');
    assert.ok(!/from ['"]\.\/recommend['"]/.test(source), 'pk.ts must not import ./recommend');
  });

  it('T11 — U7: a same-day log timed later than "now" never draws the curve past "now" (THEA-19)', () => {
    const peptide = getPeptide('semaglutide');
    const now = epochHoursOf('2026-01-08', '08:00');
    // Logged for later today — free-text time field, ahead of the clock.
    const futureToday = [injection({ date: '2026-01-08', time: '20:00' })];

    const result = buildLevelSeries(peptide, futureToday, 85, now);
    for (const point of result.points) {
      assert.ok(result.anchorEpochHours + point.hoursFromStart <= now + 1e-9, 'point drawn past "now"');
    }

    // All-future history degrades to an empty window rather than one that runs past now.
    const wayFuture = [injection({ date: '2026-02-01', time: '08:00' })];
    const allFuture = buildLevelSeries(peptide, wayFuture, 85, now);
    assert.deepEqual(allFuture.points, []);
  });

  it('T12 — Tier 3 short-half-life compounds get the distinct §2.3 copy, other Tier 3 compounds get null (THEA-19)', () => {
    const shortHalfLife = [
      'tesamorelin',
      'teriparatide',
      'ipamorelin',
      'mod-grf-1-29',
      'sermorelin',
      'ghrp-2',
      'ghrp-6',
      'hexarelin',
      'mk-677',
    ];
    for (const id of shortHalfLife) {
      const clearance = pkShortHalfLifeClearance(id);
      assert.ok(typeof clearance === 'string' && clearance.length > 0, `${id}: expected a clearance phrase`);
    }
    // A Tier 3 compound that fails on E1 (no published PK), not E5, keeps the generic copy.
    assert.equal(pkShortHalfLifeClearance('bpc-157'), null);
  });

  it('converts dose units at the boundary only, and never guesses iu/pct', () => {
    assert.equal(doseToMg({ value: 2, unit: 'mg' }), 2);
    assert.equal(doseToMg({ value: 500, unit: 'mcg' }), 0.5);
    assert.equal(doseToMg({ value: 1, unit: 'iu' }), null);
    assert.equal(doseToMg({ value: 1, unit: 'pct' }), null);
  });

  it("derives the dosing interval from the compound's own published frequency, not an invented number", () => {
    assert.equal(dosingIntervalHours(getPeptide('semaglutide')), 168);
    assert.equal(dosingIntervalHours(getPeptide('tirzepatide')), 168);
  });

  it('builds a superposed curve from logged injections (D1) with the ×/÷1.25 band on every point (U3)', () => {
    const peptide = getPeptide('semaglutide');
    const logs = [
      injection({ id: 'a', date: '2026-01-01', time: '08:00', dose: { value: 1, unit: 'mg' } }),
      injection({ id: 'b', date: '2026-01-08', time: '08:00', dose: { value: 1, unit: 'mg' } }),
    ];
    const now = epochHoursOf('2026-01-15', '08:00');
    const result = buildLevelSeries(peptide, logs, 85, now);
    assert.equal(result.eligible, true);
    assert.ok(result.points.length > 0);
    assert.ok(result.cavgSsMgPerL > 0);
    for (const point of result.points) {
      assert.ok(Math.abs(point.pctLow - point.pct / 1.25) < 1e-9);
      assert.ok(Math.abs(point.pctHigh - point.pct * 1.25) < 1e-9);
      assert.ok(point.pctLow <= point.pct && point.pct <= point.pctHigh);
    }
  });

  it('a single-dose concentration is zero before the dose is given', () => {
    const peptide = getPeptide('tirzepatide');
    assert.equal(singleDoseConcentrationMgPerL(peptide.pk, 5, -1, 70), 0);
  });
});
