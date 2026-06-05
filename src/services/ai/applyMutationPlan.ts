import type { Expense, ItineraryNode, Poi } from '@/models';
import { upsertExpense, upsertItineraryNode } from '@/services/database/tripRepository';
import type { ItineraryMutationPlan } from './itineraryMutationSchema';

export type AppliedMutationResult = {
  itineraryNodes: ItineraryNode[];
  expenses: Expense[];
  pois: Poi[];
  warnings: string[];
};

export async function applyConfirmedMutationPlan(
  plan: ItineraryMutationPlan,
  actorId: string,
): Promise<AppliedMutationResult> {
  if (plan.requiresConfirmation) {
    throw new Error('Mutation plan requires user confirmation before applying.');
  }

  const itineraryNodes: ItineraryNode[] = [];
  const expenses: Expense[] = [];
  const pois: Poi[] = [];

  for (const mutation of plan.mutations) {
    if (mutation.type === 'create_itinerary_node') {
      const now = new Date().toISOString();
      const node: ItineraryNode = {
        id: cryptoRandomId(),
        tripId: mutation.tripId,
        createdBy: actorId,
        type: mutation.payload.nodeType,
        title: mutation.payload.title,
        notes: mutation.payload.notes ?? null,
        startsAt: mutation.payload.startsAt ?? null,
        endsAt: mutation.payload.endsAt ?? null,
        timezone: null,
        location: mutation.payload.location ?? null,
        sortOrder: Date.now(),
        reservation: {},
        equipment: [],
        facilities: {},
        metadata: mutation.payload.metadata,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        version: 1,
      };

      itineraryNodes.push(await upsertItineraryNode(node));
    }

    if (mutation.type === 'create_expense') {
      const now = new Date().toISOString();
      const expense: Expense = {
        id: cryptoRandomId(),
        tripId: mutation.tripId,
        itineraryNodeId: mutation.payload.itineraryNodeId ?? null,
        paidBy: actorId,
        category: mutation.payload.category,
        description: mutation.payload.description,
        amount: mutation.payload.amount,
        currency: mutation.payload.currency,
        occurredAt: mutation.payload.occurredAt ?? now,
        split: {},
        metadata: {},
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        version: 1,
      };

      expenses.push(await upsertExpense(expense));
    }
  }

  return { itineraryNodes, expenses, pois, warnings: plan.warnings };
}

function cryptoRandomId(): string {
  if ('crypto' in globalThis && 'randomUUID' in globalThis.crypto) {
    return globalThis.crypto.randomUUID();
  }

  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = Math.floor(Math.random() * 16);
    const value = char === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
