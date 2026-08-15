'use strict';

/**
 * Pure logic: can an `ask_user_questions` interaction be auto-routed for
 * inbound replies?
 *
 * Only single-question interactions with a free-text option qualify — see
 * mapUpdate.cjs for why (Paperclip's respond API takes structured
 * questionId/optionIds, not raw text). Anything else (multi-question,
 * request_confirmation, no free-text option) returns null: the outbound
 * notification still sends, but notify.cjs records it as `kind:
 * 'unsupported'` so a reply is reported rather than mis-routed.
 */
function computeAutoRoute(interaction) {
  if (!interaction || interaction.kind !== 'ask_user_questions') return null;

  const questions = interaction.payload && interaction.payload.questions;
  if (!Array.isArray(questions) || questions.length !== 1) return null;

  const [question] = questions;
  const options = Array.isArray(question.options) ? question.options : [];
  const freeTextOption = options.find((option) => option && option.freeText);
  if (!freeTextOption) return null;

  return { questionId: question.id, freeTextOptionId: freeTextOption.id };
}

module.exports = { computeAutoRoute };
