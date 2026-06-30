import type { ItineraryNode, ItineraryNodeType } from '@/models';
import {
  hasKnownDetailedNodeCost,
  hasKnownNodeCost,
  hasKnownRawNodeCost,
  parseCostValue,
} from '@/services/planning/costs';

export { parseCostValue } from '@/services/planning/costs';

export type BudgetCategoryKey =
  | 'lodging'
  | 'activity'
  | 'food'
  | 'fuel'
  | 'transport'
  | 'other';

export type BudgetCategorySummary = {
  key: BudgetCategoryKey;
  label: string;
  total: number;
  percentage: number;
  itemCount: number;
};

export type BudgetDaySummary = {
  key: string;
  label: string;
  dateLabel: string;
  routeLabel: string;
  total: number;
  itemCount: number;
  missingCostCount: number;
};

export type MissingCostItem = {
  nodeId: string;
  title: string;
  dayKey: string;
  dayLabel: string;
  typeLabel: string;
  place: string;
};

export type TravelBudgetCenter = {
  total: number;
  perPerson: number;
  travelerCount: number;
  costItemCount: number;
  missingCostCount: number;
  mostExpensiveDay: BudgetDaySummary | null;
  mostExpensiveCategory: BudgetCategorySummary | null;
  categories: BudgetCategorySummary[];
  days: BudgetDaySummary[];
  missingItems: MissingCostItem[];
  hasItineraryItems: boolean;
  hasRegisteredCosts: boolean;
};

const categoryLabels: Record<BudgetCategoryKey, string> = {
  lodging: 'Boende',
  activity: 'Aktivitet',
  food: 'Mat',
  fuel: 'Bränsle',
  transport: 'Transport',
  other: 'Övrigt',
};

const categoryOrder: BudgetCategoryKey[] = ['lodging', 'activity', 'food', 'fuel', 'transport', 'other'];
const likelyCostTypes = new Set<ItineraryNodeType>(['lodging', 'camping', 'activity', 'gastronomy', 'fuel', 'transport']);

export function buildTravelBudgetCenter(nodes: ItineraryNode[], travelerCount = 2): TravelBudgetCenter {
  const safeTravelerCount = normalizeTravelerCount(travelerCount);
  const categoryTotals = new Map<BudgetCategoryKey, { total: number; itemCount: number }>(
    categoryOrder.map((key) => [key, { total: 0, itemCount: 0 }]),
  );
  const dayMap = new Map<string, {
    nodes: ItineraryNode[];
    total: number;
    itemCount: number;
    missingCostCount: number;
  }>();
  const missingItems: MissingCostItem[] = [];

  nodes.forEach((node) => {
    const cost = nodeCostTotal(node);
    const category = budgetCategoryForNode(node);
    const categoryBucket = categoryTotals.get(category)!;
    const dayKey = dayKeyForNode(node);
    const dayBucket = dayMap.get(dayKey) ?? { nodes: [], total: 0, itemCount: 0, missingCostCount: 0 };

    dayBucket.nodes.push(node);
    if (hasKnownNodeCost(node)) {
      categoryBucket.total += cost;
      categoryBucket.itemCount += 1;
      dayBucket.total += cost;
      dayBucket.itemCount += 1;
    } else if (shouldTrackMissingCost(node)) {
      dayBucket.missingCostCount += 1;
      missingItems.push({
        nodeId: node.id,
        title: node.title,
        dayKey,
        dayLabel: formatDayLabel(dayKey),
        typeLabel: formatNodeType(node.type),
        place: placeLabel(node),
      });
    }

    dayMap.set(dayKey, dayBucket);
  });

  const total = Array.from(categoryTotals.values()).reduce((sum, bucket) => sum + bucket.total, 0);
  const categories = categoryOrder.map((key) => {
    const bucket = categoryTotals.get(key)!;
    return {
      key,
      label: categoryLabels[key],
      total: bucket.total,
      percentage: total > 0 ? bucket.total / total : 0,
      itemCount: bucket.itemCount,
    };
  });

  const days = Array.from(dayMap.entries()).map(([key, bucket], index) => ({
    key,
    label: key === 'unscheduled' ? 'Generella budgetposter' : `Dag ${index + 1}`,
    dateLabel: formatDayLabel(key),
    routeLabel: routeLabel(bucket.nodes),
    total: bucket.total,
    itemCount: bucket.itemCount,
    missingCostCount: bucket.missingCostCount,
  }));

  const mostExpensiveDay = [...days].sort((a, b) => b.total - a.total)[0] ?? null;
  const mostExpensiveCategory = [...categories].sort((a, b) => b.total - a.total)[0] ?? null;

  return {
    total,
    perPerson: total / safeTravelerCount,
    travelerCount: safeTravelerCount,
    costItemCount: categories.reduce((sum, category) => sum + category.itemCount, 0),
    missingCostCount: missingItems.length,
    mostExpensiveDay: mostExpensiveDay && mostExpensiveDay.total > 0 ? mostExpensiveDay : null,
    mostExpensiveCategory: mostExpensiveCategory && mostExpensiveCategory.total > 0 ? mostExpensiveCategory : null,
    categories,
    days,
    missingItems,
    hasItineraryItems: nodes.length > 0,
    hasRegisteredCosts: categories.some((category) => category.itemCount > 0),
  };
}

export function nodeCostTotal(node: ItineraryNode): number {
  return Object.values(nodeCostBreakdown(node)).reduce((sum, value) => sum + value, 0);
}

export function nodeCostBreakdown(node: ItineraryNode): Record<BudgetCategoryKey, number> {
  const empty: Record<BudgetCategoryKey, number> = {
    lodging: 0,
    activity: 0,
    food: 0,
    fuel: 0,
    transport: 0,
    other: 0,
  };
  const lodgingCost = parseCostValue(node.metadata.lodgingCostSek);
  const activityCost = parseCostValue(node.metadata.activityCostSek);

  if (hasKnownDetailedNodeCost(node)) {
    return {
      ...empty,
      lodging: lodgingCost,
      activity: activityCost,
    };
  }

  const rawCost = parseCostValue(node.metadata.costSek ?? node.metadata.cost ?? node.metadata.price);
  if (!hasKnownRawNodeCost(node)) {
    return empty;
  }

  return {
    ...empty,
    [budgetCategoryForNode(node)]: rawCost,
  };
}

export function budgetCategoryForNode(node: ItineraryNode): BudgetCategoryKey {
  switch (node.type) {
    case 'lodging':
    case 'camping':
      return 'lodging';
    case 'activity':
      return 'activity';
    case 'gastronomy':
      return 'food';
    case 'fuel':
      return 'fuel';
    case 'transport':
      return 'transport';
    default:
      return 'other';
  }
}

export function shouldTrackMissingCost(node: ItineraryNode): boolean {
  return likelyCostTypes.has(node.type) && !hasKnownNodeCost(node);
}

function normalizeTravelerCount(value: number): number {
  return Number.isFinite(value) && value > 0 ? Math.max(1, Math.round(value)) : 2;
}

function dayKeyForNode(node: ItineraryNode): string {
  const key = typeof node.startsAt === 'string' ? node.startsAt.slice(0, 10) : '';
  return /^\d{4}-\d{2}-\d{2}$/.test(key) ? key : 'unscheduled';
}

function formatDayLabel(dayKey: string): string {
  if (dayKey === 'unscheduled') {
    return 'Datum saknas';
  }

  return dayKey;
}

function routeLabel(nodes: ItineraryNode[]): string {
  if (nodes.length === 0) {
    return 'Inga stopp';
  }

  const first = placeLabel(nodes[0]);
  const last = placeLabel(nodes[nodes.length - 1]);
  return first === last ? first : `${first} → ${last}`;
}

function placeLabel(node: ItineraryNode | undefined): string {
  if (!node) {
    return 'Plats saknas';
  }

  if (typeof node.metadata.place === 'string' && node.metadata.place.trim()) {
    return node.metadata.place.trim();
  }

  return node.title;
}

function formatNodeType(type: ItineraryNodeType): string {
  switch (type) {
    case 'lodging':
      return 'Boende';
    case 'camping':
      return 'Camping';
    case 'activity':
      return 'Aktivitet';
    case 'gastronomy':
      return 'Mat';
    case 'fuel':
      return 'Bränsle';
    case 'transport':
      return 'Transport';
    case 'note':
      return 'Notis';
    default:
      return 'Övrigt';
  }
}
