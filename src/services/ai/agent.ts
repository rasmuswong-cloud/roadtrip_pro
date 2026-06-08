import { itineraryMutationSchema, type ItineraryMutationPlan } from './itineraryMutationSchema';
import { supabase } from '@/services/supabaseClient';

export type AgentContext = {
  tripId: string;
  userTimezone: string;
  currentIsoTime: string;
  tripSnapshot: Record<string, unknown>;
};

export async function parseItineraryCommand(input: string, context: AgentContext): Promise<ItineraryMutationPlan> {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token) {
    throw new Error('Connect before using the AI co-pilot.');
  }

  const response = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/parse-itinerary-command`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ input, context }),
  });

  const responseText = await response.text();
  const data = responseText ? JSON.parse(responseText) : null;

  if (!response.ok) {
    throw new Error(typeof data?.error === 'string' ? data.error : responseText || `AI function failed with ${response.status}.`);
  }

  return itineraryMutationSchema.parse(data);
}
