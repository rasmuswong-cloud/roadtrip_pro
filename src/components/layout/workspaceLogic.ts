import type { ItineraryNode } from '@/models';
import type { AppTab, AppView } from './workspaceTypes';

export const APP_TABS: AppTab[] = [
  { key: 'overview', label: 'Översikt' },
  { key: 'explore', label: 'Utforska' },
  { key: 'days', label: 'Dagar' },
  { key: 'route', label: 'Rutt' },
  { key: 'budget', label: 'Budget' },
  { key: 'tools', label: 'Verktyg' },
];

export const APP_VIEW_KEYS = APP_TABS.map((tab) => tab.key);

export type DayShortcutTarget = {
  view: AppView;
  selectedDayKey: string;
};

export type BudgetCostEditorTarget = {
  view: AppView;
  nodeId: string;
  title: string;
  selectedDayKey: string;
};

export function resolveSelectedDayKey(visibleDayKeys: string[], selectedDayKey: string | null): string | null {
  if (visibleDayKeys.length === 0) {
    return null;
  }

  if (selectedDayKey && visibleDayKeys.includes(selectedDayKey)) {
    return selectedDayKey;
  }

  return visibleDayKeys[0] ?? null;
}

export function dayShortcutTarget(dayKey: string): DayShortcutTarget {
  return {
    view: 'days',
    selectedDayKey: dayKey,
  };
}

export function budgetCostEditorTarget(nodes: ItineraryNode[], nodeId: string): BudgetCostEditorTarget | null {
  const node = nodes.find((candidate) => candidate.id === nodeId);
  if (!node) {
    return null;
  }

  return {
    view: 'days',
    nodeId,
    title: node.title,
    selectedDayKey: dayKeyForNode(node),
  };
}

function dayKeyForNode(node: ItineraryNode): string {
  const key = typeof node.startsAt === 'string' ? node.startsAt.slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : 'unscheduled';
}
