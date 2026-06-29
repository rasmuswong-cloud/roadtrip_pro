import type { ItineraryNode } from '@/models';

const DAY_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export function normalizeDayKey(value: string): string | null {
  const trimmed = value.trim();
  const match = trimmed.match(DAY_KEY_PATTERN);
  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return trimmed;
}

export function dayKeyForNode(node: ItineraryNode): string {
  return node.startsAt ? node.startsAt.slice(0, 10) : 'unscheduled';
}

export function mergeManualDayKeys(nodeDayKeys: string[], manualDayKeys: string[]): string[] {
  const scheduledKeys = new Set<string>();
  let hasUnscheduled = false;

  [...nodeDayKeys, ...manualDayKeys].forEach((key) => {
    if (key === 'unscheduled') {
      hasUnscheduled = true;
      return;
    }

    const normalized = normalizeDayKey(key);
    if (normalized) {
      scheduledKeys.add(normalized);
    }
  });

  const merged = Array.from(scheduledKeys).sort((a, b) => a.localeCompare(b));
  return hasUnscheduled ? [...merged, 'unscheduled'] : merged;
}

export function suggestNewDayKey(dayKeys: string[], fallbackDate = new Date()): string {
  const scheduledKeys = Array.from(new Set(dayKeys.map(normalizeDayKey).filter((key): key is string => Boolean(key))))
    .sort((a, b) => a.localeCompare(b));

  for (let index = 0; index < scheduledKeys.length - 1; index += 1) {
    const currentTime = keyToUtcTime(scheduledKeys[index]!);
    const nextTime = keyToUtcTime(scheduledKeys[index + 1]!);

    if (nextTime - currentTime > MS_PER_DAY) {
      return utcTimeToKey(currentTime + MS_PER_DAY);
    }
  }

  if (scheduledKeys.length > 0) {
    return utcTimeToKey(keyToUtcTime(scheduledKeys[scheduledKeys.length - 1]!) + MS_PER_DAY);
  }

  return utcTimeToKey(Date.UTC(
    fallbackDate.getUTCFullYear(),
    fallbackDate.getUTCMonth(),
    fallbackDate.getUTCDate(),
    12,
    0,
    0,
  ));
}

function keyToUtcTime(key: string): number {
  const [year, month, day] = key.split('-').map(Number);
  return Date.UTC(year!, month! - 1, day!, 12, 0, 0);
}

function utcTimeToKey(value: number): string {
  return new Date(value).toISOString().slice(0, 10);
}
