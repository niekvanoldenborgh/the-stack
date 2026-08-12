import type { Peptide } from '../types';

/**
 * Repair, bone and immune compounds.
 *
 * The recurring pattern here is a large gap between the strength of the animal
 * data and the strength of the human data. BPC-157 in particular has an
 * unusually consistent rodent literature and essentially zero controlled human
 * trials — the app should convey both halves of that sentence.
 */
export const REPAIR_PEPTIDES: Peptide[] = [
  {
    id: 'bpc-157',
    name: 'BPC-157',
    aliases: ['Body Protection Compound 157', 'PL 14736'],
    classes: ['healing_repair'],
    legalStatus: 'research_chemical',
    evidence: 'C',
    summary:
      'The most widely used healing peptide. A remarkably consistent body of rodent data across tendon, muscle, gut and nerve injury — and no completed controlled human trial.',
    mechanism:
      'A synthetic fragment of a protein found in gastric juice. In animals it upregulates VEGF-driven angiogenesis, increases fibroblast migration and tendon outgrowth, and modulates the nitric oxide system. The angiogenic effect is the most consistently reproduced finding.',
    routes: ['subcutaneous', 'intramuscular', 'oral'],
    dosing: {
      unit: 'mcg',
      basis: 'fixed',
      low: 250,
      typical: 400,
      high: 500,
      hardMax: 1000,
      titrationWeeks: 0,
      note: 'Community protocols use 250–500 mcg once or twice daily. These figures come from scaling rodent doses, not from human trials. Injecting near the injury site is common practice but has no controlled evidence behind it.',
    },
    frequency: {
      timesPerDay: 2,
      daysPerWeek: 7,
      preferredTimes: ['morning', 'evening'],
      timingRationale:
        'Split dosing reflects a short half-life. Timing relative to food does not appear to matter for injected use.',
    },
    cycle: {
      onWeeks: 6,
      offWeeks: 4,
      maxConsecutiveCycles: 3,
      rationale:
        'Typically run for the duration of an injury rehab block — 4–8 weeks — then stopped. Continuous long-term use has no safety data supporting it.',
    },
    goalFit: {
      injury_recovery: 4,
      bone_density: 2,
      build_muscle: 1,
      skin_quality: 1,
      metabolic_health: 1,
    },
    sideEffects: [
      { label: 'Injection-site irritation', severity: 'mild', likelihood: 'common' },
      { label: 'Nausea or altered appetite', severity: 'mild', likelihood: 'uncommon' },
      { label: 'Headache or light-headedness', severity: 'mild', likelihood: 'uncommon' },
      {
        label: 'Unknown effect on abnormal tissue',
        severity: 'severe',
        likelihood: 'rare',
        detail:
          'The mechanism is pro-angiogenic — it promotes new blood vessel growth. Tumours also depend on new blood vessels. There is no evidence BPC-157 promotes cancer, but there is also no study that would have detected it.',
      },
    ],
    contraindications: [
      { flag: 'active_cancer', kind: 'absolute', reason: 'A pro-angiogenic compound with an active malignancy is not a risk worth taking, whatever the theoretical arguments.' },
      { flag: 'pregnant_or_breastfeeding', kind: 'absolute', reason: 'No safety data.' },
      { flag: 'under_18', kind: 'absolute', reason: 'No safety data.' },
      { flag: 'cancer_history', kind: 'relative', reason: 'Discuss with your oncologist before using anything angiogenic.' },
    ],
    redFlags: [
      { symptom: 'Spreading redness, warmth, swelling or pus at an injection site', action: 'Seek medical care — injection-site infection needs antibiotics, not more peptide.' },
      { symptom: 'Fever after starting injections', action: 'Stop and get assessed.' },
    ],
    monitoring: [
      'Track the actual injury: range of motion, pain on loading, and function — not just how you feel',
      'Keep a physiotherapist involved. Progressive loading has far better evidence than anything injectable.',
    ],
    bannedInSport: false,
    sources: [
      'Sikiric et al., extensive preclinical BPC-157 literature on tendon, muscle and gut healing (1990s–2020s)',
      'Chang et al., BPC-157 and tendon fibroblast outgrowth (Journal of Applied Physiology, 2011)',
      'Note: PL 14736, the oral form, reached phase 2 for inflammatory bowel disease and was not developed further',
    ],
    notes: [
      'Not currently on the WADA prohibited list, but it sits in the "S0 unapproved substances" catch-all, which prohibits any substance not approved for human therapeutic use. Tested athletes should treat it as banned.',
      'The gap between the rodent data and human data is the single most important thing to understand about this compound. Impressive animal results have repeatedly failed to replicate in humans across all of medicine.',
    ],
  },

  {
    id: 'tb-500',
    name: 'TB-500',
    aliases: ['Thymosin Beta-4 fragment', 'TB4 Frag 17-23'],
    classes: ['healing_repair'],
    legalStatus: 'research_chemical',
    evidence: 'C',
    summary:
      'A synthetic fragment of thymosin beta-4, used alongside BPC-157 for soft-tissue injury. Animal data only, and explicitly banned in sport.',
    mechanism:
      'Corresponds to the actin-binding domain of thymosin beta-4. Promotes cell migration, angiogenesis and reduced inflammatory scarring in animal wound models.',
    routes: ['subcutaneous', 'intramuscular'],
    dosing: {
      unit: 'mg',
      basis: 'fixed',
      low: 2,
      typical: 2.5,
      high: 5,
      hardMax: 5,
      titrationWeeks: 0,
      note: 'Common protocols use a loading phase of 2–5 mg twice weekly for 4–6 weeks, then a lower maintenance dose. Derived from animal work, not human trials.',
    },
    frequency: {
      timesPerDay: 1,
      daysPerWeek: 2,
      fixedDays: [0, 3],
      preferredTimes: ['evening'],
      timingRationale: 'Twice-weekly dosing reflects a long tissue residence time. Timing within the day is not important.',
    },
    cycle: {
      onWeeks: 6,
      offWeeks: 6,
      maxConsecutiveCycles: 2,
      rationale: 'Used as an injury rehab block rather than continuously. Long-term safety is uncharacterised.',
    },
    goalFit: {
      injury_recovery: 4,
      hair_growth: 1,
      skin_quality: 1,
      build_muscle: 1,
    },
    sideEffects: [
      { label: 'Injection-site reactions', severity: 'mild', likelihood: 'common' },
      { label: 'Head rush or fatigue after dosing', severity: 'mild', likelihood: 'uncommon' },
      { label: 'Unknown effect on abnormal tissue', severity: 'severe', likelihood: 'rare', detail: 'As with BPC-157, the pro-angiogenic and pro-migratory mechanism is theoretically relevant to tumour biology and has not been studied in humans.' },
    ],
    contraindications: [
      { flag: 'active_cancer', kind: 'absolute', reason: 'Pro-angiogenic and promotes cell migration — the two things you least want with an active tumour.' },
      { flag: 'cancer_history', kind: 'relative', reason: 'Requires oncology input.' },
      { flag: 'pregnant_or_breastfeeding', kind: 'absolute', reason: 'No safety data.' },
      { flag: 'under_18', kind: 'absolute', reason: 'No safety data.' },
    ],
    redFlags: [{ symptom: 'Signs of injection-site infection or fever', action: 'Seek medical care.' }],
    monitoring: ['Objective injury markers — range of motion, pain on loading, return-to-function milestones'],
    bannedInSport: true,
    sources: [
      'Goldstein et al., thymosin beta-4 in tissue repair (Annals of the New York Academy of Sciences, 2012)',
      'WADA Prohibited List — TB-500 is explicitly named under class S2',
    ],
    notes: [
      'Explicitly named on the WADA prohibited list. If you are drug tested, this will end your season.',
    ],
  },

  {
    id: 'teriparatide',
    name: 'Teriparatide',
    aliases: ['PTH (1-34)', 'Forteo'],
    classes: ['bone_anabolic'],
    legalStatus: 'prescription',
    evidence: 'A',
    summary:
      'Recombinant parathyroid hormone fragment. The only genuinely bone-building compound in this app, and a prescription osteoporosis medicine.',
    mechanism:
      'Intermittent daily dosing of PTH paradoxically stimulates osteoblasts more than osteoclasts, producing net new bone formation. Continuous exposure to PTH does the opposite and dissolves bone — the dosing interval is the whole mechanism.',
    routes: ['subcutaneous'],
    dosing: {
      unit: 'mcg',
      basis: 'fixed',
      low: 20,
      typical: 20,
      high: 20,
      hardMax: 20,
      titrationWeeks: 0,
      note: 'A flat 20 mcg once daily. No titration and no weight scaling — the dose is fixed by the label.',
    },
    frequency: {
      timesPerDay: 1,
      daysPerWeek: 7,
      preferredTimes: ['morning'],
      timingRationale:
        'Once daily, at the same time each day. Sit or lie down for the first few doses — it can cause a drop in blood pressure. The once-daily pulse is essential; more frequent dosing reverses the effect.',
    },
    cycle: {
      onWeeks: 104,
      offWeeks: 0,
      maxConsecutiveCycles: 1,
      rationale:
        'Lifetime use is limited to 24 months, followed by an antiresorptive drug to hold the gains. Bone density is lost rapidly after stopping if nothing follows it.',
    },
    goalFit: {
      bone_density: 5,
      injury_recovery: 2,
    },
    sideEffects: [
      { label: 'Dizziness on standing', severity: 'moderate', likelihood: 'common', detail: 'Most pronounced with the first few doses.' },
      { label: 'Leg cramps', severity: 'mild', likelihood: 'common' },
      { label: 'Nausea', severity: 'mild', likelihood: 'common' },
      { label: 'Raised blood calcium', severity: 'moderate', likelihood: 'uncommon' },
      { label: 'Osteosarcoma signal in rats', severity: 'severe', likelihood: 'rare', detail: 'Seen at high doses in rats. Long-term human surveillance has not confirmed an increased risk, and the boxed warning was removed in 2020.' },
    ],
    contraindications: [
      { flag: 'active_cancer', kind: 'absolute', reason: 'Contraindicated with bone metastases or skeletal malignancy.' },
      { flag: 'under_18', kind: 'absolute', reason: 'Contraindicated with open growth plates.' },
      { flag: 'pregnant_or_breastfeeding', kind: 'absolute', reason: 'Not established as safe.' },
      { flag: 'cancer_history', kind: 'relative', reason: 'Prior skeletal radiation or bone malignancy is a labelled contraindication.' },
      { flag: 'kidney_disease', kind: 'relative', reason: 'Calcium and PTH handling are altered; needs specialist management.' },
    ],
    redFlags: [
      { symptom: 'Persistent nausea, vomiting, constipation, confusion or excessive thirst', action: 'Contact your prescriber — these are hypercalcaemia symptoms.' },
      { symptom: 'New persistent bone pain in one location', action: 'Get it assessed.' },
    ],
    monitoring: ['Serum calcium before starting and periodically', 'Vitamin D status and adequate calcium intake', 'DEXA bone density scan at baseline and after 12–24 months'],
    bannedInSport: false,
    sources: [
      'FDA prescribing information — Forteo (teriparatide)',
      'Neer et al., teriparatide and fracture risk in postmenopausal osteoporosis (NEJM, 2001)',
    ],
    notes: [
      'This is here to answer the "can peptides grow my bones" question honestly. In adults the answer is: bone *density* yes, with this drug and a prescription. Bone *length* no — growth plates close after puberty and nothing reopens them.',
    ],
  },

  {
    id: 'thymosin-alpha-1',
    name: 'Thymosin Alpha-1',
    aliases: ['Tα1', 'Zadaxin'],
    classes: ['thymic_immune'],
    legalStatus: 'prescription',
    evidence: 'B',
    summary:
      'An immune-modulating peptide approved in some countries for hepatitis B and used as an adjunct in sepsis and immune deficiency. Not a performance compound.',
    mechanism:
      'Enhances T-cell maturation and function and modulates dendritic cell activity. It tunes immune response rather than broadly suppressing or stimulating it.',
    routes: ['subcutaneous'],
    dosing: {
      unit: 'mg',
      basis: 'fixed',
      low: 1.6,
      typical: 1.6,
      high: 3.2,
      hardMax: 3.2,
      titrationWeeks: 0,
      note: 'The studied dose is 1.6 mg twice weekly. Higher doses have been used in sepsis under hospital supervision.',
    },
    frequency: {
      timesPerDay: 1,
      daysPerWeek: 2,
      fixedDays: [0, 3],
      preferredTimes: ['morning'],
      timingRationale: 'Twice weekly on non-consecutive days, following the trial protocols.',
    },
    cycle: {
      onWeeks: 8,
      offWeeks: 4,
      maxConsecutiveCycles: 3,
      rationale: 'Used in defined courses rather than continuously outside chronic hepatitis treatment.',
    },
    goalFit: {
      injury_recovery: 2,
      acne_control: 1,
      skin_quality: 1,
    },
    sideEffects: [
      { label: 'Injection-site reactions', severity: 'mild', likelihood: 'common' },
      { label: 'Transient fatigue', severity: 'mild', likelihood: 'uncommon' },
      { label: 'Flare of autoimmune conditions', severity: 'severe', likelihood: 'rare', detail: 'Enhancing T-cell activity can worsen autoimmune disease.' },
    ],
    contraindications: [
      { flag: 'pregnant_or_breastfeeding', kind: 'absolute', reason: 'Not established as safe.' },
      { flag: 'under_18', kind: 'absolute', reason: 'Specialist decision only.' },
      { flag: 'active_cancer', kind: 'relative', reason: 'Immune modulation interacts with cancer immunotherapy — requires oncology input rather than blanket avoidance.' },
      { flag: 'on_prescription_meds', kind: 'relative', reason: 'Directly opposes immunosuppressant therapy, including post-transplant regimens.' },
    ],
    redFlags: [{ symptom: 'New joint swelling, rash, or a flare of a known autoimmune condition', action: 'Stop and see a doctor.' }],
    monitoring: ['Full blood count if used for more than a few weeks', 'Any autoimmune symptoms'],
    bannedInSport: false,
    sources: [
      'Zadaxin (thymalfasin) prescribing information — approved in over 30 countries for chronic hepatitis B',
      'Wu et al., thymosin alpha-1 in sepsis, randomised controlled trial (Critical Care, 2013)',
    ],
  },

  {
    id: 'kpv',
    name: 'KPV',
    aliases: ['Lysine-Proline-Valine', 'α-MSH (11-13)'],
    classes: ['healing_repair'],
    legalStatus: 'research_chemical',
    evidence: 'C',
    summary:
      'A three-amino-acid anti-inflammatory fragment of alpha-MSH. Studied for gut and skin inflammation; used topically and orally for acne and eczema.',
    mechanism:
      'The C-terminal tripeptide of alpha-MSH. Retains the anti-inflammatory and antimicrobial activity of the parent hormone without its pigmentation or appetite effects, appearing to act intracellularly to inhibit NF-κB signalling.',
    routes: ['topical', 'oral', 'subcutaneous'],
    dosing: {
      unit: 'mcg',
      basis: 'fixed',
      low: 200,
      typical: 400,
      high: 500,
      hardMax: 800,
      titrationWeeks: 0,
      note: 'Community use is 200–500 mcg daily, injected or oral, or applied as a topical cream for skin lesions. No human dose-finding study exists.',
    },
    frequency: {
      timesPerDay: 1,
      daysPerWeek: 7,
      preferredTimes: ['evening'],
      timingRationale: 'Once daily. Topical application is made to clean skin, usually at night.',
    },
    cycle: {
      onWeeks: 8,
      offWeeks: 4,
      maxConsecutiveCycles: 3,
      rationale: 'Conservative course length given the absence of long-term human data.',
    },
    goalFit: {
      acne_control: 3,
      skin_quality: 2,
      injury_recovery: 2,
    },
    sideEffects: [
      { label: 'Local irritation with topical use', severity: 'mild', likelihood: 'uncommon' },
      { label: 'Injection-site reactions', severity: 'mild', likelihood: 'uncommon' },
      { label: 'Unknown long-term profile', severity: 'moderate', likelihood: 'common' },
    ],
    contraindications: [
      { flag: 'pregnant_or_breastfeeding', kind: 'absolute', reason: 'No data.' },
      { flag: 'under_18', kind: 'absolute', reason: 'No data.' },
    ],
    redFlags: [{ symptom: 'Spreading rash or swelling of the face, lips or throat', action: 'Emergency care — possible allergic reaction.' }],
    monitoring: ['Photograph affected skin weekly under consistent lighting — acne progress is very hard to judge from memory'],
    bannedInSport: false,
    sources: [
      'Dalmasso et al., KPV and intestinal inflammation (Gastroenterology, 2008)',
      'Brzoska et al., alpha-MSH peptides in inflammatory skin disease (Endocrine Reviews, 2008)',
    ],
    notes: [
      'If acne is your goal, note that this has far less evidence than standard dermatology treatment. Topical retinoids and benzoyl peroxide have decades of trial data behind them.',
    ],
  },
];
