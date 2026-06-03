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

    const rawPayload = requestBody.image || requestBody.imageBase64 || requestBody.pdfText || requestBody.textContent || Object.values(requestBody)[0];

    if (!rawPayload || String(rawPayload).trim() === "") {
      throw new Error("Missing file payload data parameters. Component trace stream is empty.")
    }

    const cleanPayload = String(rawPayload).trim();

    // Smart Detection: base64 image strings have no spaces or newlines; text dumps do.
    const isTextPayload = cleanPayload.includes("\n") || cleanPayload.includes(" ");

    // Strict instruction with explicit price-extraction rules.
    // The previous version of this prompt did not stress that prices are
    // mandatory, and gpt-4o sometimes returned 0 for them. This version
    // makes it very clear: read every visible number; never default to 0.
    const jsonShapeInstruction =
      "Return a valid JSON object with EXACTLY these keys:\n" +
      "  'supplier' (string),\n" +
      "  'total' (number - the grand total at the bottom of the invoice),\n" +
      "  'lines' (array of objects each containing 'name' (string), 'qty' (number), 'unit' (string), 'price_per_unit' (number), and 'line_total' (number)).\n" +
      "\n" +
      "CRITICAL PRICE EXTRACTION RULES — read them carefully:\n" +
      " - Invoices have a UNIT PRICE column and a LINE TOTAL column. You MUST read BOTH columns for every row.\n" +
      " - Prices appear as numbers like '0.80', '6.50', '12.00', often preceded by a currency symbol like £, $, €, or ₱. Strip any currency symbol and return them as PLAIN NUMBERS.\n" +
      " - For each line, line_total ≈ qty × price_per_unit. Use this as your sanity check before responding.\n" +
      " - NEVER return 0 for price_per_unit or line_total if the invoice actually shows a price on that row. If a price is truly unreadable for some reason, return it as null (not 0).\n" +
      " - If you can read only one of the two (e.g. you can see line_total but not unit price, or vice versa), still return both — compute the other from qty.\n" +
      "\n" +
      "Do not write markdown code blocks, just return raw JSON.";

    let promptContentMessage: any[] = []

    if (isTextPayload) {
      console.log("Smart parser detected: Text/PDF document dump layout.");
      promptContentMessage = [
        {
          type: "text",
          text: `Extract invoice details from this structural data text block:\n\n${cleanPayload}\n\n${jsonShapeInstruction}`
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
          text: `Extract every line item from this food supplier invoice image. ${jsonShapeInstruction}`
        },
        {
          type: "image_url",
          image_url: {
            url: `data:image/jpeg;base64,${cleanBase64}`,
            detail: "high" // ask for higher-resolution analysis to catch small price columns
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
          { role: "user", content: promptContentMessage }
        ],
        temperature: 0
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

    // Post-validation: if the model returned lines but all prices are zero,
    // try one more time with an even stronger nudge, then return whatever we get.
    let parsed: any
    try { parsed = JSON.parse(content) } catch (_e) {
      return new Response(content, { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } })
    }

    const lines = Array.isArray(parsed?.lines) ? parsed.lines : []
    const allZero = lines.length > 0 && lines.every((l: any) => {
      const p = parseFloat(String(l.price_per_unit ?? '0').replace(/[^0-9.\-]/g, '')) || 0
      const t = parseFloat(String(l.line_total ?? '0').replace(/[^0-9.\-]/g, '')) || 0
      return p === 0 && t === 0
    })

    if (allZero && !isTextPayload) {
      console.log("First pass returned no prices — retrying with stronger emphasis.");
      const retry = await fetch("https://api.openai.com/v1/chat/completions", {
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
                  text:
                    "Look at this invoice image again. Your first reading dropped all prices. " +
                    "The invoice has a UNIT PRICE column AND a LINE TOTAL column with money in them — " +
                    "read every number in those two columns carefully and return them as plain numbers " +
                    "(strip £/$/€/₱ symbols). Sanity check: line_total ≈ qty × price_per_unit. " +
                    jsonShapeInstruction
                },
                promptContentMessage[1] // re-use the image part
              ]
            }
          ],
          temperature: 0
        })
      })
      const retryResult = await retry.json()
      const retryContent = retryResult?.choices?.[0]?.message?.content
      if (retryContent) {
        return new Response(retryContent, {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        })
      }
    }

    return new Response(content, {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })

  } catch (error: any) {
    console.error("Local Runtime Edge Exception Catch Log Vector:", error?.message || error)

    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    })
  }
})
