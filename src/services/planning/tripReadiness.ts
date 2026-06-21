export type TripReadinessInput = {
  stopCount: number;
  missingCoordinateCount: number;
  missingCostCount: number;
  missingBookingCount: number;
};

export type TripReadinessItem = {
  label: string;
  status: 'ready' | 'warning';
  detail: string;
};

export type TripNextStep = {
  label: string;
  target: 'route' | 'days' | 'budget' | 'tools';
  detail: string;
};

export function buildTripReadiness(input: TripReadinessInput): {
  items: TripReadinessItem[];
  nextStep: TripNextStep;
} {
  const items: TripReadinessItem[] = [
    {
      label: 'Rutt',
      status: input.stopCount > 1 ? 'ready' : 'warning',
      detail: input.stopCount > 1 ? `${input.stopCount} stopp planerade` : 'Lägg till minst två stopp',
    },
    {
      label: 'Karta',
      status: input.missingCoordinateCount === 0 ? 'ready' : 'warning',
      detail: input.missingCoordinateCount === 0 ? 'Alla stopp har kartposition' : `${input.missingCoordinateCount} saknar kartposition`,
    },
    {
      label: 'Budget',
      status: input.missingCostCount === 0 ? 'ready' : 'warning',
      detail: input.missingCostCount === 0 ? 'Kostnader ser kompletta ut' : `${input.missingCostCount} stopp saknar kostnad`,
    },
    {
      label: 'Bokningar',
      status: input.missingBookingCount === 0 ? 'ready' : 'warning',
      detail: input.missingBookingCount === 0 ? 'Inga uppenbara bokningsluckor' : `${input.missingBookingCount} boenden saknar referens`,
    },
  ];

  if (input.stopCount < 2) {
    return { items, nextStep: { label: 'Granska dagarna', target: 'days', detail: 'Börja med att lägga upp resans stopp.' } };
  }

  if (input.missingCoordinateCount > 0) {
    return { items, nextStep: { label: 'Granska rutten', target: 'route', detail: 'Komplettera kartpositioner så kartan och rutten blir tydliga.' } };
  }

  if (input.missingCostCount > 0) {
    return { items, nextStep: { label: 'Komplettera budget', target: 'budget', detail: 'Fyll i saknade kostnader för en bättre totalsumma.' } };
  }

  if (input.missingBookingCount > 0) {
    return { items, nextStep: { label: 'Granska dagarna', target: 'days', detail: 'Kontrollera boenden och bokningsreferenser.' } };
  }

  return { items, nextStep: { label: 'Res', target: 'days', detail: 'Planen är redo för dag-för-dag-läget.' } };
}
