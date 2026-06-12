const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const systemPrompt = `
You are ReseApp's proactive travel co-pilot. Convert natural language into safe,
minimal JSON mutation plans for a shared road-trip itinerary.

Rules:
- Return only JSON matching the provided schema.
- Do not invent bookings, purchases, ratings, or live availability.
- Prefer requiresConfirmation=true when a mutation affects time, budget, route, or lodging.
- Include warnings when timing, budget, opening hours, distance, or offline constraints may be risky.
- Use only these mutation type values: create_itinerary_node, create_expense, update_itinerary_node, create_poi.
- If the user only greets you, asks a question, or gives an unclear request, return mutations=[].
- Never output executable code.
`;

const responseJsonSchema = {
  type: 'object',
  properties: {
    reasoningSummary: { type: 'string' },
    confidence: { type: 'number' },
    mutations: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: {
            type: 'string',
            enum: ['create_itinerary_node', 'create_expense', 'update_itinerary_node', 'create_poi'],
          },
          tripId: { type: 'string' },
          nodeId: { type: 'string' },
          payload: { type: 'object' },
          patch: { type: 'object' },
        },
        required: ['type', 'tripId'],
      },
    },
    warnings: {
      type: 'array',
      items: { type: 'string' },
    },
    requiresConfirmation: { type: 'boolean' },
  },
  required: ['reasoningSummary', 'confidence', 'mutations', 'warnings', 'requiresConfirmation'],
};

const allowedMutationTypes = new Set(['create_itinerary_node', 'create_expense', 'update_itinerary_node', 'create_poi']);

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      return jsonResponse({ error: 'Missing GEMINI_API_KEY secret.' }, 500);
    }

    const authorization = request.headers.get('Authorization');
    if (!authorization) {
      return jsonResponse({ error: 'Sign in before using the AI co-pilot.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabasePublishableKey = getSupabasePublishableKey();
    if (!supabaseUrl || !supabasePublishableKey) {
      return jsonResponse({ error: 'Missing Supabase function environment.' }, 500);
    }

    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        Authorization: authorization,
        apikey: supabasePublishableKey,
      },
    });

    if (!userResponse.ok) {
      return jsonResponse({ error: 'Sign in before using the AI co-pilot.' }, 401);
    }

    const { input, context } = await request.json();
    if (typeof input !== 'string' || input.trim().length === 0) {
      return jsonResponse({ error: 'Command text is required.' }, 400);
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: systemPrompt }],
        },
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: JSON.stringify({
                  command: input.trim(),
                  context,
                  outputSchemaHint: {
                    reasoningSummary: 'short explanation',
                    confidence: '0..1',
                    mutations:
                      'array of typed app mutations; type must be exactly one of create_itinerary_node, create_expense, update_itinerary_node, create_poi',
                    warnings: 'array of proactive warnings',
                    requiresConfirmation: 'boolean',
                  },
                }),
              },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: 'application/json',
          responseJsonSchema,
          temperature: 0.2,
        },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return jsonResponse({ error: `Gemini request failed: ${detail}` }, response.status);
    }

    const payload = await response.json();
    const content = payload.candidates?.[0]?.content?.parts?.[0]?.text;
    if (typeof content !== 'string' || content.length === 0) {
      return jsonResponse({ error: 'AI agent returned an empty response.' }, 502);
    }

    return jsonResponse(normalizeMutationPlan(JSON.parse(content)));
  } catch (error) {
    console.error('parse-itinerary-command failed:', error);
    return jsonResponse({ error: 'Internal server error' }, 500);
  }
});

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  });
}

function normalizeMutationPlan(plan: Record<string, unknown>) {
  const warnings = Array.isArray(plan.warnings) ? plan.warnings.filter((warning) => typeof warning === 'string') : [];
  const mutations = Array.isArray(plan.mutations) ? plan.mutations : [];
  const validMutations = mutations.filter((mutation): mutation is Record<string, unknown> => {
    return typeof mutation === 'object' && mutation !== null && allowedMutationTypes.has(String((mutation as { type?: unknown }).type));
  });

  if (validMutations.length !== mutations.length) {
    warnings.push('AI returned an unsupported mutation type, so it was ignored.');
  }

  return {
    reasoningSummary: typeof plan.reasoningSummary === 'string' ? plan.reasoningSummary : 'AI returned a draft plan.',
    confidence: typeof plan.confidence === 'number' ? Math.max(0, Math.min(1, plan.confidence)) : 0.4,
    mutations: validMutations,
    warnings,
    requiresConfirmation: typeof plan.requiresConfirmation === 'boolean' ? plan.requiresConfirmation : true,
  };
}

function getSupabasePublishableKey(): string | null {
  const legacyAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (legacyAnonKey) {
    return legacyAnonKey;
  }

  const publishableKeys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (!publishableKeys) {
    return null;
  }

  try {
    const parsed = JSON.parse(publishableKeys) as Record<string, string | undefined>;
    return parsed.default ?? Object.values(parsed).find(Boolean) ?? null;
  } catch {
    return null;
  }
}
