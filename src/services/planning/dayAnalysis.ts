import type { ItineraryNode, ItineraryNodeType, RouteSummary } from '@/models';

export const DAY_ANALYSIS_LIMITS = {
  longDriveHours: 5,
  largeGapHours: 4,
  dailyBudgetSek: 3000,
} as const;

export type DayWarningCode =
  | 'missing_lodging'
  | 'long_drive'
  | 'missing_cost'
  | 'overlapping_times'
  | 'large_gap'
  | 'activity_without_location'
  | 'lodging_without_location'
  | 'daily_budget_exceeded'
  | 'incomplete_coordinates';

export type DayWarning = {
  code: DayWarningCode;
  message: string;
  severity: 'info' | 'warning';
  nodeId?: string;
};

export type PlannerDraft = {
  title: string;
  type: ItineraryNodeType;
  date?: string;
  startTime?: string;
  endTime?: string;
  cost?: string;
  latitude?: string;
  longitude?: string;
};

export type PlannerValidationResult = {
  valid: boolean;
  errors: string[];
};

export type DaySummary = {
  dayKey: string;
  dayNumber: number;
  startPlace: string;
  endPlace: string;
  stopCount: number;
  lodging: string;
  activityCount: number;
  costSek: number;
};

export function summarizeDay(nodes: ItineraryNode[], dayKey: string, dayNumber: number): DaySummary {
  const sortedNodes = sortItineraryNodes(nodes);
  const lodgingNode = sortedNodes.find((node) => node.type === 'lodging' || node.type === 'camping');
  const activityCount = sortedNodes.filter((node) => node.type === 'activity' || node.type === 'gastronomy' || node.type === 'custom').length;

  return {
    dayKey,
    dayNumber,
    startPlace: placeLabel(sortedNodes[0]),
    endPlace: placeLabel(sortedNodes[sortedNodes.length - 1]),
    stopCount: sortedNodes.length,
    lodging: lodgingNode?.title ?? 'Saknas',
    activityCount,
    costSek: calculateDayCost(sortedNodes),
  };
}

export function rollbackItineraryNodes(_currentNodes: ItineraryNode[], previousNodes: ItineraryNode[]): ItineraryNode[] {
  return sortItineraryNodes(previousNodes);
}

export function calculateDayCost(nodes: ItineraryNode[]): number {
  return nodes.reduce((sum, node) => sum + nodeCostTotal(node), 0);
}

export function sortItineraryNodes(nodes: ItineraryNode[]): ItineraryNode[] {
  return [...nodes].sort((a, b) => {
    const timeA = a.startsAt ? new Date(a.startsAt).getTime() : Number.POSITIVE_INFINITY;
    const timeB = b.startsAt ? new Date(b.startsAt).getTime() : Number.POSITIVE_INFINITY;

    if (timeA !== timeB) {
      return timeA - timeB;
    }

    return a.sortOrder - b.sortOrder;
  });
}

export function moveNodeToDay(nodes: ItineraryNode[], nodeId: string, dayKey: string): ItineraryNode[] {
  const dayNodes = sortItineraryNodes(nodes.filter((node) => node.id !== nodeId && dayKeyForNode(node) === dayKey));
  const movingNode = nodes.find((node) => node.id === nodeId);

  if (!movingNode) {
    return nodes;
  }

  const nextSortOrder = dayNodes.length > 0 ? Math.max(...dayNodes.map((node) => node.sortOrder)) + 100 : 100;
  const startsAt = dayKey === 'unscheduled' ? null : keepTimeOnDay(movingNode.startsAt, dayKey);

  return sortItineraryNodes(nodes.map((node) => (
    node.id === nodeId
      ? { ...node, startsAt, sortOrder: nextSortOrder, updatedAt: new Date().toISOString() }
      : node
  )));
}

export function validatePlannerDraft(draft: PlannerDraft): PlannerValidationResult {
  const errors: string[] = [];
  const hasLatitude = Boolean(draft.latitude?.trim());
  const hasLongitude = Boolean(draft.longitude?.trim());

  if (!draft.title.trim()) {
    errors.push('Titel måste fyllas i.');
  }

  if (draft.date?.trim() && !isValidDateInput(draft.date)) {
    errors.push('Datum ska anges som ÅÅÅÅ-MM-DD.');
  }

  if (draft.startTime?.trim() && !isValidTimeInput(draft.startTime)) {
    errors.push('Starttid ska anges som TT:MM.');
  }

  if (draft.endTime?.trim() && !isValidTimeInput(draft.endTime)) {
    errors.push('Sluttid ska anges som TT:MM.');
  }

  if (draft.cost?.trim() && parseCostValue(draft.cost) <= 0) {
    errors.push('Kostnad behöver vara ett positivt tal.');
  }

  if (hasLatitude !== hasLongitude) {
    errors.push('Ange både latitud och longitud, eller lämna båda tomma.');
  }

  if (hasLatitude && Number.isNaN(parseCoordinate(draft.latitude))) {
    errors.push('Latitud behöver vara ett giltigt nummer.');
  }

  if (hasLongitude && Number.isNaN(parseCoordinate(draft.longitude))) {
    errors.push('Longitud behöver vara ett giltigt nummer.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function analyzeDayWarnings(
  nodes: ItineraryNode[],
  route: RouteSummary,
  options: Partial<typeof DAY_ANALYSIS_LIMITS> = {},
): DayWarning[] {
  const limits = { ...DAY_ANALYSIS_LIMITS, ...options };
  const sortedNodes = sortItineraryNodes(nodes);
  const warnings: DayWarning[] = [];
  const hasLodging = sortedNodes.some((node) => node.type === 'lodging' || node.type === 'camping');
  const dayCost = calculateDayCost(sortedNodes);

  if (sortedNodes.length > 0 && !hasLodging) {
    warnings.push({ code: 'missing_lodging', severity: 'warning', message: 'Saknar boende eller camping för dagen.' });
  }

  if (route.durationSeconds / 3600 >= limits.longDriveHours) {
    warnings.push({ code: 'long_drive', severity: 'warning', message: 'Lång kördag. Överväg att dela upp rutten.' });
  }

  sortedNodes.forEach((node) => {
    if (nodeCostTotal(node) <= 0) {
      warnings.push({ code: 'missing_cost', severity: 'info', nodeId: node.id, message: `${node.title} saknar kostnad.` });
    }

    if ((node.type === 'activity' || node.type === 'gastronomy' || node.type === 'custom') && !node.location) {
      warnings.push({ code: 'activity_without_location', severity: 'info', nodeId: node.id, message: `${node.title} saknar plats.` });
    }

    if ((node.type === 'lodging' || node.type === 'camping') && !node.location) {
      warnings.push({ code: 'lodging_without_location', severity: 'warning', nodeId: node.id, message: `${node.title} saknar boendeplats.` });
    }

    if (hasIncompleteCoordinates(node)) {
      warnings.push({ code: 'incomplete_coordinates', severity: 'warning', nodeId: node.id, message: `${node.title} har ofullständiga koordinater.` });
    }
  });

  sortedNodes.forEach((node, index) => {
    const nextNode = sortedNodes[index + 1];
    if (!node.startsAt || !node.endsAt || !nextNode?.startsAt) {
      return;
    }

    const endsAt = new Date(node.endsAt).getTime();
    const nextStartsAt = new Date(nextNode.startsAt).getTime();
    const gapHours = (nextStartsAt - endsAt) / 3_600_000;

    if (gapHours < 0) {
      warnings.push({ code: 'overlapping_times', severity: 'warning', nodeId: nextNode.id, message: `${nextNode.title} överlappar föregående stopp.` });
    } else if (gapHours >= limits.largeGapHours) {
      warnings.push({ code: 'large_gap', severity: 'info', nodeId: nextNode.id, message: `Stort tomrum före ${nextNode.title}.` });
    }
  });

  if (dayCost > limits.dailyBudgetSek) {
    warnings.push({ code: 'daily_budget_exceeded', severity: 'warning', message: `Dagens kostnad överstiger ${limits.dailyBudgetSek} SEK.` });
  }

  return warnings;
}

function nodeCostTotal(node: ItineraryNode): number {
  return parseCostValue(node.metadata.costSek ?? node.metadata.cost ?? node.metadata.price)
    + parseCostValue(node.metadata.lodgingCostSek)
    + parseCostValue(node.metadata.activityCostSek);
}

function parseCostValue(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value !== 'string') {
    return 0;
  }

  const match = value.replace(/\s/g, '').replace(',', '.').match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

function hasIncompleteCoordinates(node: ItineraryNode): boolean {
  if (!node.location) {
    return false;
  }

  return !Number.isFinite(node.location.latitude) || !Number.isFinite(node.location.longitude);
}

function placeLabel(node: ItineraryNode | undefined): string {
  if (!node) {
    return 'Saknas';
  }

  if (typeof node.metadata.place === 'string' && node.metadata.place.trim()) {
    return node.metadata.place.trim();
  }

  return node.title;
}

function dayKeyForNode(node: ItineraryNode): string {
  return node.startsAt ? node.startsAt.slice(0, 10) : 'unscheduled';
}

function keepTimeOnDay(value: string | null | undefined, dayKey: string): string {
  const time = value ? value.slice(11, 19) : '09:00:00';
  return new Date(`${dayKey}T${time}`).toISOString();
}

function isValidDateInput(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T12:00:00`).getTime());
}

function isValidTimeInput(value: string): boolean {
  return /^\d{2}:\d{2}$/.test(value) && !Number.isNaN(new Date(`2026-01-01T${value}:00`).getTime());
}

function parseCoordinate(value: string | undefined): number {
  return Number(value?.replace(',', '.'));
}
