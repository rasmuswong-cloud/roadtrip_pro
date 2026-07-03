import type { ItineraryNode, RouteSummary } from './itinerary';
import type { DaySummary } from '@/services/planning/dayAnalysis';

export type DayChecklistItem = {
  label: string;
  done: boolean;
  action: 'search_lodging' | 'edit_cost' | 'set_time' | 'search_location' | 'edit_booking' | 'split_drive';
};

export type DayInsightSummary = {
  lodgingLabel: string;
  activitiesLabel: string;
  driveLabel: string;
  costLabel: string;
  nextAction: string;
  hasLodging: boolean;
  activityCount: number;
  isLongDrive: boolean;
  checklist: DayChecklistItem[];
  packingItems: string[];
  packedItems: string[];
};

export type BudgetCategories = {
  lodging: number;
  activity: number;
  transport: number;
  food: number;
  parking: number;
  other: number;
};

export type BudgetSummary = {
  total: number;
  categories: BudgetCategories;
  missingCostCount: number;
  warnings: string[];
};

export type DayPlan = {
  key: string;
  title: string;
  shortTitle: string;
  nodes: ItineraryNode[];
  route: RouteSummary;
  budget: BudgetSummary;
  summary: DaySummary;
  smartFlags: string[];
  insight: DayInsightSummary;
};
