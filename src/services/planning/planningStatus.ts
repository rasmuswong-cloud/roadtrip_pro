import type { DayPlan, ItineraryNode } from '@/models';
import { hasKnownNodeCost } from './costs';
import { isPlaceholderStop } from './placeholderStops';

export type PlanningStatusAction =
  | 'smart_stop'
  | 'search_location'
  | 'open_day'
  | 'calculate_route';

export type PlanningStatusItem = {
  id: string;
  label: string;
  actionLabel: string;
  action: PlanningStatusAction;
  dayKey?: string;
  nodeId?: string;
};

export type PlanningStatusSummary = {
  title: string;
  subtitle: string;
  items: PlanningStatusItem[];
};

export type PlanningStatusInput = {
  dayPlans: DayPlan[];
  routeIsCalculated: boolean;
  routeSkippedStopCount: number;
  maxItems?: number;
};

export function buildPlanningStatus(input: PlanningStatusInput): PlanningStatusSummary {
  const maxItems = input.maxItems ?? 5;
  const items = [
    ...placeholderItems(input.dayPlans),
    ...missingLocationItems(input.dayPlans),
    ...emptyDayItems(input.dayPlans),
    ...routeItems(input),
    ...missingAccommodationItems(input.dayPlans),
    ...missingTimeItems(input.dayPlans),
    ...missingCostItems(input.dayPlans),
  ].slice(0, maxItems);

  return {
    title: 'Planeringsstatus',
    subtitle: items.length > 0
      ? `${items.length} saker kvar att fixa innan resan känns klar.`
      : 'Resan ser redo ut för nästa genomgång.',
    items,
  };
}

function placeholderItems(dayPlans: DayPlan[]): PlanningStatusItem[] {
  return flatNodes(dayPlans)
    .filter(({ node }) => isPlaceholderStop(node) && !node.location)
    .map(({ dayPlan, node }) => ({
      id: `placeholder:${node.id}`,
      label: `Fyll placeholder: ${node.title}`,
      actionLabel: 'Hitta mellanstopp',
      action: 'smart_stop',
      dayKey: dayPlan.key,
      nodeId: node.id,
    }));
}

function missingLocationItems(dayPlans: DayPlan[]): PlanningStatusItem[] {
  return flatNodes(dayPlans)
    .filter(({ node }) => !isPlaceholderStop(node) && !node.location)
    .map(({ dayPlan, node }) => ({
      id: `location:${node.id}`,
      label: `Fixa plats för ${dayPlan.shortTitle}: ${node.title}`,
      actionLabel: 'Sök plats',
      action: 'search_location',
      dayKey: dayPlan.key,
      nodeId: node.id,
    }));
}

function emptyDayItems(dayPlans: DayPlan[]): PlanningStatusItem[] {
  return dayPlans
    .filter((dayPlan) => dayPlan.nodes.length === 0)
    .map((dayPlan) => ({
      id: `empty-day:${dayPlan.key}`,
      label: `${dayPlan.shortTitle} saknar stopp`,
      actionLabel: 'Öppna dag',
      action: 'open_day',
      dayKey: dayPlan.key,
    }));
}

function routeItems(input: PlanningStatusInput): PlanningStatusItem[] {
  if (input.routeSkippedStopCount > 0) {
    return [{
      id: 'route:skipped-stops',
      label: `Rutt hoppar över ${input.routeSkippedStopCount} stopp`,
      actionLabel: 'Beräkna rutt',
      action: 'calculate_route',
    }];
  }

  const stopCount = input.dayPlans.reduce((sum, dayPlan) => sum + dayPlan.nodes.length, 0);
  if (!input.routeIsCalculated && stopCount > 1) {
    return [{
      id: 'route:not-calculated',
      label: 'Beräkna rutt igen efter ändringar',
      actionLabel: 'Beräkna rutt',
      action: 'calculate_route',
    }];
  }

  return [];
}

function missingAccommodationItems(dayPlans: DayPlan[]): PlanningStatusItem[] {
  return dayPlans
    .filter((dayPlan) => dayPlan.key !== 'unscheduled' && dayPlan.nodes.length > 0 && !hasAccommodation(dayPlan.nodes))
    .map((dayPlan) => ({
      id: `accommodation:${dayPlan.key}`,
      label: `${dayPlan.shortTitle} kan behöva boende`,
      actionLabel: 'Öppna dag',
      action: 'open_day',
      dayKey: dayPlan.key,
    }));
}

function missingTimeItems(dayPlans: DayPlan[]): PlanningStatusItem[] {
  return flatNodes(dayPlans)
    .filter(({ node }) => !node.startsAt)
    .map(({ dayPlan, node }) => ({
      id: `time:${node.id}`,
      label: `Lägg in tid för ${node.title}`,
      actionLabel: 'Öppna dag',
      action: 'open_day',
      dayKey: dayPlan.key,
      nodeId: node.id,
    }));
}

function missingCostItems(dayPlans: DayPlan[]): PlanningStatusItem[] {
  return flatNodes(dayPlans)
    .filter(({ node }) => !hasKnownNodeCost(node))
    .map(({ dayPlan, node }) => ({
      id: `cost:${node.id}`,
      label: `Lägg in kostnad för ${node.title}`,
      actionLabel: 'Öppna dag',
      action: 'open_day',
      dayKey: dayPlan.key,
      nodeId: node.id,
    }));
}

function flatNodes(dayPlans: DayPlan[]): Array<{ dayPlan: DayPlan; node: ItineraryNode }> {
  return dayPlans.flatMap((dayPlan) => dayPlan.nodes.map((node) => ({ dayPlan, node })));
}

function hasAccommodation(nodes: ItineraryNode[]): boolean {
  return nodes.some((node) => node.type === 'lodging' || node.type === 'camping');
}
