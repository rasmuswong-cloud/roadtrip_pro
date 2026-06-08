import type { Expense, ItineraryNode, Poi } from '@/models';
import { upsertPoi } from '@/services/database/poiRepository';
import { upsertExpense, upsertItineraryNode } from '@/services/database/tripRepository';
import type { ItineraryMutationPlan } from './itineraryMutationSchema';

export type AppliedMutationResult = {
  itineraryNodes: ItineraryNode[];
  expenses: Expense[];
  pois: Poi[];
  warnings: string[];
};

type ApplyMutationOptions = {
  confirmed?: boolean;
  existingNodes?: ItineraryNode[];
};

export async function applyConfirmedMutationPlan(
  plan: ItineraryMutationPlan,
  actorId: string,
  options: ApplyMutationOptions = {},
): Promise<AppliedMutationResult> {
  if (plan.requiresConfirmation && !options.confirmed) {
    throw new Error('Mutation plan requires user confirmation before applying.');
  }

  const itineraryNodes: ItineraryNode[] = [];
  const expenses: Expense[] = [];
  const pois: Poi[] = [];
  const warnings = [...plan.warnings];

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

    if (mutation.type === 'update_itinerary_node') {
      const existingNode = options.existingNodes?.find((node) => node.id === mutation.nodeId);
      if (!existingNode) {
        warnings.push(`Skipped update for missing itinerary node ${mutation.nodeId}.`);
        continue;
      }

      itineraryNodes.push(await upsertItineraryNode(applySafeNodePatch(existingNode, mutation.patch)));
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

    if (mutation.type === 'create_poi') {
      const now = new Date().toISOString();
      const poi: Poi = {
        id: cryptoRandomId(),
        tripId: mutation.tripId,
        createdBy: actorId,
        name: mutation.payload.name,
        category: mutation.payload.category,
        location: {
          latitude: mutation.payload.latitude,
          longitude: mutation.payload.longitude,
        },
        address: mutation.payload.address ?? null,
        source: 'custom',
        externalRef: `ai:${cryptoRandomId()}`,
        rating: null,
        openingHours: {},
        contact: {},
        imagery: [],
        metadata: mutation.payload.metadata,
        isPrivate: true,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        version: 1,
      };

      pois.push(await upsertPoi(poi));
    }
  }

  return { itineraryNodes, expenses, pois, warnings };
}

function applySafeNodePatch(node: ItineraryNode, patch: Record<string, unknown>): ItineraryNode {
  const next: ItineraryNode = {
    ...node,
    updatedAt: new Date().toISOString(),
    version: node.version + 1,
  };

  if (typeof patch.title === 'string' && patch.title.trim()) {
    next.title = patch.title.trim();
  }

  if (typeof patch.notes === 'string' || patch.notes === null) {
    next.notes = patch.notes;
  }

  if (typeof patch.startsAt === 'string' || patch.startsAt === null) {
    next.startsAt = patch.startsAt;
  }

  if (typeof patch.endsAt === 'string' || patch.endsAt === null) {
    next.endsAt = patch.endsAt;
  }

  if (patch.location === null) {
    next.location = null;
  } else if (isCoordinates(patch.location)) {
    next.location = patch.location;
  }

  return next;
}

function isCoordinates(value: unknown): value is NonNullable<ItineraryNode['location']> {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const maybeCoordinates = value as { latitude?: unknown; longitude?: unknown };
  return (
    typeof maybeCoordinates.latitude === 'number' &&
    typeof maybeCoordinates.longitude === 'number' &&
    maybeCoordinates.latitude >= -90 &&
    maybeCoordinates.latitude <= 90 &&
    maybeCoordinates.longitude >= -180 &&
    maybeCoordinates.longitude <= 180
  );
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
