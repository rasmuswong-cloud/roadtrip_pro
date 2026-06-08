import { itineraryMutationSchema, type ItineraryMutationPlan } from './itineraryMutationSchema';
import { supabase } from '@/services/supabaseClient';

export type AgentContext = {
  tripId: string;
  userTimezone: string;
  currentIsoTime: string;
  tripSnapshot: Record<string, unknown>;
};

export async function parseItineraryCommand(input: string, context: AgentContext): Promise<ItineraryMutationPlan> {
  const { data, error } = await supabase.functions.invoke('parse-itinerary-command', {
    body: { input, context },
  });

  if (error) {
    throw new Error(error.message);
  }

  return itineraryMutationSchema.parse(data);
}
