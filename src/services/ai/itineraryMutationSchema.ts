import { z } from 'zod';

export const itineraryMutationSchema = z.object({
  reasoningSummary: z.string().min(1),
  confidence: z.number().min(0).max(1),
  mutations: z
    .array(
      z.discriminatedUnion('type', [
        z.object({
          type: z.literal('create_itinerary_node'),
          tripId: z.string().uuid(),
          payload: z.object({
            title: z.string().min(1),
            nodeType: z.enum(['lodging', 'camping', 'activity', 'gastronomy', 'fuel', 'transport', 'note', 'custom']),
            startsAt: z.string().datetime().optional(),
            endsAt: z.string().datetime().optional(),
            notes: z.string().optional(),
            location: z
              .object({
                latitude: z.number().min(-90).max(90),
                longitude: z.number().min(-180).max(180),
              })
              .optional(),
            metadata: z.record(z.unknown()).default({}),
          }),
        }),
        z.object({
          type: z.literal('create_expense'),
          tripId: z.string().uuid(),
          payload: z.object({
            description: z.string().min(1),
            category: z.string().min(1),
            amount: z.number().nonnegative(),
            currency: z.string().length(3),
            occurredAt: z.string().datetime().optional(),
            itineraryNodeId: z.string().uuid().optional(),
          }),
        }),
        z.object({
          type: z.literal('update_itinerary_node'),
          tripId: z.string().uuid(),
          nodeId: z.string().uuid(),
          patch: z.record(z.unknown()),
        }),
        z.object({
          type: z.literal('create_poi'),
          tripId: z.string().uuid(),
          payload: z.object({
            name: z.string().min(1),
            category: z.string().min(1),
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            address: z.string().optional(),
            metadata: z.record(z.unknown()).default({}),
          }),
        }),
      ]),
    )
    .default([]),
  warnings: z.array(z.string()).default([]),
  requiresConfirmation: z.boolean().default(true),
});

export type ItineraryMutationPlan = z.infer<typeof itineraryMutationSchema>;
