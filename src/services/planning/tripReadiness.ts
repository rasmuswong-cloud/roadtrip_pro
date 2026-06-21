export type TripReadinessInput = {
  stopCount: number;
  dayCount?: number;
  missingCoordinateCount: number;
  missingCostCount: number;
  missingBookingCount: number;
  missingTimeCount?: number;
  planningGapCount?: number;
};

export type TripReadinessItem = {
  label: string;
  status: 'ready' | 'warning';
  detail: string;
};

export const TRIP_READINESS_TARGETS = ['overview', 'route', 'budget', 'days', 'tools'] as const;

export type TripReadinessTarget = typeof TRIP_READINESS_TARGETS[number];

export type TripNextStep = {
  label: string;
  target: TripReadinessTarget;
  detail: string;
};

export type TripReadinessGroupKey =
  | 'route_map'
  | 'days_time'
  | 'budget'
  | 'bookings'
  | 'other';

export type TripReadinessIssue = {
  id: string;
  group: TripReadinessGroupKey;
  label: string;
  count: number;
  detail: string;
  actionLabel: string;
  target: TripReadinessTarget;
};

export type TripReadinessGroup = {
  key: TripReadinessGroupKey;
  label: string;
  issues: TripReadinessIssue[];
};

export type TripReadiness = {
  isReady: boolean;
  title: string;
  subtitle: string;
  completedCheckCount: number;
  totalCheckCount: number;
  items: TripReadinessItem[];
  groups: TripReadinessGroup[];
  issues: TripReadinessIssue[];
  nextStep: TripNextStep;
};

export function buildTripReadiness(input: TripReadinessInput): TripReadiness {
  const normalizedInput: Required<TripReadinessInput> = {
    stopCount: input.stopCount,
    dayCount: input.dayCount ?? (input.stopCount > 0 ? 1 : 0),
    missingCoordinateCount: input.missingCoordinateCount,
    missingCostCount: input.missingCostCount,
    missingBookingCount: input.missingBookingCount,
    missingTimeCount: input.missingTimeCount ?? 0,
    planningGapCount: input.planningGapCount ?? 0,
  };
  const items = buildReadinessItems(normalizedInput);
  const issues = buildReadinessIssues(normalizedInput);
  const groups = groupIssues(issues);
  const completedCheckCount = items.filter((item) => item.status === 'ready').length;
  const isReady = issues.length === 0 && normalizedInput.stopCount > 1;

  return {
    isReady,
    title: isReady ? 'Resan är redo' : 'Resan behöver några sista detaljer',
    subtitle: isReady
      ? 'Klar för avresa. Rutt, karta, dagar, tider, budget och bokningar ser kompletta ut.'
      : 'Fyll i det som saknas innan avresa.',
    completedCheckCount,
    totalCheckCount: items.length,
    items,
    groups,
    issues,
    nextStep: chooseNextStep(normalizedInput, issues, isReady),
  };
}

function buildReadinessItems(input: Required<TripReadinessInput>): TripReadinessItem[] {
  return [
    {
      label: 'Rutt finns',
      status: input.stopCount > 1 ? 'ready' : 'warning',
      detail: input.stopCount > 1 ? `${input.stopCount} stopp planerade` : 'Lägg till minst två stopp',
    },
    {
      label: 'Kartpositioner finns',
      status: input.stopCount > 0 && input.missingCoordinateCount === 0 ? 'ready' : 'warning',
      detail: input.missingCoordinateCount === 0 ? 'Alla stopp har kartposition' : `${input.missingCoordinateCount} saknar kartposition`,
    },
    {
      label: 'Dagar är planerade',
      status: input.dayCount > 0 ? 'ready' : 'warning',
      detail: input.dayCount > 0 ? `${input.dayCount} dagar i resplanen` : 'Planera minst en dag',
    },
    {
      label: 'Tider finns',
      status: input.stopCount > 0 && input.missingTimeCount === 0 ? 'ready' : 'warning',
      detail: input.missingTimeCount === 0 ? 'Tider ser kompletta ut' : `${input.missingTimeCount} steg saknar tid`,
    },
    {
      label: 'Kostnader finns',
      status: input.missingCostCount === 0 ? 'ready' : 'warning',
      detail: input.missingCostCount === 0 ? 'Kostnader ser kompletta ut' : `${input.missingCostCount} steg saknar kostnad`,
    },
    {
      label: 'Bokningsreferenser finns',
      status: input.missingBookingCount === 0 ? 'ready' : 'warning',
      detail: input.missingBookingCount === 0 ? 'Inga uppenbara bokningsluckor' : `${input.missingBookingCount} bokningar saknar referens`,
    },
    {
      label: 'Inga uppenbara planeringsluckor',
      status: input.planningGapCount === 0 ? 'ready' : 'warning',
      detail: input.planningGapCount === 0 ? 'Planen har inga tydliga luckor' : `${input.planningGapCount} luckor behöver kollas`,
    },
  ];
}

function buildReadinessIssues(input: Required<TripReadinessInput>): TripReadinessIssue[] {
  const issues: TripReadinessIssue[] = [];

  if (input.stopCount < 2) {
    issues.push({
      id: 'route_missing',
      group: 'route_map',
      label: 'Rutt saknas',
      count: Math.max(0, 2 - input.stopCount),
      detail: 'Lägg till minst två stopp så resan får en tydlig start och målpunkt.',
      actionLabel: 'Granska rutten',
      target: 'route',
    });
  }

  if (input.missingCoordinateCount > 0) {
    issues.push({
      id: 'coordinates_missing',
      group: 'route_map',
      label: `${input.missingCoordinateCount} stopp saknar kartposition`,
      count: input.missingCoordinateCount,
      detail: 'Kartpositioner behövs för markörer och kartpreview.',
      actionLabel: 'Fyll i kartpositioner',
      target: 'route',
    });
  }

  if (input.dayCount <= 0) {
    issues.push({
      id: 'days_missing',
      group: 'days_time',
      label: 'Dagar saknas',
      count: 1,
      detail: 'Planera minst en dag så resan får en tydlig tidslinje.',
      actionLabel: 'Planera dagar',
      target: 'days',
    });
  }

  if (input.missingTimeCount > 0) {
    issues.push({
      id: 'times_missing',
      group: 'days_time',
      label: `${input.missingTimeCount} steg saknar tid`,
      count: input.missingTimeCount,
      detail: 'Tider gör dag-för-dag-planen lättare att följa.',
      actionLabel: 'Planera dagar',
      target: 'days',
    });
  }

  if (input.missingCostCount > 0) {
    issues.push({
      id: 'costs_missing',
      group: 'budget',
      label: `${input.missingCostCount} steg saknar kostnad`,
      count: input.missingCostCount,
      detail: 'Saknade kostnader gör totalen och per-person-beloppet för låga.',
      actionLabel: 'Lägg till saknade kostnader',
      target: 'budget',
    });
  }

  if (input.missingBookingCount > 0) {
    issues.push({
      id: 'booking_refs_missing',
      group: 'bookings',
      label: `${input.missingBookingCount} bokningar saknar referens`,
      count: input.missingBookingCount,
      detail: 'Lägg in referenser för boende och transport där bokning krävs.',
      actionLabel: 'Fyll i bokningsreferenser',
      target: 'days',
    });
  }

  if (input.planningGapCount > 0) {
    issues.push({
      id: 'planning_gaps',
      group: 'other',
      label: `${input.planningGapCount} planeringsluckor`,
      count: input.planningGapCount,
      detail: 'Kontrollera importerade eller ofullständiga steg innan avresa.',
      actionLabel: 'Granska dagarna',
      target: 'days',
    });
  }

  return issues;
}

function groupIssues(issues: TripReadinessIssue[]): TripReadinessGroup[] {
  const labels: Record<TripReadinessGroupKey, string> = {
    route_map: 'Rutt & karta',
    days_time: 'Dagar & tider',
    budget: 'Budget',
    bookings: 'Bokningar',
    other: 'Övrigt',
  };
  const keys: TripReadinessGroupKey[] = ['route_map', 'days_time', 'budget', 'bookings', 'other'];

  return keys
    .map((key) => ({
      key,
      label: labels[key],
      issues: issues.filter((issue) => issue.group === key),
    }))
    .filter((group) => group.issues.length > 0);
}

function chooseNextStep(input: Required<TripReadinessInput>, issues: TripReadinessIssue[], isReady: boolean): TripNextStep {
  if (isReady) {
    return { label: 'Klar för avresa', target: 'days', detail: 'Planen är redo. Öppna dagarna när det är dags att resa.' };
  }

  const issue = issues[0];
  if (issue) {
    return { label: issue.actionLabel, target: issue.target, detail: issue.detail };
  }

  if (input.stopCount === 0) {
    return { label: 'Planera dagar', target: 'days', detail: 'Börja med att lägga upp resans första stopp.' };
  }

  return { label: 'Granska rutten', target: 'route', detail: 'Kontrollera rutten innan avresa.' };
}
