import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { getPeptide } from '../domain/peptides';
import type { ScheduledDose } from '../domain/types';
import { formatDose } from '../engine/dosing';
import { fromISODate } from './date';

/**
 * Dose reminders.
 *
 * iOS caps an app at 64 pending local notifications, so we cannot simply
 * schedule an entire 12-week cycle. Instead we keep a rolling window: every
 * time the app opens (or the stack changes) we clear and re-schedule the next
 * `MAX_SCHEDULED` upcoming doses. That keeps reminders accurate after any edit
 * without ever bumping the platform ceiling.
 *
 * expo-notifications' remote-push surface was pulled from Expo Go in SDK 53;
 * calling into it there throws (Android) or warns and no-ops (iOS/web). We
 * treat Expo Go the same as `Platform.OS === 'web'` below — every exported
 * function no-ops before touching the native module — so the app can still
 * boot and be previewed there. Real dev-client / standalone builds are
 * untouched: `isExpoGo` is false and behaviour is identical to before.
 */

const MAX_SCHEDULED = 56;
const CHANNEL_ID = 'peptide-reminders';

const isExpoGo = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let handlerConfigured = false;

export function configureNotificationHandler(): void {
  if (isExpoGo || handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

export async function ensureAndroidChannel(): Promise<void> {
  if (isExpoGo || Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Dose reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4ADE80',
    sound: 'default',
  });
}

export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export async function getPermissionState(): Promise<PermissionState> {
  if (isExpoGo || Platform.OS === 'web') return 'unsupported';
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return 'granted';
  if (settings.canAskAgain) return 'undetermined';
  return 'denied';
}

export async function requestPermission(): Promise<PermissionState> {
  if (isExpoGo || Platform.OS === 'web') return 'unsupported';
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return 'granted';
  const result = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowBadge: true, allowSound: true },
  });
  if (result.granted) {
    await ensureAndroidChannel();
    return 'granted';
  }
  return result.canAskAgain ? 'undetermined' : 'denied';
}

function triggerDate(dose: ScheduledDose, offsetMin = 0): Date {
  const date = fromISODate(dose.date);
  const [hours, minutes] = dose.time.split(':').map(Number);
  date.setHours(hours ?? 8, minutes ?? 0, 0, 0);
  if (offsetMin > 0) date.setMinutes(date.getMinutes() - offsetMin);
  return date;
}

/** Sanitise user-configured alarm offsets: non-negative, whole minutes, unique. */
function normaliseOffsets(offsetsMin: number[]): number[] {
  const cleaned = offsetsMin
    .map((m) => Math.max(0, Math.round(m)))
    .filter((m, index, arr) => arr.indexOf(m) === index)
    .sort((a, b) => b - a);
  return cleaned.length > 0 ? cleaned : [0];
}

function buildBody(dose: ScheduledDose): string {
  const peptide = getPeptide(dose.peptideId);
  const name = peptide?.name ?? dose.peptideId;
  const amount = formatDose(dose.dose);
  const route =
    dose.route === 'subcutaneous'
      ? 'subcutaneous'
      : dose.route === 'intramuscular'
        ? 'intramuscular'
        : dose.route;

  const fasting = peptide?.classes.some((c) => c === 'ghrh_analog' || c === 'ghrp_secretagogue')
    ? ' Take fasted — wait 20 minutes before eating.'
    : '';

  const titrating = dose.phase === 'titration' ? ' (titration dose)' : '';

  return `${name} — ${amount}${titrating}, ${route}.${fasting}`;
}

export interface ScheduleResult {
  scheduled: number;
  skippedPast: number;
  truncated: boolean;
}

/**
 * Replaces all pending reminders with the next window of upcoming doses.
 * Safe to call repeatedly — it cancels before it schedules.
 *
 * `alarmOffsetsMin` fans each dose out into one alert per configured lead time
 * (e.g. `[2, 0]` → two minutes before and at the inject time). The platform
 * notification ceiling is enforced *after* the fan-out, so adding offsets
 * shortens the covered window rather than ever exceeding the cap.
 */
export async function syncReminders(
  doses: ScheduledDose[],
  alarmOffsetsMin: number[] = [0],
): Promise<ScheduleResult> {
  if (isExpoGo || Platform.OS === 'web') return { scheduled: 0, skippedPast: 0, truncated: false };

  const permission = await getPermissionState();
  if (permission !== 'granted') return { scheduled: 0, skippedPast: 0, truncated: false };

  await Notifications.cancelAllScheduledNotificationsAsync();
  await ensureAndroidChannel();

  const now = Date.now();
  const offsets = normaliseOffsets(alarmOffsetsMin);
  const upcoming = doses
    .flatMap((dose) =>
      offsets.map((offsetMin) => ({ dose, offsetMin, when: triggerDate(dose, offsetMin) })),
    )
    .filter((entry) => entry.when.getTime() > now + 60_000)
    .sort((a, b) => a.when.getTime() - b.when.getTime());

  const skippedPast = doses.length * offsets.length - upcoming.length;
  const window = upcoming.slice(0, MAX_SCHEDULED);

  for (const { dose, offsetMin, when } of window) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: offsetMin > 0 ? `Dose in ${offsetMin} min` : 'Dose due',
        body: buildBody(dose),
        sound: 'default',
        data: { scheduledDoseId: dose.id, peptideId: dose.peptideId, offsetMin },
        ...(Platform.OS === 'android' ? { channelId: CHANNEL_ID } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: when,
      },
    });
  }

  return {
    scheduled: window.length,
    skippedPast,
    truncated: upcoming.length > MAX_SCHEDULED,
  };
}

export async function cancelAllReminders(): Promise<void> {
  if (isExpoGo || Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function pendingReminderCount(): Promise<number> {
  if (isExpoGo || Platform.OS === 'web') return 0;
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  return pending.length;
}
