// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const OPENAI_API_KEY = (Deno as any).env.get('OPENAI_API_KEY')
    if (!OPENAI_API_KEY) {
      throw new Error("Missing system variable configuration context: OPENAI_API_KEY environment string is not bound.")
    }

    const requestBody = await req.json()
    console.log("Incoming request body keys:", Object.keys(requestBody));

    // Dynamically grab whatever data string was sent, regardless of the key name
    const rawPayload = requestBody.imageBase64 || requestBody.pdfText || requestBody.textContent || Object.values(requestBody)[0];

    if (!rawPayload || String(rawPayload).trim() === "") {
      throw new Error("Missing file payload data parameters. Component trace stream is empty.")
    }

    const cleanPayload = String(rawPayload).trim();

    // Smart Detection: Check if it's a raw text PDF dump or a base64 image string
    // If it contains spaces, newlines, or common invoice text like "Invoice" or "Total", treat it as text.
    const isTextPayload = cleanPayload.includes("\n") || 
                          cleanPayload.includes(" ") || 
                          cleanPayload.toLowerCase().includes("invoice") || 
                          cleanPayload.toLowerCase().includes("total");

    let promptContentMessage = []

    if (isTextPayload) {
      console.log("Smart parser detected: Text/PDF document dump layout.");
      promptContentMessage = [
        {
          type: "text",
          text: `Extract invoice matrix line details from this structural data text block:
          
          ${cleanPayload}
          
          Return a valid JSON object with EXACTLY these keys: 'supplier' (string), 'total' (number), and 'lines' (array of objects containing 'name', 'qty', 'unit', 'price_per_unit', and 'line_total'). Do not write markdown code blocks, just return raw JSON structural parameters.`
        }
      ]
    } else {
      console.log("Smart parser detected: Base64 image payload target stream.");
      let cleanBase64 = cleanPayload;
      if (cleanBase64.includes("base64,")) {
        cleanBase64 = cleanBase64.split("base64,").pop();
      }
      cleanBase64 = cleanBase64.trim();

      promptContentMessage = [
        { 
          type: "text", 
          text: "Extract item details from this food invoice image. Return a valid JSON object with EXACTLY these keys: 'supplier' (string), 'total' (number), and 'lines' (array of objects containing 'name', 'qty', 'unit', 'price_per_unit', and 'line_total'). Do not write markdown blocks, just return raw JSON structural parameters." 
        },
        {
          type: "image_url",
          image_url: { 
            url: `data:image/jpeg;base64,${cleanBase64}` 
          }
        }
      ]
    }

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
            content: promptContentMessage
          }
        ],
        temperature: 0.1
      })
    })

    const aiResult = await response.json()
    
    if (aiResult.error) {
      throw new Error(`OpenAI API processing fault: ${aiResult.error.message}`)
    }

    const content = aiResult.choices?.[0]?.message?.content
    if (!content) {
      throw new Error("OpenAI was unable to extract structural data maps from this file document matrix source.")
    }

    return new Response(content, {
      status: 200,
      headers: { 
        ...corsHeaders,
        "Content-Type": "application/json"
      },
    })

  } catch (error: any) {
    console.error("Local Runtime Edge Exception Catch Log Vector:", error?.message || error)
    
    return new Response(JSON.stringify({ error: error?.message || String(error) }), { 
      status: 500,
      headers: { 
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    })
  }
})