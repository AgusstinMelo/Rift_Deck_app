const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { prompt, response_json_schema } = await req.json();

    if (!prompt) {
      return jsonResponse({ error: "Missing prompt" }, 400);
    }

    const apiKey = Deno.env.get("OPENROUTER_API_KEY");

    if (!apiKey) {
      return jsonResponse({ error: "Missing OPENROUTER_API_KEY" }, 500);
    }

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://riftdeck.app",
        "X-Title": "Rift Deck",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: [
              "Sos un analista experto de Wild Rift.",
              "Respondé únicamente JSON válido siguiendo el schema solicitado.",
              response_json_schema
                ? `Schema solicitado: ${JSON.stringify(response_json_schema)}`
                : "",
            ].filter(Boolean).join("\n"),
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        response_format: {
          type: "json_object",
        },
        temperature: 0.4,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return jsonResponse({
        error: "OpenRouter request failed",
        details: errorText,
      }, 500);
    }

    const completion = await response.json();
    const content = completion?.choices?.[0]?.message?.content;

    if (!content) {
      return jsonResponse({ error: "Empty AI response" }, 500);
    }

    let parsed;

    try {
      parsed = JSON.parse(content);
    } catch (_parseError) {
      return jsonResponse({
        error: "Invalid JSON from AI",
        raw: content,
      }, 500);
    }

    const safeResponse = {
      strategic_gaps: Array.isArray(parsed.strategic_gaps) ? parsed.strategic_gaps : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    };

    return jsonResponse(safeResponse);
  } catch (error) {
    return jsonResponse({
      error: error instanceof Error ? error.message : "Unexpected error",
    }, 500);
  }
});
