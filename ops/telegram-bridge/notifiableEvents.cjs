'use strict';

/**
 * Pure decision logic for the outbound scan: given issues and (for each) an
 * already-fetched interaction list, which of them need a Telegram
 * notification that hasn't already been sent?
 *
 * Two triggers, per THEA-20's scope:
 *   1. A pending interaction that only a human/Board member can resolve.
 *   2. An issue in `blocked` status whose unblock owner is a human, not
 *      another agent.
 *
 * "Requires a human" heuristics (both are inferences from the shape of data
 * this agent's API access can see, not a documented contract — see
 * README.md "Heuristics worth re-checking"):
 *   - Interaction: `effectiveResolverPolicy === 'board_only'`. That field
 *     is Paperclip's own statement that no agent, only a human/Board
 *     member, can resolve it — the most direct signal available.
 *   - Blocked issue: `unblockDescriptor.owner` names a user, not an agent.
 *     Only one real example was available while building this
 *     (THEA-14, agent-owned) so the "owner.userId present" branch is
 *     unverified against a real human-owned example.
 */

function isHumanOnlyInteraction(interaction) {
  return Boolean(interaction) && interaction.status === 'pending' && interaction.effectiveResolverPolicy === 'board_only';
}

function isHumanUnblockOwner(unblockDescriptor) {
  const owner = unblockDescriptor && unblockDescriptor.owner;
  if (!owner) return false;
  if (owner.agentId) return false; // routed to another agent — not a human
  return Boolean(owner.userId || owner.kind === 'user' || owner.kind === 'human');
}

/**
 * @param {object[]} issues - non-terminal issues to check
 * @param {Record<string, object[]>} interactionsByIssueId - issue.id -> interactions
 * @param {{ interactionIds: string[], blockedIssueIds: string[] }} notified - already-sent ids
 */
function findNotifiableEvents({ issues, interactionsByIssueId, notified }) {
  const notifiedInteractionIds = new Set((notified && notified.interactionIds) || []);
  const notifiedBlockedIssueIds = new Set((notified && notified.blockedIssueIds) || []);

  const events = [];
  for (const issue of issues) {
    const interactions = (interactionsByIssueId && interactionsByIssueId[issue.id]) || [];
    for (const interaction of interactions) {
      if (!isHumanOnlyInteraction(interaction)) continue;
      if (notifiedInteractionIds.has(interaction.id)) continue;
      events.push({ type: 'interaction', issue, interaction });
    }

    if (issue.status === 'blocked' && isHumanUnblockOwner(issue.unblockDescriptor) && !notifiedBlockedIssueIds.has(issue.id)) {
      events.push({ type: 'blocked', issue });
    }
  }
  return events;
}

module.exports = { findNotifiableEvents, isHumanOnlyInteraction, isHumanUnblockOwner };
