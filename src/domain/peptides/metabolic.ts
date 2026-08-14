import type { Peptide } from '../types';

/**
 * Metabolic / fat-loss compounds.
 *
 * Note the evidence asymmetry in this category: the two compounds that work
 * well (semaglutide, tirzepatide) are prescription medicines with large phase 3
 * programmes, while the ones sold freely on peptide sites have close to no
 * human efficacy data. The app should never let that distinction blur.
 */
export const METABOLIC_PEPTIDES: Peptide[] = [
  {
    id: 'semaglutide',
    name: 'Semaglutide',
    aliases: ['Ozempic', 'Wegovy', 'Rybelsus'],
    classes: ['incretin'],
    legalStatus: 'prescription',
    evidence: 'A',
    summary:
      'GLP-1 receptor agonist. The best-evidenced weight-loss drug in wide use — and a prescription medicine, not a research peptide.',
    mechanism:
      'Mimics GLP-1, an incretin hormone. Slows gastric emptying, acts on hypothalamic appetite centres to increase satiety, and stimulates glucose-dependent insulin release. The result is a large, sustained reduction in food intake.',
    routes: ['subcutaneous'],
    dosing: {
      unit: 'mg',
      basis: 'fixed',
      low: 0.25,
      typical: 1.0,
      high: 2.4,
      hardMax: 2.4,
      titrationWeeks: 16,
      note: 'Weekly injection. Labelled titration is 0.25 mg/week for 4 weeks, then doubling every 4 weeks as tolerated up to 2.4 mg. Escalating faster is the main cause of severe nausea and vomiting.',
    },
    frequency: {
      timesPerDay: 1,
      daysPerWeek: 1,
      fixedDays: [0],
      preferredTimes: ['morning'],
      timingRationale:
        'Half-life is about a week, so the exact time of day is unimportant. Pick one fixed weekday and keep it — consistency matters more than timing.',
    },
    cycle: {
      onWeeks: 52,
      offWeeks: 0,
      maxConsecutiveCycles: null,
      rationale:
        'This is chronic therapy, not a cycle. Trial data show most weight is regained within a year of stopping. Treat discontinuation as a clinical decision, not a scheduled break.',
    },
    goalFit: {
      lose_fat: 5,
      metabolic_health: 5,
      build_muscle: -2,
      gain_weight: -5,
      acne_control: 1,
    },
    sideEffects: [
      { label: 'Nausea', severity: 'moderate', likelihood: 'common', detail: 'Worst in the days after a dose increase. Usually settles within 2–4 weeks at a stable dose.' },
      { label: 'Vomiting and diarrhoea', severity: 'moderate', likelihood: 'common' },
      { label: 'Constipation', severity: 'mild', likelihood: 'common' },
      { label: 'Loss of lean muscle mass', severity: 'moderate', likelihood: 'common', detail: 'Roughly 25–40% of total weight lost can be lean tissue without resistance training and adequate protein.' },
      { label: 'Fatigue and low energy', severity: 'mild', likelihood: 'common', detail: 'Often simply under-eating — appetite suppression can drive intake far below maintenance.' },
      { label: 'Gallstones', severity: 'severe', likelihood: 'uncommon', detail: 'Risk rises with rapid weight loss.' },
      { label: 'Pancreatitis', severity: 'severe', likelihood: 'rare' },
      { label: 'Severe gastroparesis', severity: 'severe', likelihood: 'rare' },
      { label: 'Hair shedding', severity: 'mild', likelihood: 'uncommon', detail: 'Telogen effluvium secondary to rapid weight loss, not a direct drug effect.' },
    ],
    contraindications: [
      { flag: 'thyroid_cancer_family', kind: 'absolute', reason: 'Rodent studies showed dose-dependent thyroid C-cell tumours. Contraindicated on the label with a personal or family history of medullary thyroid carcinoma.' },
      { flag: 'men2', kind: 'absolute', reason: 'Labelled contraindication — MEN2 carries a high medullary thyroid carcinoma risk.' },
      { flag: 'pregnant_or_breastfeeding', kind: 'absolute', reason: 'Foetal harm in animal studies. Should be stopped at least 2 months before a planned pregnancy.' },
      { flag: 'under_18', kind: 'absolute', reason: 'Paediatric use is a specialist prescribing decision, never a self-directed one.' },
      { flag: 'pancreatitis_history', kind: 'relative', reason: 'Prior pancreatitis raises the risk of recurrence; needs a prescriber to weigh it.' },
      { flag: 'diabetes_t1', kind: 'relative', reason: 'Not a substitute for insulin. Combining without dose adjustment risks hypoglycaemia and DKA.' },
      { flag: 'eating_disorder_history', kind: 'relative', reason: 'Powerful appetite suppression can reactivate restrictive patterns. Needs clinical oversight.' },
      { flag: 'gallbladder_disease', kind: 'relative', reason: 'Rapid weight loss increases gallstone formation.' },
      { flag: 'retinopathy', kind: 'relative', reason: 'Rapid improvement in glucose control can transiently worsen diabetic retinopathy. Needs ophthalmology input.' },
    ],
    redFlags: [
      { symptom: 'Severe, persistent abdominal pain, often radiating to the back, with vomiting', action: 'Stop the drug and seek emergency care — this is the pancreatitis presentation.' },
      { symptom: 'A lump in the neck, hoarseness, or trouble swallowing', action: 'Stop and see a doctor urgently for thyroid assessment.' },
      { symptom: 'Unable to keep fluids down for more than 24 hours', action: 'Seek medical care — dehydration on GLP-1s can cause acute kidney injury.' },
    ],
    monitoring: [
      'Baseline and periodic HbA1c and fasting glucose',
      'Kidney function if you have vomiting or diarrhoea',
      'Bodyweight plus a lean-mass proxy (waist, strength numbers) — not scale weight alone',
      'Protein intake of at least 1.6 g per kg bodyweight to blunt lean-mass loss',
    ],
    bannedInSport: false,
    sources: [
      'FDA prescribing information — Wegovy and Ozempic (semaglutide)',
      'STEP randomised trial programme, published in NEJM and JAMA (2021–2023)',
      'SELECT cardiovascular outcomes trial (2023)',
    ],
    notes: [
      'Compounded and grey-market "semaglutide" is a recurring source of dosing errors — several poisoning clusters have come from users measuring units on an insulin syringe instead of milligrams.',
      'Muscle loss is the main avoidable harm. Resistance training plus high protein is not optional on this drug.',
    ],
    // THEA-6 §1.1. ka fixed from clinical-pharmacology data; CL/F and V/F are
    // popPK estimates at the 85 kg reference; weight exponent is derived from
    // the paper's reported exposure differences (MED-SIGNOFF-2, accepted).
    pk: {
      kind: 'one_compartment_first_order',
      ka: 0.0286,
      clRef: 0.0478,
      vd: 12.2,
      refWeightKg: 85,
      weightExponent: 0.78,
    },
  },

  {
    id: 'tirzepatide',
    name: 'Tirzepatide',
    aliases: ['Mounjaro', 'Zepbound'],
    classes: ['incretin'],
    legalStatus: 'prescription',
    evidence: 'A',
    summary:
      'Dual GIP and GLP-1 receptor agonist. Produces larger average weight loss than semaglutide in head-to-head trials. Prescription only.',
    mechanism:
      'Activates both the GIP and GLP-1 receptors. The GIP component appears to improve tolerability and add metabolic benefit beyond GLP-1 activation alone.',
    routes: ['subcutaneous'],
    dosing: {
      unit: 'mg',
      basis: 'fixed',
      low: 2.5,
      typical: 7.5,
      high: 15,
      hardMax: 15,
      titrationWeeks: 20,
      note: 'Weekly injection. 2.5 mg/week for 4 weeks, then 2.5 mg increments no more often than every 4 weeks, to a maximum of 15 mg.',
    },
    frequency: {
      timesPerDay: 1,
      daysPerWeek: 1,
      fixedDays: [0],
      preferredTimes: ['morning'],
      timingRationale: 'Weekly dosing with a ~5 day half-life. Fix the weekday and keep it consistent.',
    },
    cycle: {
      onWeeks: 52,
      offWeeks: 0,
      maxConsecutiveCycles: null,
      rationale: 'Chronic therapy. As with semaglutide, weight is regained after discontinuation.',
    },
    goalFit: {
      lose_fat: 5,
      metabolic_health: 5,
      build_muscle: -2,
      gain_weight: -5,
    },
    sideEffects: [
      { label: 'Nausea', severity: 'moderate', likelihood: 'common' },
      { label: 'Diarrhoea, vomiting, constipation', severity: 'moderate', likelihood: 'common' },
      { label: 'Loss of lean muscle mass', severity: 'moderate', likelihood: 'common' },
      { label: 'Injection-site reactions', severity: 'mild', likelihood: 'uncommon' },
      { label: 'Gallstones', severity: 'severe', likelihood: 'uncommon' },
      { label: 'Pancreatitis', severity: 'severe', likelihood: 'rare' },
    ],
    contraindications: [
      { flag: 'thyroid_cancer_family', kind: 'absolute', reason: 'Same C-cell tumour signal and labelled contraindication as other incretin drugs.' },
      { flag: 'men2', kind: 'absolute', reason: 'Labelled contraindication.' },
      { flag: 'pregnant_or_breastfeeding', kind: 'absolute', reason: 'Not established as safe; also reduces oral contraceptive absorption around dose escalation.' },
      { flag: 'under_18', kind: 'absolute', reason: 'Specialist prescribing decision only.' },
      { flag: 'pancreatitis_history', kind: 'relative', reason: 'Increased recurrence risk.' },
      { flag: 'diabetes_t1', kind: 'relative', reason: 'Not a replacement for insulin.' },
      { flag: 'eating_disorder_history', kind: 'relative', reason: 'Strong appetite suppression needs oversight.' },
      { flag: 'gallbladder_disease', kind: 'relative', reason: 'Rapid weight loss raises gallstone risk.' },
      { flag: 'retinopathy', kind: 'relative', reason: 'Rapid glycaemic improvement can transiently worsen retinopathy.' },
    ],
    redFlags: [
      { symptom: 'Severe persistent abdominal pain radiating to the back', action: 'Stop and seek emergency care — possible pancreatitis.' },
      { symptom: 'Neck lump, hoarseness or difficulty swallowing', action: 'Stop and get urgent thyroid assessment.' },
    ],
    monitoring: [
      'HbA1c and fasting glucose',
      'Protein intake and resistance training to protect lean mass',
      'Note that tirzepatide can reduce oral contraceptive absorption — a barrier method is advised for 4 weeks after each dose increase',
    ],
    bannedInSport: false,
    sources: [
      'FDA prescribing information — Mounjaro and Zepbound (tirzepatide)',
      'SURMOUNT-1 through SURMOUNT-4 trials (NEJM, 2022–2024)',
      'SURPASS head-to-head programme versus semaglutide',
    ],
    // THEA-6 §1.2. True (not apparent) parameters at the 70 kg reference — `f`
    // must be applied explicitly. Fat-mass-fraction covariate on Vd is omitted
    // per MED-SIGNOFF-3 (accepted: omit and disclose).
    pk: {
      kind: 'two_compartment_first_order',
      ka: 0.0373,
      f: 0.8,
      clRef: 0.0329,
      qRef: 0.126,
      vcRef: 2.47,
      vpRef: 3.98,
      refWeightKg: 70,
      clExponent: 0.8,
      volExponent: 1.0,
    },
  },

  {
    id: 'retatrutide',
    name: 'Retatrutide',
    aliases: ['LY3437943', 'Reta'],
    classes: ['incretin'],
    legalStatus: 'research_chemical',
    evidence: 'B',
    summary:
      'Investigational triple agonist (GIP, GLP-1 and glucagon receptors). Phase 2 results were striking, but it is not approved anywhere — everything sold online is unregulated.',
    mechanism:
      'Adds glucagon receptor agonism to the dual-incretin mechanism, which raises energy expenditure on top of appetite suppression.',
    routes: ['subcutaneous'],
    dosing: {
      unit: 'mg',
      basis: 'fixed',
      low: 1,
      typical: 4,
      high: 8,
      hardMax: 12,
      titrationWeeks: 20,
      note: 'Phase 2 trials used weekly doses from 1 mg up to 12 mg with slow escalation. These are trial figures given for context only — there is no approved regimen, and grey-market vials are not dose-verified.',
    },
    frequency: {
      timesPerDay: 1,
      daysPerWeek: 1,
      fixedDays: [0],
      preferredTimes: ['morning'],
      timingRationale: 'Weekly dosing; fix the weekday.',
    },
    cycle: {
      onWeeks: 36,
      offWeeks: 0,
      maxConsecutiveCycles: null,
      rationale: 'Trials ran continuously for 36–48 weeks. There is no established cycling protocol.',
    },
    goalFit: {
      lose_fat: 5,
      metabolic_health: 4,
      build_muscle: -2,
      gain_weight: -5,
    },
    sideEffects: [
      { label: 'Nausea and vomiting', severity: 'moderate', likelihood: 'common', detail: 'Dose-limiting in trials; more pronounced than with GLP-1-only drugs.' },
      { label: 'Increased heart rate', severity: 'moderate', likelihood: 'common', detail: 'The glucagon component raised resting heart rate by roughly 5–10 bpm in trials.' },
      { label: 'Loss of lean muscle mass', severity: 'moderate', likelihood: 'common' },
      { label: 'Raised blood glucose at higher doses', severity: 'moderate', likelihood: 'uncommon', detail: 'Glucagon agonism can oppose glycaemic control in some people.' },
      { label: 'Unknown long-term effects', severity: 'severe', likelihood: 'common', detail: 'No long-term safety data exist. This is the defining risk of the compound.' },
    ],
    contraindications: [
      { flag: 'thyroid_cancer_family', kind: 'absolute', reason: 'Same C-cell tumour concern as the drug class.' },
      { flag: 'men2', kind: 'absolute', reason: 'Class contraindication.' },
      { flag: 'pregnant_or_breastfeeding', kind: 'absolute', reason: 'No safety data.' },
      { flag: 'under_18', kind: 'absolute', reason: 'No paediatric data whatsoever.' },
      { flag: 'cardiac_disease', kind: 'absolute', reason: 'The sustained heart-rate increase from glucagon agonism is not safe to self-administer with existing cardiac disease.' },
      { flag: 'pancreatitis_history', kind: 'relative', reason: 'Class risk.' },
      { flag: 'diabetes_t1', kind: 'relative', reason: 'Glucagon agonism can raise glucose unpredictably.' },
      { flag: 'eating_disorder_history', kind: 'relative', reason: 'Very strong appetite suppression.' },
    ],
    redFlags: [
      { symptom: 'Resting heart rate persistently above 100 bpm, palpitations, or chest pain', action: 'Stop and seek medical assessment.' },
      { symptom: 'Severe abdominal pain radiating to the back', action: 'Emergency care — possible pancreatitis.' },
    ],
    monitoring: [
      'Resting heart rate, daily during escalation',
      'Fasting glucose and HbA1c — glucagon agonism can push these up',
      'Blood pressure',
    ],
    bannedInSport: false,
    sources: [
      'Jastreboff et al., phase 2 retatrutide obesity trial (NEJM, 2023)',
      'Rosenstock et al., phase 2 retatrutide type 2 diabetes trial (Lancet, 2023)',
    ],
    notes: [
      'Because it is unapproved, every source is a grey-market reconstitution. Vial contents are frequently mislabelled — assume the concentration on the label may be wrong.',
    ],
  },

  {
    id: 'tesamorelin',
    name: 'Tesamorelin',
    aliases: ['Egrifta'],
    classes: ['ghrh_analog'],
    legalStatus: 'prescription',
    evidence: 'A',
    summary:
      'Stabilised GHRH analogue, approved to reduce visceral fat in HIV-associated lipodystrophy. The only GH-axis peptide with a real approved indication for fat reduction.',
    mechanism:
      'Binds GHRH receptors in the pituitary, increasing the amplitude of natural pulsatile growth hormone release. Preserves physiological pulsing rather than flooding the system the way exogenous HGH does.',
    routes: ['subcutaneous'],
    dosing: {
      unit: 'mg',
      basis: 'fixed',
      low: 1,
      typical: 2,
      high: 2,
      hardMax: 2,
      titrationWeeks: 2,
      note: 'The approved dose is a flat 2 mg once daily. It does not scale with bodyweight.',
    },
    frequency: {
      timesPerDay: 1,
      daysPerWeek: 7,
      preferredTimes: ['bedtime'],
      timingRationale:
        'Taken at bedtime on an empty stomach so it lands with the largest natural GH pulse of the night. Food — particularly carbohydrate — blunts the pulse.',
    },
    cycle: {
      onWeeks: 26,
      offWeeks: 4,
      maxConsecutiveCycles: 2,
      rationale:
        'Trials ran 26–52 weeks continuously. Visceral fat returns after stopping. Breaks are used in practice to reassess glucose tolerance rather than to prevent receptor desensitisation.',
    },
    goalFit: {
      lose_fat: 4,
      metabolic_health: 2,
      build_muscle: 2,
      sleep_quality: 3,
      injury_recovery: 2,
      bone_density: 2,
      acne_control: -2,
    },
    sideEffects: [
      { label: 'Joint pain and stiffness', severity: 'mild', likelihood: 'common' },
      { label: 'Fluid retention and swelling', severity: 'mild', likelihood: 'common' },
      { label: 'Injection-site redness and itching', severity: 'mild', likelihood: 'common' },
      { label: 'Reduced insulin sensitivity', severity: 'moderate', likelihood: 'common', detail: 'Growth hormone raises blood glucose. This is the main metabolic trade-off of the whole GH-axis class.' },
      { label: 'Carpal tunnel symptoms', severity: 'moderate', likelihood: 'uncommon', detail: 'Numbness or tingling in the hands from fluid retention compressing the median nerve.' },
      { label: 'Acne and oily skin', severity: 'mild', likelihood: 'uncommon', detail: 'Driven by raised IGF-1.' },
    ],
    contraindications: [
      { flag: 'active_cancer', kind: 'absolute', reason: 'Growth hormone and IGF-1 are mitogenic. Raising them with an active malignancy is contraindicated.' },
      { flag: 'pregnant_or_breastfeeding', kind: 'absolute', reason: 'Labelled contraindication.' },
      { flag: 'under_18', kind: 'absolute', reason: 'Interferes with the developing GH axis and growth plates.' },
      { flag: 'cancer_history', kind: 'relative', reason: 'Needs oncology clearance before raising IGF-1.' },
      { flag: 'diabetes_t2', kind: 'relative', reason: 'Will worsen glycaemic control; requires monitoring and possibly medication adjustment.' },
      { flag: 'prediabetes', kind: 'relative', reason: 'Can tip borderline insulin resistance into overt dysglycaemia.' },
      { flag: 'retinopathy', kind: 'relative', reason: 'Proliferative retinopathy is a labelled caution for GH-axis therapy.' },
      { flag: 'carpal_tunnel', kind: 'relative', reason: 'Fluid retention reliably worsens existing carpal tunnel syndrome.' },
    ],
    redFlags: [
      { symptom: 'Persistent numbness or weakness in the hands', action: 'Reduce dose or stop and get assessed — untreated nerve compression can cause lasting damage.' },
      { symptom: 'Excessive thirst, frequent urination, blurred vision', action: 'Check blood glucose — these are hyperglycaemia symptoms.' },
    ],
    monitoring: ['Fasting glucose and HbA1c at baseline, 3 months, then 6-monthly', 'IGF-1 level to keep within the age-appropriate range', 'Waist circumference as the primary efficacy measure'],
    bannedInSport: true,
    sources: [
      'FDA prescribing information — Egrifta (tesamorelin)',
      'Falutz et al., phase 3 tesamorelin trials in HIV lipodystrophy (NEJM, 2007; JAIDS, 2010)',
    ],
    notes: [
      'Approved specifically for visceral (deep abdominal) fat. It does not meaningfully reduce subcutaneous fat, so it will not change how lean your arms or legs look.',
    ],
  },

  {
    id: 'aod-9604',
    name: 'AOD-9604',
    aliases: ['hGH fragment 176-191'],
    classes: ['metabolic_oral'],
    legalStatus: 'research_chemical',
    evidence: 'C',
    summary:
      'A fragment of the growth hormone molecule marketed as a fat burner. It went through human obesity trials and failed to beat placebo.',
    mechanism:
      'Corresponds to the C-terminal fragment of hGH claimed to carry its lipolytic action without the effects on blood glucose. The mechanism holds up in fat cells in vitro; it has not translated to humans.',
    routes: ['subcutaneous'],
    dosing: {
      unit: 'mcg',
      basis: 'fixed',
      low: 250,
      typical: 300,
      high: 500,
      hardMax: 600,
      titrationWeeks: 0,
      note: 'Community protocols use 250–500 mcg daily, usually fasted. Be aware you are dosing a compound that did not separate from placebo in its own phase 2 trial.',
    },
    frequency: {
      timesPerDay: 1,
      daysPerWeek: 7,
      preferredTimes: ['waking'],
      timingRationale: 'Taken fasted on waking, on the theory that low insulin favours fat mobilisation.',
    },
    cycle: {
      onWeeks: 12,
      offWeeks: 4,
      maxConsecutiveCycles: 3,
      rationale: 'No established cycle. 12 weeks reflects the length of the human trials.',
    },
    goalFit: {
      lose_fat: 1,
      metabolic_health: 1,
      injury_recovery: 1,
    },
    sideEffects: [
      { label: 'Injection-site irritation', severity: 'mild', likelihood: 'common' },
      { label: 'Headache', severity: 'mild', likelihood: 'uncommon' },
      { label: 'No meaningful effect', severity: 'mild', likelihood: 'common', detail: 'The most likely outcome, based on the trial data. Listed as an effect because wasted money and delayed real treatment are real costs.' },
    ],
    contraindications: [
      { flag: 'pregnant_or_breastfeeding', kind: 'absolute', reason: 'No safety data.' },
      { flag: 'under_18', kind: 'absolute', reason: 'No safety data.' },
    ],
    redFlags: [{ symptom: 'Spreading redness, warmth or pus at an injection site', action: 'Seek medical care — that is cellulitis, not irritation.' }],
    monitoring: ['Nothing specific. Judge it on results and stop if there are none.'],
    bannedInSport: false,
    sources: [
      'Heffernan et al., metabolic effects of hGH fragment AOD-9604 (Journal of Endocrinology, 2001)',
      'Phase 2b obesity trial reported by Metabolic Pharmaceuticals (2007) — no significant weight loss versus placebo',
    ],
    notes: ['Widely sold with strong fat-loss marketing. The honest summary is that it has one of the weakest efficacy records of anything in this app.'],
  },

  {
    id: 'mots-c',
    name: 'MOTS-c',
    aliases: ['Mitochondrial ORF of the 12S rRNA type-c'],
    classes: ['mitochondrial'],
    legalStatus: 'research_chemical',
    evidence: 'C',
    summary:
      'Mitochondria-derived peptide studied for insulin sensitivity and exercise capacity. Rodent data are genuinely interesting; human data are essentially absent.',
    mechanism:
      'Regulates the folate–methionine cycle, activating AMPK. In mice this improves insulin sensitivity and exercise capacity and resists diet-induced obesity.',
    routes: ['subcutaneous'],
    dosing: {
      unit: 'mg',
      basis: 'fixed',
      low: 5,
      typical: 10,
      high: 10,
      hardMax: 15,
      titrationWeeks: 0,
      note: 'Community protocols use 5–10 mg, two or three times weekly. There is no human dose-finding study — these numbers are extrapolated from rodent work.',
    },
    frequency: {
      timesPerDay: 1,
      daysPerWeek: 3,
      fixedDays: [0, 2, 4],
      preferredTimes: ['morning'],
      timingRationale: 'Morning dosing on non-consecutive days is the common pattern; there is no evidence favouring any particular timing.',
    },
    cycle: {
      onWeeks: 8,
      offWeeks: 4,
      maxConsecutiveCycles: 3,
      rationale: 'Arbitrary but conservative — limiting exposure is sensible when long-term human safety is unknown.',
    },
    goalFit: {
      metabolic_health: 3,
      lose_fat: 2,
      injury_recovery: 1,
    },
    sideEffects: [
      { label: 'Injection-site reactions', severity: 'mild', likelihood: 'common' },
      { label: 'Flushing', severity: 'mild', likelihood: 'uncommon' },
      { label: 'Unknown long-term profile', severity: 'moderate', likelihood: 'common', detail: 'No human safety data of any length.' },
    ],
    contraindications: [
      { flag: 'pregnant_or_breastfeeding', kind: 'absolute', reason: 'No data.' },
      { flag: 'under_18', kind: 'absolute', reason: 'No data.' },
      { flag: 'active_cancer', kind: 'relative', reason: 'AMPK modulation has context-dependent effects on tumour metabolism; avoid without oncology input.' },
    ],
    redFlags: [{ symptom: 'Any unexplained systemic reaction after injection', action: 'Stop and seek medical assessment.' }],
    monitoring: ['Fasting glucose and HbA1c if you are using it for metabolic goals — otherwise you have no way to know if it is working'],
    bannedInSport: true,
    sources: [
      'Lee et al., MOTS-c regulates metabolic homeostasis (Cell Metabolism, 2015)',
      'Reynolds et al., MOTS-c and exercise capacity in mice (Nature Communications, 2021)',
    ],
  },

  {
    id: '5-amino-1mq',
    name: '5-Amino-1MQ',
    aliases: ['5-amino-1-methylquinolinium'],
    classes: ['metabolic_oral'],
    legalStatus: 'research_chemical',
    evidence: 'C',
    summary:
      'An orally active small molecule (not actually a peptide) sold alongside them. Inhibits NNMT, an enzyme involved in fat cell metabolism. Rodent data only.',
    mechanism:
      'Blocks nicotinamide N-methyltransferase in adipose tissue, which raises cellular NAD+ and, in obese mice, shrinks fat cells and reduces body weight without changing food intake.',
    routes: ['oral'],
    dosing: {
      unit: 'mg',
      basis: 'fixed',
      low: 50,
      typical: 100,
      high: 150,
      hardMax: 150,
      titrationWeeks: 1,
      note: 'Capsules are typically 50–150 mg once daily. No human pharmacokinetic study exists, so absorption and appropriate dosing are genuinely unknown.',
    },
    frequency: {
      timesPerDay: 1,
      daysPerWeek: 7,
      preferredTimes: ['morning'],
      timingRationale: 'Morning dosing is conventional. Some users report it disturbs sleep if taken late.',
    },
    cycle: {
      onWeeks: 8,
      offWeeks: 4,
      maxConsecutiveCycles: 3,
      rationale: 'Conservative limit given the absence of human safety data.',
    },
    goalFit: {
      lose_fat: 2,
      metabolic_health: 2,
    },
    sideEffects: [
      { label: 'Insomnia if taken late in the day', severity: 'mild', likelihood: 'uncommon' },
      { label: 'Nausea', severity: 'mild', likelihood: 'uncommon' },
      { label: 'Unknown long-term profile', severity: 'moderate', likelihood: 'common', detail: 'NNMT is expressed in the liver as well as fat tissue; the consequences of chronic inhibition in humans are not characterised.' },
    ],
    contraindications: [
      { flag: 'pregnant_or_breastfeeding', kind: 'absolute', reason: 'No data.' },
      { flag: 'under_18', kind: 'absolute', reason: 'No data.' },
      { flag: 'liver_disease', kind: 'relative', reason: 'NNMT is highly expressed in the liver and the effect of inhibiting it in liver disease is unstudied.' },
    ],
    redFlags: [{ symptom: 'Yellowing of the skin or eyes, dark urine, right-sided abdominal pain', action: 'Stop and get liver function tested.' }],
    monitoring: ['Liver function tests if used beyond a few weeks'],
    bannedInSport: false,
    sources: ['Neelakantan et al., NNMT inhibitor 5-amino-1MQ in diet-induced obese mice (Biochemical Pharmacology, 2018)'],
    notes: ['Sold as a peptide but it is a small-molecule enzyme inhibitor. The distinction matters because it is orally absorbed and metabolised by the liver.'],
  },
];
