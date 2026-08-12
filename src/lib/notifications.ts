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
 */

const MAX_SCHEDULED = 56;
const CHANNEL_ID = 'peptide-reminders';

let handlerConfigured = false;

export function configureNotificationHandler(): void {
  if (handlerConfigured) return;
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
  if (Platform.OS !== 'android') return;
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
  if (Platform.OS === 'web') return 'unsupported';
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) return 'granted';
  if (settings.canAskAgain) return 'undetermined';
  return 'denied';
}

export async function requestPermission(): Promise<PermissionState> {
  if (Platform.OS === 'web') return 'unsupported';
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

function triggerDate(dose: ScheduledDose): Date {
  const date = fromISODate(dose.date);
  const [hours, minutes] = dose.time.split(':').map(Number);
  date.setHours(hours ?? 8, minutes ?? 0, 0, 0);
  return date;
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
 */
export async function syncReminders(doses: ScheduledDose[]): Promise<ScheduleResult> {
  if (Platform.OS === 'web') return { scheduled: 0, skippedPast: 0, truncated: false };

  const permission = await getPermissionState();
  if (permission !== 'granted') return { scheduled: 0, skippedPast: 0, truncated: false };

  await Notifications.cancelAllScheduledNotificationsAsync();
  await ensureAndroidChannel();

  const now = Date.now();
  const upcoming = doses
    .map((dose) => ({ dose, when: triggerDate(dose) }))
    .filter((entry) => entry.when.getTime() > now + 60_000)
    .sort((a, b) => a.when.getTime() - b.when.getTime());

  const skippedPast = doses.length - upcoming.length;
  const window = upcoming.slice(0, MAX_SCHEDULED);

  for (const { dose, when } of window) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Dose due',
        body: buildBody(dose),
        sound: 'default',
        data: { scheduledDoseId: dose.id, peptideId: dose.peptideId },
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
  if (Platform.OS === 'web') return;
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function pendingReminderCount(): Promise<number> {
  if (Platform.OS === 'web') return 0;
  const pending = await Notifications.getAllScheduledNotificationsAsync();
  return pending.length;
}
