import OpenAI from 'openai';
import { itineraryMutationSchema, type ItineraryMutationPlan } from './itineraryMutationSchema';

export type AgentContext = {
  tripId: string;
  userTimezone: string;
  currentIsoTime: string;
  tripSnapshot: Record<string, unknown>;
};

const SYSTEM_PROMPT = `
You are ReseApp's proactive travel co-pilot. Convert natural language into safe,
minimal JSON mutation plans for a shared road-trip itinerary.

Rules:
- Return only JSON matching the provided schema.
- Do not invent bookings, purchases, ratings, or live availability.
- Prefer requiresConfirmation=true when a mutation affects time, budget, route, or lodging.
- Include warnings when timing, budget, opening hours, distance, or offline constraints may be risky.
- Never output executable code.
`;

export async function parseItineraryCommand(input: string, context: AgentContext): Promise<ItineraryMutationPlan> {
  const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  const response = await client.chat.completions.create({
    model: 'gpt-4o-mini',
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      {
        role: 'user',
        content: JSON.stringify({
          command: input,
          context,
          outputSchemaHint: {
            reasoningSummary: 'short explanation',
            confidence: '0..1',
            mutations: 'array of typed app mutations',
            warnings: 'array of proactive warnings',
            requiresConfirmation: 'boolean',
          },
        }),
      },
    ],
  });

  const content = response.choices[0]?.message.content;
  if (!content) {
    throw new Error('AI agent returned an empty response.');
  }

  return itineraryMutationSchema.parse(JSON.parse(content));
}
