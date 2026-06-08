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
    throw new Error(await getFunctionErrorMessage(error));
  }

  return itineraryMutationSchema.parse(data);
}

async function getFunctionErrorMessage(error: unknown): Promise<string> {
  const fallbackMessage = error instanceof Error ? error.message : String(error);
  const context = (error as { context?: unknown }).context;

  if (context instanceof Response) {
    try {
      const payload = await context.clone().json();
      if (typeof payload?.error === 'string') {
        return payload.error;
      }

      return JSON.stringify(payload);
    } catch {
      const text = await context.clone().text();
      if (text) {
        return text;
      }
    }
  }

  return fallbackMessage;
}
