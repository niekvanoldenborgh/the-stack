import type { InteractionRule } from './types';

/**
 * Pairwise interaction rules.
 *
 * Rules match on either a specific peptide id or a whole class. When
 * `selfPairing` is true, the rule fires for two *different* peptides that both
 * match the same matcher — this is how "don't stack two GHRPs" is expressed.
 *
 * Severity meanings:
 *   critical — the engine refuses to generate this combination and blocks
 *              saving a custom stack without an explicit override.
 *   high     — loud warning; the generator will not produce it on its own.
 *   moderate — worth knowing and planning around.
 *   info     — expected, intentional combination; explains the interaction.
 */
export const INTERACTION_RULES: InteractionRule[] = [
  // -------------------------------------------------------------------------
  // Critical
  // -------------------------------------------------------------------------
  {
    id: 'dual-incretin',
    a: { kind: 'class', value: 'incretin' },
    b: { kind: 'class', value: 'incretin' },
    selfPairing: true,
    severity: 'critical',
    title: 'Two GLP-1 class drugs at once',
    detail:
      'Semaglutide, tirzepatide and retatrutide all act on the same receptor system. Combining them does not double the weight loss — it stacks the gastrointestinal toxicity, sharply raises the risk of severe dehydration and pancreatitis, and makes hypoglycaemia more likely if you also take glucose-lowering medication.',
    guidance:
      'Use one at a time. If you are switching between them, stop one and allow at least 2–3 weeks for it to clear before starting the other at its lowest starting dose — not at the equivalent dose.',
  },
  {
    id: 'igf1-with-secretagogue',
    a: { kind: 'peptide', id: 'igf-1-lr3' },
    b: { kind: 'class', value: 'ghrp_secretagogue' },
    severity: 'critical',
    title: 'Exogenous IGF-1 stacked on top of GH stimulation',
    detail:
      'Growth hormone secretagogues already raise your own IGF-1. Adding IGF-1 LR3 on top produces a combined level nobody has characterised, with hypoglycaemia as the immediate danger and unquantified long-term proliferative risk.',
    guidance:
      'Do not combine these. If you are set on using IGF-1 LR3 despite the warnings, running it alongside anything that raises GH removes any ability to reason about your total IGF-1 exposure.',
  },
  {
    id: 'igf1-with-ghrh',
    a: { kind: 'peptide', id: 'igf-1-lr3' },
    b: { kind: 'class', value: 'ghrh_analog' },
    severity: 'critical',
    title: 'Exogenous IGF-1 stacked on top of GH stimulation',
    detail:
      'Same problem as with secretagogues — GHRH analogues raise endogenous IGF-1, and layering exogenous IGF-1 on top compounds both the hypoglycaemia risk and the total proliferative signal.',
    guidance: 'Do not combine these.',
  },
  {
    id: 'igf1-with-incretin',
    a: { kind: 'peptide', id: 'igf-1-lr3' },
    b: { kind: 'class', value: 'incretin' },
    severity: 'critical',
    title: 'Two compounds that both lower blood glucose',
    detail:
      'IGF-1 LR3 cross-reacts with the insulin receptor and can cause profound hypoglycaemia. GLP-1 drugs suppress appetite and slow gastric emptying, so you eat less and absorb carbohydrate more slowly. Together, correcting a hypo becomes both more likely and harder.',
    guidance:
      'Do not combine. Delayed gastric emptying means even fast-acting carbohydrate works slowly — the usual rescue may not work in time.',
  },
  {
    id: 'igf1-with-hgh',
    a: { kind: 'peptide', id: 'igf-1-lr3' },
    b: { kind: 'peptide', id: 'somatropin' },
    severity: 'critical',
    title: 'Exogenous growth hormone plus exogenous IGF-1',
    detail:
      'Somatropin already drives hepatic IGF-1 production. Adding IGF-1 LR3 stacks a supraphysiological signal on a supraphysiological signal.',
    guidance: 'Do not combine.',
  },

  // -------------------------------------------------------------------------
  // High
  // -------------------------------------------------------------------------
  {
    id: 'dual-ghrp',
    a: { kind: 'class', value: 'ghrp_secretagogue' },
    b: { kind: 'class', value: 'ghrp_secretagogue' },
    selfPairing: true,
    severity: 'high',
    title: 'Two growth hormone releasing peptides',
    detail:
      'GHRPs all act on the same ghrelin receptor. Two of them compete for the same finite pituitary GH reserve, so you get little or no extra GH — but you do get additive cortisol and prolactin elevation, faster receptor desensitisation, and more fluid retention.',
    guidance:
      'Pick one GHRP. If you want more GH release, the productive pairing is a GHRP with a GHRH analogue, which acts on a different receptor.',
  },
  {
    id: 'dual-ghrh',
    a: { kind: 'class', value: 'ghrh_analog' },
    b: { kind: 'class', value: 'ghrh_analog' },
    selfPairing: true,
    severity: 'high',
    title: 'Two GHRH analogues',
    detail:
      'These compete for the same receptor and offer no additive benefit. Combining a long-acting form such as CJC-1295 with DAC and a short-acting form is a common mistake — the long-acting one already keeps the receptor occupied.',
    guidance: 'Use one GHRH analogue at a time.',
  },
  {
    id: 'mk677-with-ghrp',
    a: { kind: 'peptide', id: 'mk-677' },
    b: { kind: 'class', value: 'ghrp_secretagogue' },
    severity: 'high',
    title: 'MK-677 alongside an injectable GHRP',
    detail:
      'MK-677 is itself a ghrelin receptor agonist with roughly 24-hour activity. Adding an injectable GHRP means the receptor is already occupied when you inject, so the extra GH release is minimal — while water retention, appetite and the hit to insulin sensitivity are fully additive.',
    guidance:
      'Choose one. MK-677 saturates the receptor around the clock, which is exactly why it also causes more fluid retention than the injectables.',
  },
  {
    id: 'hgh-with-secretagogue',
    a: { kind: 'peptide', id: 'somatropin' },
    b: { kind: 'class', value: 'ghrp_secretagogue' },
    severity: 'high',
    title: 'Growth hormone plus a GH secretagogue',
    detail:
      'Exogenous somatropin suppresses your own GH production through negative feedback. Stimulating a suppressed pituitary achieves little, while the side effects — fluid retention, carpal tunnel, insulin resistance — add up fully.',
    guidance: 'Redundant. If you are on prescribed somatropin, your prescriber manages the dose; adding secretagogues on top is not a supported strategy.',
  },
  {
    id: 'hgh-with-ghrh',
    a: { kind: 'peptide', id: 'somatropin' },
    b: { kind: 'class', value: 'ghrh_analog' },
    severity: 'high',
    title: 'Growth hormone plus a GHRH analogue',
    detail:
      'GHRH analogues work by stimulating the pituitary. Exogenous GH suppresses the pituitary. The two work against each other.',
    guidance: 'Redundant combination — pick one approach.',
  },
  {
    id: 'mk677-with-incretin',
    a: { kind: 'peptide', id: 'mk-677' },
    b: { kind: 'class', value: 'incretin' },
    severity: 'high',
    title: 'Directly opposing metabolic effects',
    detail:
      'MK-677 raises appetite and reduces insulin sensitivity. GLP-1 drugs suppress appetite and improve it. Beyond cancelling each other out on appetite, the glucose effects are the concern: MK-677 raises fasting glucose, which undermines the main metabolic benefit you are taking the GLP-1 for.',
    guidance:
      'These goals conflict. Decide whether this cycle is for gaining or losing, and drop the other compound.',
  },

  // -------------------------------------------------------------------------
  // Moderate
  // -------------------------------------------------------------------------
  {
    id: 'incretin-with-gh-axis',
    a: { kind: 'class', value: 'incretin' },
    b: { kind: 'class', value: 'ghrh_analog' },
    severity: 'moderate',
    title: 'GLP-1 drug alongside a GH-axis compound',
    detail:
      'GH raises blood glucose; GLP-1 lowers it. The net effect is unpredictable rather than neutral, and it makes interpreting your glucose readings much harder. The GLP-1 also drives lean-mass loss, which works against the reason you are taking the GH-axis compound.',
    guidance:
      'If you run both, monitor fasting glucose and HbA1c closely, keep protein high, and train with resistance. Expect the GH-axis compound to do less than it otherwise would.',
  },
  {
    id: 'incretin-with-ghrp',
    a: { kind: 'class', value: 'incretin' },
    b: { kind: 'class', value: 'ghrp_secretagogue' },
    severity: 'moderate',
    title: 'GLP-1 drug alongside a GH secretagogue',
    detail:
      'Opposing effects on appetite and glucose. GHRP-6 in particular drives strong hunger, which will fight the appetite suppression you are paying for. Delayed gastric emptying from the GLP-1 also affects how you time fasted secretagogue injections.',
    guidance:
      'If combining, prefer a selective secretagogue such as ipamorelin over GHRP-6 or GHRP-2, and monitor glucose.',
  },
  {
    id: 'dual-angiogenic',
    a: { kind: 'class', value: 'healing_repair' },
    b: { kind: 'class', value: 'healing_repair' },
    selfPairing: true,
    severity: 'moderate',
    title: 'Two pro-angiogenic healing peptides',
    detail:
      'BPC-157 and TB-500 are frequently run together and there is no reported adverse interaction. But both work partly by promoting new blood vessel growth, so the theoretical concern about stimulating abnormal tissue is additive rather than independent.',
    guidance:
      'A common and generally well-tolerated pairing. Keep it to a defined rehab block rather than running it continuously, and avoid entirely with any cancer history.',
  },
  {
    id: 'melanocortin-with-angiogenic',
    a: { kind: 'class', value: 'melanocortin' },
    b: { kind: 'class', value: 'healing_repair' },
    severity: 'moderate',
    title: 'Melanotan alongside pro-angiogenic peptides',
    detail:
      'Melanotan II stimulates melanocyte proliferation. Healing peptides promote angiogenesis. Neither is established as carcinogenic, but stimulating both melanocyte growth and new blood supply at the same time compounds a theoretical risk that already warrants dermatological monitoring on its own.',
    guidance: 'Have a skin check before starting, and photograph your moles. Reconsider the combination if you have many naevi.',
  },
  {
    id: 'gh-axis-with-acne-peptide',
    a: { kind: 'class', value: 'ghrp_secretagogue' },
    b: { kind: 'peptide', id: 'kpv' },
    severity: 'moderate',
    title: 'Treating acne while driving IGF-1 up',
    detail:
      'GH secretagogues raise IGF-1, and IGF-1 is one of the strongest drivers of sebum production and acne. Adding an anti-inflammatory peptide to manage the result is treating a problem you are simultaneously causing.',
    guidance:
      'Workable, but understand the order of magnitude — the IGF-1 effect is likely to dominate. If clear skin matters more than the GH-axis benefit, drop the secretagogue instead.',
  },
  {
    id: 'thymic-with-immunosuppression',
    a: { kind: 'class', value: 'thymic_immune' },
    b: { kind: 'class', value: 'thymic_immune' },
    selfPairing: true,
    severity: 'moderate',
    title: 'Two immune-modulating peptides',
    detail:
      'Combined immune stimulation has no established benefit and increases the chance of provoking an autoimmune flare.',
    guidance: 'Use one at a time.',
  },

  // -------------------------------------------------------------------------
  // Informational — expected, intentional pairings
  // -------------------------------------------------------------------------
  {
    id: 'ghrh-plus-ghrp',
    a: { kind: 'class', value: 'ghrh_analog' },
    b: { kind: 'class', value: 'ghrp_secretagogue' },
    severity: 'info',
    title: 'GHRH analogue plus GHRP — the intended synergy',
    detail:
      'This is the standard pairing and it is genuinely synergistic. They act on different receptors: the GHRH analogue increases the amount of GH available to release, while the GHRP triggers the release and suppresses somatostatin, the brake on the system. The combined pulse is larger than either alone.',
    guidance:
      'Inject both in the same syringe, fasted, and wait 20–30 minutes before eating. Because the GH pulse is genuinely larger, the side effects — fluid retention, carpal tunnel, glucose impairment — are also larger than with either compound alone. Start at the low end of both.',
  },
  {
    id: 'topical-stacking',
    a: { kind: 'class', value: 'cosmetic_topical' },
    b: { kind: 'class', value: 'cosmetic_topical' },
    selfPairing: true,
    severity: 'info',
    title: 'Layering topical peptides',
    detail:
      'Topical peptides are generally compatible with each other. The exception is GHK-Cu, which is destabilised by low pH — applying it in the same layer as vitamin C or exfoliating acids inactivates the copper complex and is the usual cause of irritation.',
    guidance:
      'Apply GHK-Cu at night and any acids or vitamin C in the morning. Introduce one new topical at a time so you can tell what caused a reaction.',
  },
];
