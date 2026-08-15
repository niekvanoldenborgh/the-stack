'use strict';

/**
 * Pure logic: does this poll look like a second concurrent consumer of the
 * same Telegram bot token / pending store? (THEA-28 #3)
 *
 * Telegram's `getUpdates` is single-consumer — it advances one shared
 * offset, so if two processes poll the same bot token (e.g. an agent
 * heartbeat *and* the VPS per-minute cron), they steal each other's
 * updates and a reply gets consumed-and-dropped by whichever process
 * didn't have the matching pending entry. This can't be prevented from
 * inside a single process; the guard only detects the symptom (two
 * different instance ids writing `lastPoller` inside the same cron
 * cadence) and warns loudly so it gets fixed at the deployment level — see
 * README "Single-poller guarantee".
 */
const DEFAULT_GUARD_WINDOW_MS = 45_000; // comfortably inside a 60s cron cadence

function detectSecondConsumer({ lastPoller, instanceId, now, guardWindowMs = DEFAULT_GUARD_WINDOW_MS }) {
  if (!lastPoller || !lastPoller.instanceId || lastPoller.at == null) return false;
  if (lastPoller.instanceId === instanceId) return false;
  return now - lastPoller.at < guardWindowMs;
}

module.exports = { detectSecondConsumer, DEFAULT_GUARD_WINDOW_MS };
