// Time and routine planning utilities. All times stored as "minutes from midnight" (0–1439).

export type SlotKind =
  | "wake"
  | "dog"
  | "shower"
  | "breakfast"
  | "exercise"
  | "meditation"
  | "journal"
  | "custom";

export interface Slot {
  id: string;
  label: string;
  kind: SlotKind;
  duration: number; // minutes
  enabled: boolean;
  fixed?: boolean; // mandatory blocks the user can't disable
  emoji?: string;
}

export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"] as const;
export type DayKey = typeof DAYS[number];

export const TARGET_WAKE_MIN = 5 * 60 + 45; // 5:45 AM = 345

// ─── Time formatting ──────────────────────────────────────────────────────

export function fmtTime(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h24 = Math.floor(m / 60);
  const mm = m % 60;
  const period = h24 >= 12 ? "PM" : "AM";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${mm.toString().padStart(2, "0")} ${period}`;
}

export function fmtTime24(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h.toString().padStart(2, "0")}:${mm.toString().padStart(2, "0")}`;
}

export function parseTime24(value: string): number {
  // Accepts "HH:MM" 24h.
  const [h, m] = value.split(":").map((v) => parseInt(v, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

export function fmtDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} hr` : `${h}h ${m}m`;
}

// ─── Bedtime calc ─────────────────────────────────────────────────────────

/**
 * Given a wake time and desired sleep duration (hours), return the latest
 * "in-bed" time. Adds a fall-asleep buffer (default 15 min) so the user is
 * actually asleep by the time the math demands.
 */
export function computeBedtime(
  wakeMinutes: number,
  sleepHours: number,
  fallAsleepBuffer = 15,
): number {
  const total = sleepHours * 60 + fallAsleepBuffer;
  let bed = wakeMinutes - total;
  while (bed < 0) bed += 1440;
  return bed;
}

// ─── Gradual wake-up plan (14 days) ───────────────────────────────────────

export interface WakePlanEntry {
  day: number; // 1..14
  date: Date;
  wakeMinutes: number;
  bedtimeMinutes: number;
  shiftFromCurrent: number; // minutes earlier than starting wake
}

/**
 * Linearly interpolate from currentWake to TARGET_WAKE_MIN over `days` days
 * (default 14), keeping the same total sleep duration each day.
 *
 * If currentWake <= target, no shift is needed — we just hold the target.
 */
export function buildWakePlan(
  currentWakeMinutes: number,
  targetWakeMinutes: number,
  sleepHours: number,
  days = 14,
  startDate: Date = new Date(),
  fallAsleepBuffer = 15,
): WakePlanEntry[] {
  const totalShift = currentWakeMinutes - targetWakeMinutes; // positive if user wakes later than target
  const out: WakePlanEntry[] = [];
  for (let i = 0; i < days; i++) {
    // Ease shift across days: round to nearest 5 minutes for sanity
    const progress = days === 1 ? 1 : i / (days - 1);
    const rawWake = currentWakeMinutes - totalShift * progress;
    // round to nearest 5 minutes
    const wake = Math.round(rawWake / 5) * 5;
    const bed = computeBedtime(wake, sleepHours, fallAsleepBuffer);
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    out.push({
      day: i + 1,
      date,
      wakeMinutes: wake,
      bedtimeMinutes: bed,
      shiftFromCurrent: currentWakeMinutes - wake,
    });
  }
  return out;
}

// ─── Schedule layout ──────────────────────────────────────────────────────

export interface ScheduledSlot extends Slot {
  startMinutes: number;
  endMinutes: number;
}

/**
 * Given an ordered list of enabled slots and a wake time, lay them out
 * back-to-back starting at wake time.
 */
export function layoutSchedule(slots: Slot[], wakeMinutes: number): ScheduledSlot[] {
  const out: ScheduledSlot[] = [];
  let cursor = wakeMinutes;
  for (const s of slots) {
    if (!s.enabled) continue;
    out.push({ ...s, startMinutes: cursor, endMinutes: cursor + s.duration });
    cursor += s.duration;
  }
  return out;
}

// ─── Default slot set ─────────────────────────────────────────────────────

export const DEFAULT_SLOTS: Slot[] = [
  { id: "wake", label: "Wake & hydrate", kind: "wake", duration: 5, enabled: true, fixed: true, emoji: "☀️" },
  { id: "dog", label: "Dog walk", kind: "dog", duration: 20, enabled: true, fixed: true, emoji: "🐕" },
  { id: "exercise", label: "Exercise", kind: "exercise", duration: 25, enabled: true, emoji: "💪" },
  { id: "meditation", label: "Meditation", kind: "meditation", duration: 10, enabled: true, emoji: "🧘" },
  { id: "shower", label: "Shower", kind: "shower", duration: 15, enabled: true, fixed: true, emoji: "🚿" },
  { id: "journal", label: "Journal", kind: "journal", duration: 10, enabled: true, emoji: "📓" },
  { id: "breakfast", label: "Quick breakfast", kind: "breakfast", duration: 15, enabled: true, fixed: true, emoji: "🥣" },
];
