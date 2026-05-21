import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Centralized reusable CORS headers layout mapping
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

    const { imageBase64 } = await req.json()

    if (!imageBase64) {
      throw new Error("Missing imageBase64 data stream component parameters.")
    }

    console.log("Transmitting asset snapshot layout context directly into OpenAI Vision API...");

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "gpt-4o",
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { 
                type: "text", 
                text: "Extract item details from this food invoice. Return a valid JSON object with EXACTLY these keys: 'supplier' (string), 'total' (number), and 'lines' (array of objects containing 'name', 'qty', 'unit', 'price_per_unit', and 'line_total'). Do not write markdown blocks, just return raw JSON structural parameters." 
              },
              {
                type: "image_url",
                image_url: { 
                  url: `data:image/jpeg;base64,${imageBase64}` 
                }
              }
            ]
          }
        ]
      })
    })

    const aiResult = await response.json()
    
    if (aiResult.error) {
      throw new Error(`OpenAI API processing fault: ${aiResult.error.message}`)
    }

    if (!aiResult.choices?.[0]?.message?.content) {
      throw new Error("OpenAI was unable to extract structural data maps from this canvas snapshot layout.")
    }

    const parsedStructuredContent = JSON.parse(aiResult.choices[0].message.content)

    return new Response(JSON.stringify(parsedStructuredContent), {
      status: 200,
      headers: { 
        ...corsHeaders,
        "Content-Type": "application/json"
      },
    })

  } catch (error) {
    console.error("Local Runtime Edge Exception Catch Log Vector:", error.message);
    
    // Critical fix: Return all corsHeaders here so the UI can safely parse the exact exception string details
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 500,
      headers: { 
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    })
  }
})