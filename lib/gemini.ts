export async function callGemini(prompt: string, model: string = "gemini-1.5-flash", systemPrompt?: string, tools?: any[]) {
  const apiKey = process.env.GEMINI_API_KEY;
  const host = process.env.GEMINI_HOST || "https://generativelanguage.googleapis.com";
  const url = `${host}/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const requestBody: any = {
    contents: [
      {
        parts: [
          {
            text: prompt,
          },
        ],
      },
    ],
  }

  if (systemPrompt) {
    requestBody.system_instruction = { parts: [{ text: systemPrompt }] }
  }

  if (tools && tools.length > 0) {
    requestBody.tools = tools
  }

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Gemini API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}
