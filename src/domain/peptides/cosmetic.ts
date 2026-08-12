import type { Peptide } from '../types';

/**
 * Skin, hair, pigmentation and sleep compounds.
 *
 * This is the one category where the risk/benefit ratio is often reasonable —
 * because most of it is topical and therefore barely absorbed systemically.
 * The exception is Melanotan II, which is the highest-risk cosmetic compound
 * in the app by a wide margin.
 */
export const COSMETIC_PEPTIDES: Peptide[] = [
  {
    id: 'ghk-cu',
    name: 'GHK-Cu',
    aliases: ['Copper Tripeptide-1', 'Copper peptide'],
    classes: ['cosmetic_topical', 'healing_repair'],
    legalStatus: 'cosmetic_otc',
    evidence: 'B',
    summary:
      'A copper-binding tripeptide with the best evidence of any peptide for skin quality. Well established topically; the injectable form is a different and less justified proposition.',
    mechanism:
      'Naturally present in plasma and declines with age. Binds copper and delivers it into cells, stimulating collagen and glycosaminoglycan synthesis, modulating matrix metalloproteinases, and promoting wound repair and angiogenesis.',
    routes: ['topical', 'subcutaneous'],
    dosing: {
      unit: 'pct',
      basis: 'fixed',
      low: 0.5,
      typical: 2,
      high: 3,
      hardMax: 3,
      titrationWeeks: 2,
      note: 'Topical serums are typically 1–3% GHK-Cu. Start lower and build up — copper peptides can irritate, and stacking them with strong acids or retinoids in the same routine is the usual cause.',
    },
    frequency: {
      timesPerDay: 1,
      daysPerWeek: 7,
      preferredTimes: ['evening'],
      timingRationale:
        'Applied to clean skin, usually at night. Keep it away from vitamin C and exfoliating acids in the same application — low pH destabilises the copper complex.',
    },
    cycle: {
      onWeeks: 24,
      offWeeks: 0,
      maxConsecutiveCycles: null,
      rationale:
        'Topical use is continuous and does not require cycling. Visible changes take 8–12 weeks; judging it earlier than that is judging noise.',
    },
    goalFit: {
      skin_quality: 5,
      hair_growth: 3,
      injury_recovery: 2,
      acne_control: 1,
    },
    sideEffects: [
      { label: 'Skin irritation or redness', severity: 'mild', likelihood: 'common', detail: 'Usually from combining it with retinoids or acids in the same routine.' },
      { label: 'Temporary blue-green tint on application', severity: 'mild', likelihood: 'common', detail: 'That is the copper. It is cosmetic and washes off.' },
      { label: 'Contact dermatitis', severity: 'moderate', likelihood: 'uncommon' },
      { label: 'Copper accumulation with high-dose injected use', severity: 'severe', likelihood: 'rare', detail: 'Only a concern for injected use, not topical.' },
    ],
    contraindications: [
      { flag: 'pregnant_or_breastfeeding', kind: 'relative', reason: 'Topical use is generally considered low risk, but injected use has no safety data. Discuss with your doctor.' },
      { flag: 'liver_disease', kind: 'relative', reason: 'Copper is handled by the liver. Relevant only for injected use, and contraindicated in Wilson\'s disease.' },
    ],
    redFlags: [{ symptom: 'Spreading rash, blistering, or swelling', action: 'Stop applying and see a doctor — that is contact dermatitis, not an adjustment period.' }],
    monitoring: ['Standardised photographs every 4 weeks — same light, same angle, no filters. Skin changes are gradual and memory is unreliable.'],
    bannedInSport: false,
    sources: [
      'Pickart & Margolina, GHK-Cu biological actions review (International Journal of Molecular Sciences, 2018)',
      'Finkey et al., copper peptide and skin fine-line clinical studies (cosmetic dermatology literature)',
    ],
    notes: ['Topical and injected GHK-Cu are effectively different products in terms of risk. The topical evidence does not transfer to the injectable.'],
  },

  {
    id: 'matrixyl',
    name: 'Matrixyl (Palmitoyl Pentapeptide-4)',
    aliases: ['Pal-KTTKS', 'Matrixyl 3000'],
    classes: ['cosmetic_topical'],
    legalStatus: 'cosmetic_otc',
    evidence: 'B',
    summary:
      'A collagen-signalling peptide used in mainstream anti-ageing skincare. Modest, real, and about as low-risk as anything in this app.',
    mechanism:
      'A fragment of type I collagen attached to a palmitoyl chain that lets it cross the skin barrier. The fragment signals to fibroblasts as if collagen has been broken down, prompting new collagen and fibronectin synthesis.',
    routes: ['topical'],
    dosing: {
      unit: 'pct',
      basis: 'fixed',
      low: 2,
      typical: 4,
      high: 8,
      hardMax: 10,
      titrationWeeks: 0,
      note: 'Serums typically contain 3–8% of the trade solution, which corresponds to a much smaller percentage of actual peptide. Higher is not better past this range.',
    },
    frequency: {
      timesPerDay: 2,
      daysPerWeek: 7,
      preferredTimes: ['morning', 'evening'],
      timingRationale: 'Applied morning and night to clean skin, before heavier creams. Compatible with most routines including retinoids.',
    },
    cycle: {
      onWeeks: 24,
      offWeeks: 0,
      maxConsecutiveCycles: null,
      rationale: 'Continuous topical use. Clinical studies ran 12 weeks before measurable change in wrinkle depth.',
    },
    goalFit: {
      skin_quality: 4,
    },
    sideEffects: [
      { label: 'Mild irritation', severity: 'mild', likelihood: 'rare' },
      { label: 'Slower and smaller effect than retinoids', severity: 'mild', likelihood: 'common', detail: 'Worth knowing before you spend money — tretinoin has substantially stronger evidence for the same goal.' },
    ],
    contraindications: [],
    redFlags: [{ symptom: 'Persistent rash or burning', action: 'Discontinue and consider patch testing.' }],
    monitoring: ['Standardised photographs every 4 weeks'],
    bannedInSport: false,
    sources: [
      'Robinson et al., topical palmitoyl pentapeptide and photoaged skin, double-blind trial (International Journal of Cosmetic Science, 2005)',
      'Katayama et al., collagen fragment KTTKS stimulation of matrix synthesis (Journal of Biological Chemistry, 1993)',
    ],
  },

  {
    id: 'argireline',
    name: 'Argireline (Acetyl Hexapeptide-8)',
    aliases: ['Acetyl Hexapeptide-3', 'Argireline'],
    classes: ['cosmetic_topical'],
    legalStatus: 'cosmetic_otc',
    evidence: 'B',
    summary:
      'Marketed as "topical Botox". It does mildly soften expression lines — the comparison to injectable botulinum toxin is marketing, not pharmacology.',
    mechanism:
      'Mimics the N-terminal end of SNAP-25, competing with it in the SNARE complex and modestly reducing neurotransmitter release at the neuromuscular junction. The effect is far weaker than botulinum toxin and largely limited to the skin surface.',
    routes: ['topical'],
    dosing: {
      unit: 'pct',
      basis: 'fixed',
      low: 5,
      typical: 10,
      high: 10,
      hardMax: 10,
      titrationWeeks: 0,
      note: 'Studies used 10% of the trade solution. Products below about 5% are unlikely to do anything measurable.',
    },
    frequency: {
      timesPerDay: 2,
      daysPerWeek: 7,
      preferredTimes: ['morning', 'evening'],
      timingRationale: 'Twice daily to areas with expression lines — forehead and around the eyes.',
    },
    cycle: {
      onWeeks: 24,
      offWeeks: 0,
      maxConsecutiveCycles: null,
      rationale: 'Continuous use; effects reverse when stopped.',
    },
    goalFit: {
      skin_quality: 3,
    },
    sideEffects: [
      { label: 'Mild irritation or dryness', severity: 'mild', likelihood: 'uncommon' },
      { label: 'Effect much smaller than marketing implies', severity: 'mild', likelihood: 'common' },
    ],
    contraindications: [],
    redFlags: [{ symptom: 'Persistent rash or burning', action: 'Discontinue.' }],
    monitoring: ['Standardised photographs every 4 weeks'],
    bannedInSport: false,
    sources: [
      'Blanes-Mira et al., acetyl hexapeptide-8 and wrinkle depth (International Journal of Cosmetic Science, 2002)',
    ],
  },

  {
    id: 'zinc-thymulin',
    name: 'Zinc Thymulin',
    aliases: ['Thymulin-Zn'],
    classes: ['cosmetic_topical', 'thymic_immune'],
    legalStatus: 'research_chemical',
    evidence: 'C',
    summary:
      'A topical hair-loss peptide with one small human pilot study. Occasionally compounded into minoxidil solutions.',
    mechanism:
      'A zinc-dependent thymic peptide that appears to prolong the anagen (growth) phase of the hair cycle and reduce follicular miniaturisation.',
    routes: ['topical'],
    dosing: {
      unit: 'pct',
      basis: 'fixed',
      low: 0.1,
      typical: 0.2,
      high: 0.3,
      hardMax: 0.5,
      titrationWeeks: 0,
      note: 'Applied as a scalp solution, typically around 0.1–0.3%. Dosing conventions come from a single small pilot study.',
    },
    frequency: {
      timesPerDay: 1,
      daysPerWeek: 7,
      preferredTimes: ['bedtime'],
      timingRationale: 'Applied to a dry scalp at night and left on. Hair cycle changes take at least 4 months to become visible.',
    },
    cycle: {
      onWeeks: 24,
      offWeeks: 0,
      maxConsecutiveCycles: null,
      rationale: 'Hair treatments are continuous. Any gains are lost within months of stopping.',
    },
    goalFit: {
      hair_growth: 3,
    },
    sideEffects: [
      { label: 'Scalp irritation', severity: 'mild', likelihood: 'uncommon' },
      { label: 'Initial increased shedding', severity: 'mild', likelihood: 'uncommon', detail: 'Common to most hair treatments as follicles synchronise into a new cycle. Usually settles by week 8.' },
    ],
    contraindications: [
      { flag: 'under_18', kind: 'absolute', reason: 'An unapproved compound with a single small pilot study behind it. Not appropriate for anyone still developing.' },
      { flag: 'pregnant_or_breastfeeding', kind: 'relative', reason: 'No safety data; discuss with your doctor.' },
    ],
    redFlags: [{ symptom: 'Severe scalp inflammation or spreading rash', action: 'Stop and see a doctor.' }],
    monitoring: ['Fixed-position scalp photographs every 8 weeks under consistent lighting', 'Hair counts if you can be systematic about it'],
    bannedInSport: false,
    sources: ['Rushton et al., zinc thymulin scalp solution pilot study in androgenetic alopecia (2015)'],
    notes: [
      'If you have pattern hair loss, minoxidil and 5-alpha-reductase inhibitors have vastly more evidence. Treat this as an addition to those, not a replacement.',
    ],
  },

  {
    id: 'ptd-dbm',
    name: 'PTD-DBM',
    aliases: ['Protein Transduction Domain - Dishevelled Binding Motif'],
    classes: ['cosmetic_topical'],
    legalStatus: 'research_chemical',
    evidence: 'C',
    summary:
      'A topical peptide targeting the Wnt pathway for hair regrowth. Mouse data plus one widely circulated study; no controlled human trial.',
    mechanism:
      'Blocks the interaction between CXXC5 and Dishevelled, releasing a brake on Wnt/β-catenin signalling in the hair follicle. Wnt activation is required for follicle regeneration.',
    routes: ['topical'],
    dosing: {
      unit: 'pct',
      basis: 'fixed',
      low: 0.5,
      typical: 1,
      high: 1,
      hardMax: 2,
      titrationWeeks: 0,
      note: 'Applied as a roughly 1% scalp solution, commonly alongside valproic acid in community protocols. There is no established human dose.',
    },
    frequency: {
      timesPerDay: 1,
      daysPerWeek: 7,
      preferredTimes: ['bedtime'],
      timingRationale: 'Nightly application to a dry scalp.',
    },
    cycle: {
      onWeeks: 16,
      offWeeks: 4,
      maxConsecutiveCycles: 3,
      rationale: 'No established protocol. Hair cycle effects need at least 16 weeks to assess.',
    },
    goalFit: {
      hair_growth: 2,
    },
    sideEffects: [
      { label: 'Scalp irritation', severity: 'mild', likelihood: 'uncommon' },
      { label: 'Unknown systemic absorption', severity: 'moderate', likelihood: 'common', detail: 'The protein transduction domain exists specifically to help it cross membranes, so assuming it stays local is optimistic.' },
      { label: 'Wnt pathway modulation is not tissue-specific', severity: 'moderate', likelihood: 'rare', detail: 'Wnt/β-catenin signalling is implicated in several cancers. Chronic topical modulation has not been studied in humans.' },
    ],
    contraindications: [
      { flag: 'active_cancer', kind: 'relative', reason: 'The Wnt/β-catenin pathway is dysregulated in several cancers, notably colorectal.' },
      { flag: 'pregnant_or_breastfeeding', kind: 'absolute', reason: 'Wnt signalling is fundamental to embryonic development. No data.' },
      { flag: 'under_18', kind: 'absolute', reason: 'No data.' },
    ],
    redFlags: [{ symptom: 'Persistent scalp lesions that do not heal', action: 'Get them examined by a dermatologist.' }],
    monitoring: ['Fixed-position photographs every 8 weeks'],
    bannedInSport: false,
    sources: ['Lee et al., CXXC5 and Dishevelled interaction inhibition promotes hair regeneration in mice (Journal of Investigative Dermatology, 2017)'],
  },

  {
    id: 'melanotan-2',
    name: 'Melanotan II',
    aliases: ['MT-2', 'MT-II'],
    classes: ['melanocortin'],
    legalStatus: 'research_chemical',
    evidence: 'C',
    summary:
      'A tanning peptide that also causes spontaneous erections and nausea. Carries a real, documented risk of driving changes in existing moles — the most serious cosmetic risk in this app.',
    mechanism:
      'Non-selective melanocortin receptor agonist. Acts at MC1R to stimulate melanin production, and at MC4R centrally, which produces the appetite suppression and sexual effects.',
    routes: ['subcutaneous'],
    dosing: {
      unit: 'mcg',
      basis: 'fixed',
      low: 100,
      typical: 250,
      high: 500,
      hardMax: 1000,
      titrationWeeks: 3,
      note: 'Start at 100 mcg or less to test tolerance. Nausea and blood-pressure effects are strongly dose-related, and the most common harm is people starting at 500–1000 mcg and having a severe reaction on the first dose.',
    },
    frequency: {
      timesPerDay: 1,
      daysPerWeek: 5,
      preferredTimes: ['evening'],
      timingRationale:
        'Evening dosing lets the nausea peak while you sleep. Loading is done daily until the desired pigmentation is reached, then reduced to maintenance twice weekly.',
    },
    cycle: {
      onWeeks: 4,
      offWeeks: 8,
      maxConsecutiveCycles: 2,
      rationale:
        'A short loading phase then maintenance. Long continuous use increases total melanocyte stimulation, which is precisely the mechanism behind the mole concerns.',
    },
    goalFit: {
      skin_quality: 1,
      lose_fat: 1,
    },
    sideEffects: [
      { label: 'Nausea', severity: 'moderate', likelihood: 'common', detail: 'Very common in the first few doses and strongly dose-dependent.' },
      { label: 'Facial flushing', severity: 'mild', likelihood: 'common' },
      { label: 'Spontaneous erections', severity: 'mild', likelihood: 'common', detail: 'An MC4R effect, not a side benefit you can control the timing of.' },
      { label: 'Darkening and enlargement of existing moles', severity: 'severe', likelihood: 'common', detail: 'Documented in case reports. New and changing naevi have been reported, and melanoma has been diagnosed in users.' },
      { label: 'Appetite suppression', severity: 'mild', likelihood: 'common' },
      { label: 'Priapism', severity: 'severe', likelihood: 'rare', detail: 'An erection lasting over 4 hours is a urological emergency that can cause permanent damage.' },
      { label: 'Raised blood pressure', severity: 'moderate', likelihood: 'uncommon' },
      { label: 'Rhabdomyolysis', severity: 'severe', likelihood: 'rare', detail: 'Reported in case literature.' },
    ],
    contraindications: [
      { flag: 'melanoma_or_atypical_moles', kind: 'absolute', reason: 'This is the central contraindication. Stimulating melanocytes with a melanoma history or numerous atypical moles is not a defensible risk.' },
      { flag: 'active_cancer', kind: 'absolute', reason: 'Particularly any skin malignancy.' },
      { flag: 'cancer_history', kind: 'absolute', reason: 'Especially skin cancer of any type.' },
      { flag: 'pregnant_or_breastfeeding', kind: 'absolute', reason: 'No safety data.' },
      { flag: 'under_18', kind: 'absolute', reason: 'No safety data.' },
      { flag: 'cardiac_disease', kind: 'relative', reason: 'Can raise blood pressure and heart rate.' },
      { flag: 'hypertension', kind: 'relative', reason: 'Blood pressure elevation is documented.' },
    ],
    redFlags: [
      { symptom: 'An erection lasting more than 4 hours', action: 'Go to an emergency department immediately. This causes permanent tissue damage if untreated.' },
      { symptom: 'A mole that changes in size, shape, colour, or begins to itch or bleed', action: 'Stop and see a dermatologist promptly. Do not wait to see if it settles.' },
      { symptom: 'Severe muscle pain with dark urine', action: 'Emergency care — possible rhabdomyolysis.' },
    ],
    monitoring: [
      'A full skin and mole check with a dermatologist before starting, and annually while using',
      'Photograph your moles before you start so changes are detectable',
      'Blood pressure',
    ],
    bannedInSport: false,
    sources: [
      'Habbema et al., melanotan safety review and case reports of naevi changes (Journal of the European Academy of Dermatology and Venereology, 2017)',
      'Cardones & Grichnik, alpha-MSH analogues and melanocytic lesions (Archives of Dermatology, 2009)',
      'Multiple published case reports of melanoma diagnosed in Melanotan II users',
    ],
    notes: [
      'A related compound, afamelanotide (Scenesse), is an approved medicine for a rare photosensitivity disorder — administered as a supervised implant with mandatory dermatological monitoring. That supervision is the difference between the approved product and injecting this at home.',
    ],
  },

  {
    id: 'epitalon',
    name: 'Epitalon',
    aliases: ['Epithalon', 'AEDG peptide'],
    classes: ['sleep_neuro'],
    legalStatus: 'research_chemical',
    evidence: 'D',
    summary:
      'A four-amino-acid peptide promoted for longevity and sleep on the basis of Russian studies from the 1980s–2000s that have not been independently replicated.',
    mechanism:
      'Proposed to activate telomerase and normalise melatonin rhythm via the pineal gland. The telomerase claim rests on in-vitro work; the sleep claim on small unreplicated human studies.',
    routes: ['subcutaneous'],
    dosing: {
      unit: 'mg',
      basis: 'fixed',
      low: 5,
      typical: 10,
      high: 10,
      hardMax: 10,
      titrationWeeks: 0,
      note: 'Common protocols use 5–10 mg daily for 10–20 days, once or twice a year. The short course structure comes directly from the original Russian protocols.',
    },
    frequency: {
      timesPerDay: 1,
      daysPerWeek: 7,
      preferredTimes: ['bedtime'],
      timingRationale: 'Evening dosing, on the basis of the claimed pineal/melatonin mechanism.',
    },
    cycle: {
      onWeeks: 3,
      offWeeks: 20,
      maxConsecutiveCycles: 2,
      rationale: 'Short courses one or two times per year, following the original protocols.',
    },
    goalFit: {
      sleep_quality: 2,
      skin_quality: 1,
    },
    sideEffects: [
      { label: 'Injection-site reactions', severity: 'mild', likelihood: 'uncommon' },
      { label: 'Unknown profile', severity: 'moderate', likelihood: 'common', detail: 'The underlying research has not been independently replicated outside its original group.' },
      { label: 'Theoretical concern from telomerase activation', severity: 'moderate', likelihood: 'rare', detail: 'Telomerase reactivation is a hallmark of most cancers. If the mechanism claim is true, that is a reason for caution, not reassurance.' },
    ],
    contraindications: [
      { flag: 'active_cancer', kind: 'absolute', reason: 'A compound claimed to activate telomerase should not be used with an active malignancy.' },
      { flag: 'cancer_history', kind: 'relative', reason: 'Same reasoning.' },
      { flag: 'pregnant_or_breastfeeding', kind: 'absolute', reason: 'No data.' },
      { flag: 'under_18', kind: 'absolute', reason: 'No data.' },
    ],
    redFlags: [{ symptom: 'Any unexplained systemic symptoms', action: 'Stop and seek medical assessment.' }],
    monitoring: ['No established monitoring exists'],
    bannedInSport: false,
    sources: ['Khavinson et al., Epithalon peptide studies (Bulletin of Experimental Biology and Medicine, 2000s) — largely from a single research group, not independently replicated'],
    notes: [
      'The evidence base is a genuine outlier: promoted for longevity on the strength of work that no independent group has reproduced.',
    ],
  },

  {
    id: 'dsip',
    name: 'DSIP',
    aliases: ['Delta Sleep-Inducing Peptide'],
    classes: ['sleep_neuro'],
    legalStatus: 'research_chemical',
    evidence: 'D',
    summary:
      'A nonapeptide isolated in the 1970s from sleeping rabbits. Despite the name, human studies have not reliably shown it improves sleep.',
    mechanism:
      'Isolated from the cerebral venous blood of rabbits in induced sleep. The mechanism was never established, and studies since have produced inconsistent effects on sleep architecture.',
    routes: ['subcutaneous'],
    dosing: {
      unit: 'mcg',
      basis: 'fixed',
      low: 100,
      typical: 200,
      high: 300,
      hardMax: 500,
      titrationWeeks: 0,
      note: 'Community protocols use 100–300 mcg before bed. There is no validated human dose.',
    },
    frequency: {
      timesPerDay: 1,
      daysPerWeek: 5,
      preferredTimes: ['bedtime'],
      timingRationale: 'Taken 30–60 minutes before bed.',
    },
    cycle: {
      onWeeks: 4,
      offWeeks: 4,
      maxConsecutiveCycles: 3,
      rationale: 'Short courses. Nothing supports long-term use.',
    },
    goalFit: {
      sleep_quality: 2,
    },
    sideEffects: [
      { label: 'Headache', severity: 'mild', likelihood: 'uncommon' },
      { label: 'Grogginess the next morning', severity: 'mild', likelihood: 'uncommon' },
      { label: 'No reliable effect', severity: 'mild', likelihood: 'common', detail: 'The most likely outcome based on the human literature.' },
    ],
    contraindications: [
      { flag: 'pregnant_or_breastfeeding', kind: 'absolute', reason: 'No data.' },
      { flag: 'under_18', kind: 'absolute', reason: 'No data.' },
    ],
    redFlags: [{ symptom: 'Excessive daytime sedation affecting driving or work', action: 'Stop using it.' }],
    monitoring: ['Track sleep with a diary or wearable — otherwise you cannot distinguish an effect from expectation'],
    bannedInSport: false,
    sources: ['Schoenenberger & Monnier, isolation of delta sleep-inducing peptide (PNAS, 1977)', 'Subsequent human sleep studies with inconsistent findings (1980s–1990s)'],
    notes: [
      'If sleep is your goal, fixing sleep timing, light exposure and caffeine cut-off will outperform this and costs nothing. The engine will tell you the same thing.',
    ],
  },
];
