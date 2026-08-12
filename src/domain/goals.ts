import type { Goal, GoalId, HealthFlag, HealthFlagMeta, RiskTolerance, RiskToleranceMeta } from './types';

/**
 * The goal set the recommendation engine understands.
 *
 * Each goal carries a `reality` line. This is deliberate: the largest source of
 * harm in peptide use is people chasing an outcome a compound cannot deliver,
 * then escalating the dose when it does not work.
 */
export const GOALS: Goal[] = [
  {
    id: 'lose_fat',
    label: 'Lose fat',
    blurb: 'Reduce body fat while holding on to muscle.',
    icon: '🔥',
    reality:
      'The compounds with real human evidence here are GLP-1 medicines, and they are prescription drugs. They suppress appetite — they do not burn fat directly. Expect to lose lean mass too unless you train and eat enough protein.',
  },
  {
    id: 'gain_weight',
    label: 'Gain weight',
    blurb: 'Increase appetite and overall bodyweight.',
    icon: '📈',
    reality:
      'No peptide adds weight on its own. The ones that help work by making you hungry. If you do not eat in a calorie surplus, nothing happens.',
  },
  {
    id: 'build_muscle',
    label: 'Build muscle',
    blurb: 'Add lean mass and strength.',
    icon: '💪',
    reality:
      'Growth-hormone peptides raise GH and IGF-1, but the muscle effect in healthy trained adults is modest at best — far smaller than the marketing suggests. Training and protein do the heavy lifting.',
  },
  {
    id: 'metabolic_health',
    label: 'Faster metabolism',
    blurb: 'Improve insulin sensitivity and energy expenditure.',
    icon: '⚡',
    reality:
      '"Boosting metabolism" is mostly a myth. What is real is improving insulin sensitivity and body composition. Some GH-axis compounds actually worsen insulin sensitivity, so this goal can conflict with muscle goals.',
  },
  {
    id: 'bone_density',
    label: 'Bone strength',
    blurb: 'Support bone mineral density and joint tissue.',
    icon: '🦴',
    reality:
      'If you are an adult, your growth plates are closed — nothing here will make you taller. What is achievable is improved bone mineral density. The only compounds with strong evidence are prescription osteoporosis drugs.',
  },
  {
    id: 'hair_growth',
    label: 'Hair growth',
    blurb: 'Support hair density and reduce shedding.',
    icon: '💇',
    reality:
      'Peptide evidence for hair is thin and mostly topical. If you have male- or female-pattern hair loss, the treatments with actual trial evidence are minoxidil and 5-alpha-reductase inhibitors — not peptides. Treat peptides as an add-on at best.',
  },
  {
    id: 'acne_control',
    label: 'Acne control',
    blurb: 'Reduce breakouts and inflammatory skin lesions.',
    icon: '✨',
    reality:
      'Peptides are a weak option for acne, and several popular muscle-building peptides make acne worse by raising IGF-1, which drives sebum production. Standard dermatology treatments outperform anything here.',
  },
  {
    id: 'skin_quality',
    label: 'Smooth skin',
    blurb: 'Improve firmness, texture and fine lines.',
    icon: '🧴',
    reality:
      'This is the one area where topical peptides have decent, if modest, evidence. Effects are gradual and cosmetic — measured over months, not weeks.',
  },
  {
    id: 'injury_recovery',
    label: 'Injury recovery',
    blurb: 'Support soft-tissue and tendon healing.',
    icon: '🩹',
    reality:
      'The popular healing peptides have impressive rodent data and essentially no controlled human data. Loading the tissue progressively under a physio has far better evidence than any injection.',
  },
  {
    id: 'sleep_quality',
    label: 'Better sleep',
    blurb: 'Deepen sleep and improve recovery.',
    icon: '🌙',
    reality:
      'Some GH-axis peptides increase slow-wave sleep as a side effect. Dedicated "sleep peptides" have almost no human evidence. Sleep hygiene beats all of them and is free.',
  },
];

export const GOALS_BY_ID: Record<GoalId, Goal> = Object.fromEntries(
  GOALS.map((g) => [g.id, g]),
) as Record<GoalId, Goal>;

/**
 * The risk dial.
 *
 * It moves the dose within each compound's published range and does nothing
 * else. Which compounds you are offered is decided by your goals, your health
 * history and the interaction rules — turning this up does not unlock a
 * riskier catalogue, and turning it down does not hide anything from you.
 *
 * Level 5 targets the published maximum. It cannot go beyond it, because there
 * is no data up there to personalise against.
 */
export const RISK_TOLERANCES: RiskToleranceMeta[] = [
  {
    level: 1,
    label: 'Minimal',
    blurb: 'The lowest dose anyone publishes.',
    effect: 'Targets the bottom of each compound’s published range.',
  },
  {
    level: 2,
    label: 'Cautious',
    blurb: 'Below standard, with room to move up later.',
    effect: 'Sits between the published minimum and the typical dose.',
  },
  {
    level: 3,
    label: 'Balanced',
    blurb: 'Standard protocols at standard doses.',
    effect: 'Targets the typical published dose.',
  },
  {
    level: 4,
    label: 'Assertive',
    blurb: 'Above standard, still inside the published range.',
    effect: 'Sits between the typical dose and the published maximum.',
  },
  {
    level: 5,
    label: 'Maximum',
    blurb: 'The highest dose anyone publishes.',
    effect: 'Targets the top of the published range — never beyond it.',
  },
];

export const RISK_TOLERANCE_BY_LEVEL: Record<RiskTolerance, RiskToleranceMeta> = Object.fromEntries(
  RISK_TOLERANCES.map((r) => [r.level, r]),
) as Record<RiskTolerance, RiskToleranceMeta>;

export const HEALTH_FLAGS: HealthFlagMeta[] = [
  { id: 'under_18', label: 'I am under 18', group: 'absolute' },
  { id: 'pregnant_or_breastfeeding', label: 'Pregnant, trying to conceive, or breastfeeding', group: 'absolute' },
  { id: 'active_cancer', label: 'Active cancer diagnosis', group: 'absolute' },
  { id: 'cancer_history', label: 'History of cancer', group: 'absolute' },
  { id: 'thyroid_cancer_family', label: 'Family history of medullary thyroid cancer', group: 'absolute' },
  { id: 'men2', label: 'Multiple Endocrine Neoplasia type 2 (MEN2)', group: 'absolute' },
  { id: 'melanoma_or_atypical_moles', label: 'Melanoma history or many/atypical moles', group: 'absolute' },

  { id: 'diabetes_t1', label: 'Type 1 diabetes', group: 'metabolic' },
  { id: 'diabetes_t2', label: 'Type 2 diabetes', group: 'metabolic' },
  { id: 'prediabetes', label: 'Prediabetes / insulin resistance', group: 'metabolic' },
  { id: 'pancreatitis_history', label: 'History of pancreatitis', group: 'metabolic' },
  { id: 'gallbladder_disease', label: 'Gallstones or gallbladder disease', group: 'metabolic' },
  { id: 'retinopathy', label: 'Diabetic retinopathy', group: 'metabolic' },

  { id: 'cardiac_disease', label: 'Heart disease or arrhythmia', group: 'cardio_renal' },
  { id: 'hypertension', label: 'High blood pressure', group: 'cardio_renal' },
  { id: 'kidney_disease', label: 'Kidney disease', group: 'cardio_renal' },
  { id: 'liver_disease', label: 'Liver disease', group: 'cardio_renal' },

  { id: 'sleep_apnea', label: 'Sleep apnoea', group: 'other' },
  { id: 'carpal_tunnel', label: 'Carpal tunnel syndrome', group: 'other' },
  { id: 'seizure_disorder', label: 'Seizure disorder', group: 'other' },
  { id: 'eating_disorder_history', label: 'History of disordered eating', group: 'other' },
  { id: 'on_prescription_meds', label: 'Currently taking prescription medication', group: 'other' },
];

export const HEALTH_FLAGS_BY_ID: Record<HealthFlag, HealthFlagMeta> = Object.fromEntries(
  HEALTH_FLAGS.map((f) => [f.id, f]),
) as Record<HealthFlag, HealthFlagMeta>;

/**
 * Goals that pull in opposite directions. Surfaced during onboarding and again
 * on any stack that tries to serve both.
 */
export const GOAL_CONFLICTS: Array<{
  goals: [GoalId, GoalId];
  detail: string;
  guidance: string;
}> = [
  {
    goals: ['build_muscle', 'acne_control'],
    detail:
      'Growth-hormone secretagogues raise IGF-1, and IGF-1 directly stimulates sebaceous glands. Acne is one of the most consistently reported effects of this compound class.',
    guidance:
      'Pick which goal leads. If muscle wins, plan for acne management up front. If skin wins, the engine will drop GH-axis compounds from your stack.',
  },
  {
    goals: ['build_muscle', 'lose_fat'],
    detail:
      'Meaningful muscle gain needs a calorie surplus; fat loss needs a deficit. Chasing both at once usually means doing neither well, and GLP-1 appetite suppression makes hitting protein targets hard.',
    guidance:
      'Unless you are new to training or returning after a break, sequence these instead of stacking them. The engine will bias toward muscle retention rather than growth.',
  },
  {
    goals: ['gain_weight', 'lose_fat'],
    detail: 'These are directly opposed. The engine cannot optimise for both.',
    guidance: 'Choose one as your primary goal for this cycle.',
  },
  {
    goals: ['build_muscle', 'metabolic_health'],
    detail:
      'Growth hormone raises blood glucose and reduces insulin sensitivity. Higher-dose GH-axis use can push a borderline metabolic profile in the wrong direction.',
    guidance:
      'Keep GH-axis doses conservative, take them away from carbohydrate meals, and monitor fasting glucose and HbA1c.',
  },
  {
    goals: ['gain_weight', 'metabolic_health'],
    detail:
      'Appetite-driving compounds add weight, but weight gained without training is largely fat, which worsens insulin sensitivity.',
    guidance: 'Pair with resistance training and keep the surplus modest — roughly 10–15% above maintenance.',
  },
];
