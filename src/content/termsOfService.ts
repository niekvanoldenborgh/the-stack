/**
 * Terms of Service / liability agreement copy (THEA-104).
 *
 * Sourced verbatim from THEA-103 (Benji, compliance) — Paperclip document key
 * `terms-of-service`, revision 4, pulled 2026-08-18 at revision 3 and
 * verified 2026-08-18 (THEA-109) to already match revision 4 verbatim. This
 * is the single file that carries that copy; nothing here was authored by a
 * developer
 * (AGENTS.md; same rule already applied to `app/settings/privacy.tsx`,
 * THEA-12a). The source document is written in markdown with inline bold/
 * italic emphasis and `-` bullet lists; `TermsOfServiceScreen` renders each
 * section as a single plain-text `<Body>`, so emphasis markers are stripped
 * and bullets are flattened into semicolon-joined prose (matching the
 * pattern already used for the Section 3/4 lists carried over from
 * revision 2) or, where each item is its own full sentence (Section 9's
 * per-jurisdiction consumer-rights notes), split into separate paragraphs.
 * Wording is otherwise unchanged from the source.
 *
 * Revision 3 responds to the owner's THEA-98 distribution answer
 * (NL now, EU/EEA + UK + US planned) by adding: a governing-law/venue
 * clause (Section 9) with an explicit consumer-savings-clause carve-out for
 * EU/EEA and UK consumers (Rome I Art. 6(2)); non-excludable liability
 * carve-outs for death/personal injury from negligence, fraud, and gross
 * negligence (Section 5, which Section 4's limitation is now expressly
 * subject to); severability re-scoped per-jurisdiction/per-user (Section
 * 10); a material-change re-acceptance requirement (Section 12 — see the
 * `acceptedTermsAt` re-acceptance mechanics below); and an open
 * counterparty-identity placeholder (Section 13) flagged for the owner
 * rather than invented. Revision 2's Section 2 (Eligibility, 18+ for
 * accounts) is carried over unchanged — it is still scoped explicitly to
 * accounts and does not narrow the app's separate under-18/21/25 in-app
 * safety notices (AGENTS.md invariant 7).
 *
 * Revision 4 (THEA-107 compliance QC) is a single cross-reference fix in
 * Section 7 (No Warranty): "(see Section 9)" became "(see Sections 5 and 9)"
 * so the carve-out also points at Section 5's non-excludable-liability
 * clause, not just Section 9's governing-law text. No other wording changed
 * from revision 3, and this is not a material change requiring
 * re-acceptance (see `ACCEPTED_TERMS_VERSION` below).
 *
 * Benji's compliance note (THEA-91, still true at revision 4): this is a
 * self-authored disclaimer, not attorney-drafted. It follows standard
 * structure and reduces exposure, but does not guarantee zero liability or
 * enforceability — real licensed-attorney review is recommended before
 * launch, particularly for the jurisdictions the app is actually
 * distributed in (THEA-98: Option A — ship now, attorney review before any
 * third-party install). See THEA-103's `attorney-review-packet` document.
 *
 * If this text is ever revised, pull the latest revision from the same
 * document key rather than hand-editing — this file should stay a mirror of
 * the source of truth, not a fork of it. A material change also requires
 * bumping `ACCEPTED_TERMS_VERSION` below so existing users are re-prompted
 * (see `useAppStore`'s persist `version`/`migrate`).
 */

export const TERMS_OF_SERVICE_PENDING = false;

/**
 * Bumped whenever the shipped copy above changes in a way that requires
 * re-acceptance (THEA-104). Not rendered in the UI; exists so the store
 * migration has something concrete to key off rather than guessing from a
 * timestamp. Current value was set at `terms-of-service` revision 3 and
 * still applies at revision 4 — the revision-4 cross-reference fix (THEA-107,
 * THEA-109) is non-material and does not require re-acceptance.
 */
export const ACCEPTED_TERMS_VERSION = 3;

/** Link label shown in onboarding and in Settings. */
export const TERMS_OF_SERVICE_LINK_LABEL = 'Terms of Service & Liability Agreement';

/** Checkbox label shown directly below the link in onboarding — Benji's exact wording (THEA-91). */
export const TERMS_OF_SERVICE_CHECKBOX_LABEL =
  'I have read and agree to the Terms of Service and Liability Agreement, and understand this app provides research and educational information only — not medical advice.';

/**
 * Full body copy, one entry per section. Verbatim from the THEA-103 document
 * (Paperclip document key `terms-of-service`), split on its own `##`
 * headings so each section renders as its own paragraph block.
 */
export const TERMS_OF_SERVICE_INTRO =
  "Plain-language summary (read this first): This app gives you general research and educational information about peptides. It is not medical advice, it cannot replace a doctor, and the people who built it are not responsible for the health decisions you make with that information. Peptides can be tightly regulated where you live, and using them carries real health risk. This agreement limits our liability as far as the law where you live allows — but the law in your country protects certain rights that no agreement can take away, and we are not trying to take them. By using this app, you're agreeing that you understand and accept all of that. If any of this isn't acceptable to you, please don't use the app.\n\nThe full terms below are the legally operative text. The summary above is provided for clarity and does not limit or modify the terms that follow.";

export const TERMS_OF_SERVICE_BODY: Array<{ heading: string; body: string }> = [
  {
    heading: '1. Acceptance of Terms',
    body: 'By accessing, downloading, installing, or using this application (the "App"), or by checking the acceptance box presented to you, you ("User," "you") agree to be bound by these Terms of Service and this Liability Agreement (together, the "Terms"). If you do not agree to all of these Terms, do not use the App.\n\nIf you are using the App on behalf of another person, you represent that you have the legal capacity and authority to do so. Creating an account is additionally subject to the eligibility requirement in Section 2; nothing in this Section 1 modifies, narrows, or waives that requirement, and no jurisdiction\'s lower age of consent for other services permits a below-eligibility-age person to create an account with the App.',
  },
  {
    heading: '2. Eligibility',
    body: "You must be at least 18 years old to create an account with the App or to have any personal or health-related information stored in connection with an account. By creating an account, you represent and warrant that you are 18 years of age or older. The App may ask you to confirm your date of birth as part of account creation for this purpose.\n\nThe Operator reserves the right to suspend or terminate any account, and to delete any data associated with it, if the Operator determines or has reason to believe that the account belongs to, or was created by, a person under 18.\n\nThis eligibility requirement applies to accounts only. It does not affect, narrow, or replace the App's separate safety notices shown to users who may be under 18, 21, or 25 while using the App's calculators or other features without an account — those notices continue to apply regardless of account status, and nothing in this section should be read as an endorsement of substance use by a person under 18 at any age or in any circumstance.",
  },
  {
    heading: '3. Research and Educational Purposes Only — Not Medical Advice',
    body: 'The App provides general, published, and aggregated information about peptides and related compounds for research and educational purposes only. It is not a medical device, is not intended to diagnose, treat, cure, or prevent any disease, and is not intended to be relied upon for making individual treatment decisions.\n\nNothing in the App constitutes, and nothing in the App should be construed or relied upon as: medical advice, diagnosis, or treatment; a recommendation or instruction to acquire, possess, or administer any substance; a substitute for the independent judgment of a licensed physician, pharmacist, or other qualified healthcare professional; or the practice of medicine, pharmacy, or any other licensed health profession.\n\nUsing the App does not create a doctor-patient, pharmacist-patient, or any other clinician-patient or fiduciary relationship between you and the operator of the App, its developers, contributors, or affiliates (collectively, the "Operator"). No such relationship is formed by your use of the App, by any information the App displays, or by any communication you have with the Operator in connection with the App.\n\nAny dosing figures, ranges, schedules, or related calculations shown in the App are derived from published reference material and are presented for informational and research-planning context only. They are not personalized medical dosing instructions, are not a prescription, and are not verified for any individual\'s specific health circumstances.',
  },
  {
    heading: '4. Limitation of Liability',
    body: 'To the maximum extent permitted by applicable law, and subject always to Section 5 below, the Operator is not responsible or liable — under any legal theory (contract, tort, negligence, strict liability, statute, or otherwise) — for any health issues, illness, injury, side effects, adverse reactions, misuse, incorrect or mistimed dosing, drug interactions, or any other harm, damage, or loss of any kind, arising out of or in any way related to: your use of, or inability to use, the App; your reliance on any information, calculation, suggestion, or content presented by the App; any decision you make or action you take (or fail to take) regarding any substance, dose, schedule, or health-related choice, whether or not informed by the App; or any error, omission, inaccuracy, or interruption in the App or its content.\n\nThis limitation applies regardless of whether the Operator has been advised of the possibility of such harm, and applies even if a remedy fails of its essential purpose. Where applicable law does not allow the exclusion or limitation of certain damages or liabilities, this Section applies only to the extent that law permits, and the Operator\'s liability is limited to the smallest extent that law permits.',
  },
  {
    heading: '5. Liability That Cannot Be, and Is Not, Excluded',
    body: 'Nothing in these Terms excludes or limits, and these Terms shall not be read as attempting to exclude or limit, any liability that cannot lawfully be excluded or limited. This includes, without limitation and to the extent the applicable law so provides: liability for death or personal injury caused by the Operator\'s negligence (for example, this cannot be excluded against a consumer under UK law, Unfair Contract Terms Act 1977 s. 2(1) / Consumer Rights Act 2015); liability for fraud or fraudulent misrepresentation; liability for gross negligence or intentional misconduct (in the Netherlands, opzet of bewuste roekeloosheid); and any rights or remedies granted to consumers by mandatory law that cannot be waived by agreement.\n\nThis Section prevails over any other provision of these Terms with which it conflicts. Its purpose is to keep the rest of the liability provisions valid: an over-broad exclusion risks being struck down in its entirety, so these carve-outs are stated expressly and are genuinely meant.',
  },
  {
    heading: '6. User Responsibility and Assumption of Risk',
    body: 'You are solely and entirely responsible for any decision you make regarding your own health, including any decision to obtain, use, combine, or discontinue any substance, whether or not that decision is informed in any way by information presented in the App.\n\nBefore making any health-related decision, you should consult a licensed healthcare professional. You should not use the App as a substitute for such consultation, and you should not delay or forgo seeking professional medical advice because of anything you read in the App.\n\nBy using the App, you knowingly and voluntarily assume the risks associated with your use of the App and with any substance, dose, or health-related decision you make, to the extent the law where you live permits you to do so. This includes, without limitation, the risk of illness, injury, adverse reaction, interaction with other substances or medications, legal risk, and death. Nothing in this Section limits the rights preserved for you by Section 5.\n\nYou are responsible for the accuracy of any information you enter into the App (including any profile, health, or usage information), and for evaluating the suitability of any information the App presents to your own individual circumstances.',
  },
  {
    heading: '7. No Warranty',
    body: 'The App and all information, content, and features within it are provided "as is" and "as available," without warranty of any kind, express or implied, including but not limited to implied warranties of merchantability, fitness for a particular purpose, accuracy, completeness, timeliness, non-infringement, or that the App will be uninterrupted, error-free, or secure. This does not affect any warranty or guarantee that mandatory consumer law gives you and that cannot be excluded (see Sections 5 and 9).\n\nThe Operator does not warrant or guarantee the accuracy, completeness, currency, or reliability of any published-literature figure, calculation, or other content displayed by the App. Published reference values change over time and may vary by source; the Operator makes no representation that any figure shown reflects the most current available evidence.',
  },
  {
    heading: '8. Legal and Regulatory Compliance',
    body: 'Peptides and related compounds referenced in the App may be regulated, controlled, prescription-only, or unlawful to obtain, possess, import, or use in your jurisdiction. Regulatory status varies by country, state, and locality, and can change without notice.\n\nYou are solely responsible for knowing and complying with all laws and regulations that apply to you, including those governing the purchase, possession, importation, and use of any substance referenced in the App.\n\nNothing in the App is, or should be understood as, an endorsement, encouragement, or facilitation of the acquisition or use of any substance. The App does not sell, supply, or provide access to any substance, and the Operator has no relationship with, and does not vouch for, any third-party supplier, manufacturer, or seller of any substance, whether or not referenced in the App.',
  },
  {
    heading: '9. Governing Law, Venue, and Your Consumer Rights',
    body: 'Governing law. These Terms, and any dispute or claim arising out of or in connection with them or their subject matter (including non-contractual disputes or claims), are governed by the laws of the Netherlands, without regard to its conflict-of-laws rules.\n\nVenue. Subject to the consumer protection below, the courts of Amsterdam, the Netherlands have jurisdiction to settle any such dispute or claim.\n\nYour mandatory consumer rights are preserved (this is important). If you are a consumer:\n\nIf you are habitually resident in the European Union or EEA, this choice of Dutch law does not deprive you of the protection of the mandatory provisions of the law of your own country of residence that cannot be derogated from by agreement (Regulation (EC) No 593/2008 ("Rome I"), Article 6(2)). You also retain the right to bring proceedings in, and any proceedings against you must generally be brought in, the courts of your country of residence, where mandatory law so provides.\n\nIf you are resident in the United Kingdom, you likewise keep the mandatory protections of UK consumer law that cannot be excluded by a choice-of-law clause, and you may bring proceedings in the UK courts where UK law so provides.\n\nIf you are resident in the United States, some of the provisions above may be limited by the law of your state of residence; Section 10 (Severability) applies, and any provision unenforceable in your state is limited or removed only for you and only to the extent required, leaving the rest in force.\n\nNothing in this Section requires you to litigate in a forum, or under a law, that mandatory consumer-protection law entitles you to avoid. A choice-of-law or venue clause is not intended to, and does not, override those rights.',
  },
  {
    heading: '10. Severability',
    body: 'If any provision of these Terms is found to be unenforceable or invalid under the law of any jurisdiction, that provision will be limited or eliminated to the minimum extent necessary — and only in respect of that jurisdiction and that user — so that the remaining Terms, and that provision elsewhere, remain in full force and effect. The invalidity of a provision in one jurisdiction does not affect its validity in another.',
  },
  {
    heading: '11. Indemnification',
    body: 'To the maximum extent permitted by applicable law, you agree to indemnify and hold harmless the Operator from and against any third-party claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of or in any way connected with your violation of these Terms or your violation of any applicable law or regulation. This Section does not apply to the extent a claim arises from the Operator\'s own conduct for which liability cannot be excluded under Section 5, and nothing in this Section requires a consumer to indemnify the Operator where mandatory consumer law prohibits it.',
  },
  {
    heading: '12. Changes to These Terms',
    body: 'The Operator may update these Terms from time to time. The App records the version of the Terms you accepted. If the Operator makes a material change — for example, to the liability, governing-law, eligibility, or data provisions — the updated Terms will be surfaced to you within the App and you will be asked to review and accept them again before continuing to use the App. Non-material changes (such as corrections of typos or contact details) will be reflected by an updated effective date. Your continued use after a non-material change constitutes acceptance of it.',
  },
  {
    heading: '13. Who You Are Contracting With',
    body: '[OPEN — owner decision required before third-party distribution.] These Terms are between you and the operator of the App (the "Operator"). The specific legal person or entity that is the Operator, and its contact and establishment details, will be identified here. Until the owner confirms whether the counterparty is an individual or a registered entity, this clause is intentionally left as a placeholder; it must be completed before the App is made available to anyone other than the owner. See the attorney review packet.',
  },
  {
    heading: '14. Contact',
    body: "Questions about these Terms can be directed through the App's support or feedback channel. Formal legal notices should be sent to the Operator at the address identified in Section 13 once completed.",
  },
];

export const TERMS_OF_SERVICE_OUTRO =
  'Effective upon your acceptance. By checking the acceptance box or by continuing to use the App, you confirm that you have read, understood, and agree to these Terms in full.';
