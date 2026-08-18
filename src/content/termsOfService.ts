/**
 * Terms of Service / liability agreement copy (THEA-93).
 *
 * Sourced verbatim from THEA-91 (Benji, compliance) — Paperclip document key
 * `terms-of-service`, delivered 2026-08-18. This is the single file that
 * carries that copy; nothing here was authored by a developer (AGENTS.md;
 * same rule already applied to `app/settings/privacy.tsx`, THEA-12a).
 *
 * Benji's compliance note (THEA-91): this is a self-authored disclaimer, not
 * attorney-drafted. It follows standard structure and reduces exposure, but
 * does not guarantee zero liability or enforceability — real licensed-
 * attorney review is recommended before launch, particularly for the
 * jurisdictions the app is actually distributed in. That escalation is an
 * owner/Chief decision, not implemented here.
 *
 * If this text is ever revised, pull the latest revision from the same
 * document key rather than hand-editing — this file should stay a mirror of
 * the source of truth, not a fork of it.
 */

export const TERMS_OF_SERVICE_PENDING = false;

/** Link label shown in onboarding and in Settings. */
export const TERMS_OF_SERVICE_LINK_LABEL = 'Terms of Service & Liability Agreement';

/** Checkbox label shown directly below the link in onboarding — Benji's exact wording (THEA-91). */
export const TERMS_OF_SERVICE_CHECKBOX_LABEL =
  'I have read and agree to the Terms of Service and Liability Agreement, and understand this app provides research and educational information only — not medical advice.';

/**
 * Full body copy, one entry per section. Verbatim from the THEA-91 document
 * (Paperclip document key `terms-of-service`), split on its own `##`
 * headings so each section renders as its own paragraph block.
 */
export const TERMS_OF_SERVICE_INTRO =
  "Plain-language summary (read this first): This app gives you general research and educational information about peptides. It is not medical advice, it cannot replace a doctor, and the people who built it are not responsible for what you decide to do with that information. Peptides can be tightly regulated where you live, and using them carries real health risk. By using this app, you're agreeing that you understand and accept all of that. If any of this isn't acceptable to you, please don't use the app.\n\nThe full terms below are the legally operative text. The summary above is provided for clarity and does not limit or modify the terms that follow.";

export const TERMS_OF_SERVICE_BODY: Array<{ heading: string; body: string }> = [
  {
    heading: '1. Acceptance of Terms',
    body: 'By accessing, downloading, installing, or using this application (the "App"), or by checking the acceptance box presented to you, you ("User," "you") agree to be bound by these Terms of Service and this Liability Agreement (together, the "Terms"). If you do not agree to all of these Terms, do not use the App. Continued use of the App after any update to these Terms constitutes acceptance of the updated Terms.\n\nIf you are using the App on behalf of another person, or are accessing it in a jurisdiction with a minimum age of consent for services like this one, you represent that you have the legal capacity and authority to accept these Terms.',
  },
  {
    heading: '2. Research and Educational Purposes Only — Not Medical Advice',
    body: 'The App provides general, published, and aggregated information about peptides and related compounds for research and educational purposes only.\n\nNothing in the App constitutes, and nothing in the App should be construed or relied upon as: medical advice, diagnosis, or treatment; a recommendation or instruction to acquire, possess, or administer any substance; a substitute for the independent judgment of a licensed physician, pharmacist, or other qualified healthcare professional; or the practice of medicine, pharmacy, or any other licensed health profession.\n\nUsing the App does not create a doctor-patient, pharmacist-patient, or any other clinician-patient or fiduciary relationship between you and the operator of the App, its developers, contributors, or affiliates (collectively, the "Operator"). No such relationship is formed by your use of the App, by any information the App displays, or by any communication you have with the Operator in connection with the App.\n\nAny dosing figures, ranges, schedules, or related calculations shown in the App are derived from published reference material and are presented for informational and research-planning context only. They are not personalized medical dosing instructions, are not a prescription, and are not verified for any individual\'s specific health circumstances.',
  },
  {
    heading: '3. No Liability',
    body: 'To the maximum extent permitted by applicable law, the Operator is not responsible or liable — under any legal theory (contract, tort, negligence, strict liability, statute, or otherwise) — for any health issues, illness, injury, death, side effects, adverse reactions, misuse, incorrect or mistimed dosing, drug interactions, or any other harm, damage, or loss of any kind, arising out of or in any way related to: your use of, or inability to use, the App; your reliance on any information, calculation, suggestion, or content presented by the App; any decision you make or action you take (or fail to take) regarding any substance, dose, schedule, or health-related choice, whether or not informed by the App; or any error, omission, inaccuracy, or interruption in the App or its content.\n\nThis limitation applies regardless of whether the Operator has been advised of the possibility of such harm, and applies even if a remedy fails of its essential purpose. Where applicable law does not allow the exclusion or limitation of certain damages or liabilities, the Operator\'s liability is limited to the smallest extent permitted by that law.\n\nNothing in this section is intended to exclude or limit liability that cannot lawfully be excluded or limited (for example, liability for death or personal injury caused by proven gross negligence or willful misconduct, where and to the extent such exclusion is prohibited by applicable law).',
  },
  {
    heading: '4. User Responsibility and Assumption of Risk',
    body: 'You are solely and entirely responsible for any decision you make regarding your own health, including any decision to obtain, use, combine, or discontinue any substance, whether or not that decision is informed in any way by information presented in the App.\n\nBefore making any health-related decision, you should consult a licensed healthcare professional. You should not use the App as a substitute for such consultation, and you should not delay or forgo seeking professional medical advice because of anything you read in the App.\n\nBy using the App, you knowingly and voluntarily assume all risk associated with your use of the App and with any substance, dose, or health-related decision you make, whether or not related to information found in the App. This includes, without limitation, the risk of illness, injury, adverse reaction, interaction with other substances or medications, legal risk, and death.\n\nYou are responsible for the accuracy of any information you enter into the App (including any profile, health, or usage information), and for evaluating the suitability of any information the App presents to your own individual circumstances.',
  },
  {
    heading: '5. No Warranty',
    body: 'The App and all information, content, and features within it are provided "as is" and "as available," without warranty of any kind, express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, accuracy, completeness, timeliness, non-infringement, or that the App will be uninterrupted, error-free, or secure.\n\nThe Operator does not warrant or guarantee the accuracy, completeness, currency, or reliability of any published-literature figure, calculation, or other content displayed by the App. Published reference values change over time and may vary by source; the Operator makes no representation that any figure shown reflects the most current available evidence.',
  },
  {
    heading: '6. Legal and Regulatory Compliance',
    body: 'Peptides and related compounds referenced in the App may be regulated, controlled, prescription-only, or unlawful to obtain, possess, import, or use in your jurisdiction. Regulatory status varies by country, state, and locality, and can change without notice.\n\nYou are solely responsible for knowing and complying with all laws and regulations that apply to you, including those governing the purchase, possession, importation, and use of any substance referenced in the App.\n\nNothing in the App is, or should be understood as, an endorsement, encouragement, or facilitation of the acquisition or use of any substance. The App does not sell, supply, or provide access to any substance, and the Operator has no relationship with, and does not vouch for, any third-party supplier, manufacturer, or seller of any substance, whether or not referenced in the App.',
  },
  {
    heading: '7. Indemnification',
    body: 'To the maximum extent permitted by applicable law, you agree to indemnify and hold harmless the Operator from and against any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or in any way connected with your use of the App, your violation of these Terms, or your violation of any applicable law or regulation.',
  },
  {
    heading: '8. Changes to These Terms',
    body: 'The Operator may update these Terms from time to time. Material changes will be reflected by an updated effective date and, where practicable, surfaced to you within the App. Continued use of the App after a change takes effect constitutes your acceptance of the revised Terms.',
  },
  {
    heading: '9. Severability',
    body: 'If any provision of these Terms is found to be unenforceable or invalid under applicable law, that provision will be limited or eliminated to the minimum extent necessary so that the remaining Terms remain in full force and effect.',
  },
  {
    heading: '10. Contact',
    body: "Questions about these Terms can be directed through the App's support or feedback channel.",
  },
];

export const TERMS_OF_SERVICE_OUTRO =
  'Effective upon your acceptance. By checking the acceptance box or by continuing to use the App, you confirm that you have read, understood, and agree to these Terms in full.';
