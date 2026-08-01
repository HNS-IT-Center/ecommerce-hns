import { NextRequest, NextResponse } from "next/server"
import { env } from "@/config/env"
import Groq from "groq-sdk"
// import { GoogleGenAI } from "@google/genai"

export async function POST(req: NextRequest) {
  try {
    const groqApiKey = env.GROQ_API_KEY
    if (!groqApiKey) {
      return NextResponse.json(
        { error: "GROQ_API_KEY is not configured in the environment variables." },
        { status: 500 }
      )
    }

    const body = await req.json()
    const { text } = body

    if (!text || typeof text !== "string") {
      return NextResponse.json({ error: "No text provided to format." }, { status: 400 })
    }

    const prompt = `You are a helpful assistant for an e-commerce platform.
Your task is to take messy, unstructured product specifications (often copied from other marketplaces) and convert them into a clean HTML <table>.

Rules:
1. Extract ALL important details. Do NOT remove any specification that seems important.
2. Put the specification name in the first column (<td>) and the value in the second column (<td>).
3. The table MUST have zebra rows and a hover effect using Tailwind CSS classes. Use the following exact HTML structure:
<table class="w-full text-sm text-left">
  <tbody>
    <tr class="border-b even:bg-muted/30 hover:bg-muted/50 transition-colors">
      <td class="py-2 px-3 font-semibold w-1/3">Key</td>
      <td class="py-2 px-3 text-muted-foreground">Value</td>
    </tr>
    <!-- repeat for all specs -->
  </tbody>
</table>
4. Do NOT wrap the table in markdown code blocks like \`\`\`html.
5. ONLY return the exact raw HTML string for the <table>...</table>, nothing else. No introductions or conclusions.

Here is the messy text to format:
---
${text}
---`

    const groq = new Groq({ apiKey: groqApiKey })

    const response = await groq.chat.completions.create({
      messages: [{ role: "user", content: prompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1, // Keep it deterministic
    })

    let cleanHtml = response.choices[0]?.message?.content || ""

    // --- GEMINI CODE (Commented out for future use) ---
    /*
    const geminiApiKey = env.GEMINI_API_KEY
    if (!geminiApiKey) throw new Error("GEMINI_API_KEY is missing")
    const ai = new GoogleGenAI({ apiKey: geminiApiKey })
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    })
    let cleanHtml = response.text || ""
    */
    // ----------------------------------------------------

    // Remove potential markdown wrappers just in case the AI ignored the instruction
    cleanHtml = cleanHtml.replace(/^```html\n?/i, "").replace(/\n?```$/i, "").trim()

    return NextResponse.json({ html: cleanHtml })
  } catch (error) {
    console.error("AI Formatting Error:", error)
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      { error: `Gagal merapikan spesifikasi: ${message}` },
      { status: 500 }
    )
  }
}
