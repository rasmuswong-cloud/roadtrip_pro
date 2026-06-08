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
- Never output executable code.
`;

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
                    mutations: 'array of typed app mutations',
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

    return jsonResponse(JSON.parse(content));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ error: message }, 500);
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
