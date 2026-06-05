import { create } from 'zustand';
import type { Budget, Expense, ItineraryNode, Poi, Trip } from '@/models';
import type { ConflictRecord, PendingMutation } from '@/services/sync/types';

type TripStoreState = {
  activeTripId?: string;
  trips: Record<string, Trip>;
  itineraryNodes: Record<string, ItineraryNode>;
  pois: Record<string, Poi>;
  expenses: Record<string, Expense>;
  budgets: Record<string, Budget>;
  pendingMutations: PendingMutation[];
  conflicts: ConflictRecord[];
  setActiveTrip: (tripId: string) => void;
  upsertTrip: (trip: Trip) => void;
  upsertPoi: (poi: Poi) => void;
  upsertItineraryNodeOptimistic: (node: ItineraryNode, mutationId: string) => void;
  upsertExpenseOptimistic: (expense: Expense, mutationId: string) => void;
  enqueueMutation: (mutation: PendingMutation) => void;
  markMutationSynced: (mutationId: string) => void;
  registerConflict: (conflict: ConflictRecord) => void;
};

export const useTripStore = create<TripStoreState>((set) => ({
  trips: {},
  itineraryNodes: {},
  pois: {},
  expenses: {},
  budgets: {},
  pendingMutations: [],
  conflicts: [],
  setActiveTrip: (tripId) => set({ activeTripId: tripId }),
  upsertTrip: (trip) =>
    set((state) => ({
      trips: { ...state.trips, [trip.id]: trip },
    })),
  upsertPoi: (poi) =>
    set((state) => ({
      pois: { ...state.pois, [poi.id]: poi },
    })),
  upsertItineraryNodeOptimistic: (node, mutationId) =>
    set((state) => ({
      itineraryNodes: {
        ...state.itineraryNodes,
        [node.id]: { ...node, syncStatus: 'pending', clientMutationId: mutationId },
      },
    })),
  upsertExpenseOptimistic: (expense, mutationId) =>
    set((state) => ({
      expenses: {
        ...state.expenses,
        [expense.id]: { ...expense, syncStatus: 'pending', clientMutationId: mutationId },
      },
    })),
  enqueueMutation: (mutation) =>
    set((state) => ({
      pendingMutations: [...state.pendingMutations, mutation],
    })),
  markMutationSynced: (mutationId) =>
    set((state) => ({
      pendingMutations: state.pendingMutations.filter((mutation) => mutation.id !== mutationId),
    })),
  registerConflict: (conflict) =>
    set((state) => ({
      conflicts: [...state.conflicts, conflict],
      pendingMutations: state.pendingMutations.filter((mutation) => mutation.id !== conflict.mutation.id),
    })),
}));
