import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Centralized reusable CORS headers layout mapping matching your existing infrastructure style
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  // Handle preflight CORS requests gracefully for browser security
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY')
    
    if (!OPENAI_API_KEY) {
      throw new Error("Missing system variable configuration context: OPENAI_API_KEY environment string is not bound inside local running container execution context.")
    }

    // Parse the live prompt and app database state slices sent from your React UI
    const { prompt, context } = await req.json()

    if (!prompt) {
      throw new Error("Missing conversational text prompt parameters.")
    }

    console.log("Transmitting localized dataset context parameters directly into OpenAI Chat Engine...");

    // Construct a grounded operational prompt mapping out all available active arrays for this specific kitchen id
    const systemInstruction = `You are "Sous", an elite AI Kitchen Operations Consultant and executive chef assistant.
You are talking to a kitchen team member with the role of: "${context?.role || 'Staff'}".
Your answers must be grounded explicitly in the following real-time database arrays pulled directly from their active kitchen profile layout:

RECIPES INVENTORY MATRIX: ${JSON.stringify(context?.recipes || [])}
BATCH PROCESSING COMPONENTS: ${JSON.stringify(context?.components || [])}
MATERIAL DISH SALES DATA: ${JSON.stringify(context?.sales || [])}
WASTAGE & LOSS LOG ENTRIES: ${JSON.stringify(context?.waste || [])}
DIARY SCHEDULER COVERS FORECASTS: ${JSON.stringify(context?.planner || [])}

Guidelines for your response layout:
1. Speak professionally, using kitchen terms cleanly (e.g., "Heard Chef", "Yes Boss").
2. When asked about margins, profitability, or recipe costs, inspect ingredients and calculate gross profit percentages (GP) dynamically based on their listed prices and yields.
3. If the user asks general culinary questions, prep advice, or optimization strategies, answer directly while actively linking your insights back to numbers found inside their live records above.
4. Keep answers highly concise, objective, and operational. Avoid fluffy introductory text.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Cost-effective, lightning-fast model optimized for structural parsing loops
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: prompt }
        ],
        temperature: 0.3 // Kept low to enforce strict adherence to numbers and financial analytics bounds
      })
    })

    const aiResult = await response.json()
    
    if (aiResult.error) {
      throw new Error(`OpenAI API processing fault: ${aiResult.error.message}`)
    }

    const aiReply = aiResult.choices?.[0]?.message?.content || "Heard. I reviewed the workspace indicators but could not compile a response matrix asset."

    return new Response(JSON.stringify({ reply: aiReply }), {
      status: 200,
      headers: { 
        ...corsHeaders,
        "Content-Type": "application/json"
      },
    })

  } catch (error) {
    console.error("Local Runtime Edge Exception Catch Log Vector:", error.message);
    
    // Returns all corsHeaders so the UI can safely display the exact error details inside the chat pane
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    })
  }
})