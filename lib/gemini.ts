import { executeToolCall } from "@/lib/agent-tools";

const MAX_TOOL_CALLS = 3 // Prevent infinite loops

export async function callGemini(prompt: string, model: string = "gemini-1.5-flash", systemPrompt?: string, tools?: any[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  const host = process.env.GEMINI_HOST || "https://generativelanguage.googleapis.com";
  const url = `${host}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // Build initial contents
  const contents: any[] = [
    { role: "user", parts: [{ text: prompt }] },
  ]

  const baseBody: any = {}
  if (systemPrompt) {
    baseBody.system_instruction = { parts: [{ text: systemPrompt }] }
  }
  if (tools && tools.length > 0) {
    baseBody.tools = tools
  }

  // Function calling loop: send → check for functionCall → execute → feed result → repeat
  for (let iteration = 0; iteration <= MAX_TOOL_CALLS; iteration++) {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...baseBody, contents }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Gemini API error: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0]
    const parts = candidate?.content?.parts || []

    // Check if Gemini wants to call a function
    const functionCall = parts.find((p: any) => p.functionCall)
    if (functionCall && iteration < MAX_TOOL_CALLS) {
      const { name, args } = functionCall.functionCall
      console.log(`[Gemini] Function call: ${name}(${JSON.stringify(args)})`)

      // Execute the tool
      const toolResult = await executeToolCall(name, args || {})
      console.log(`[Gemini] Tool result (${name}): ${toolResult.slice(0, 200)}...`)

      // Append model's response (with functionCall) and our functionResponse to conversation
      contents.push({ role: "model", parts })
      contents.push({
        role: "user",
        parts: [{
          functionResponse: {
            name,
            response: { result: toolResult },
          },
        }],
      })

      continue // Loop back for Gemini to process the result
    }

    // No function call — return the text response
    const textPart = parts.find((p: any) => p.text)
    return textPart?.text || ""
  }

  throw new Error("Max tool call iterations exceeded")
}
