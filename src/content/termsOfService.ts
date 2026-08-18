/**
 * Terms of Service / liability agreement copy (THEA-93).
 *
 * Gated on THEA-91 (Benji, compliance) delivering the authoritative legal
 * text via Paperclip document key `terms-of-service`. Developers do not
 * author legal/liability wording (AGENTS.md; same rule already applied to
 * `app/settings/privacy.tsx`, THEA-12a) — everything below this comment is a
 * structural placeholder, not real ToS copy. This is the single file to
 * update once THEA-91 ships:
 *
 * 1. Replace `TERMS_OF_SERVICE_LINK_LABEL` / `TERMS_OF_SERVICE_CHECKBOX_LABEL`
 *    with Benji's exact label text.
 * 2. Replace `TERMS_OF_SERVICE_BODY` with the full approved copy (one string
 *    per paragraph/section).
 * 3. Flip `TERMS_OF_SERVICE_PENDING` to `false` so the "final text pending"
 *    notice on `app/settings/terms.tsx` stops rendering.
 *
 * Do not flip `TERMS_OF_SERVICE_PENDING` to `false` while the body below is
 * still placeholder text — that would let a user check "I have read the
 * terms of service" against wording that was never actually reviewed.
 */

export const TERMS_OF_SERVICE_PENDING = true;

/** Link label shown in onboarding and in Settings. */
export const TERMS_OF_SERVICE_LINK_LABEL = 'Terms of Service & Liability Agreement';

/** Checkbox label shown directly below the link in onboarding. */
export const TERMS_OF_SERVICE_CHECKBOX_LABEL = 'I have read the terms of service';

/**
 * Full body copy, one entry per paragraph. Placeholder only — see the
 * file-level note above.
 */
export const TERMS_OF_SERVICE_BODY: string[] = [
  'The full Terms of Service and liability-agreement text is still being drafted and reviewed by our compliance reviewer (THEA-91). This placeholder paragraph stands in for that text so the acceptance gate below can be built and tested ahead of the final copy.',
  'The approved text will cover, at minimum: that the app is for research and educational purposes only and is not medical advice, diagnosis or treatment; that the operator carries no liability for health outcomes, misuse or harm arising from use of the app; that you are solely responsible for your own decisions and assume all risk; that information is provided as-is with no warranty; that you are responsible for complying with the laws of your own jurisdiction; and that using the app constitutes acceptance of these terms.',
];
