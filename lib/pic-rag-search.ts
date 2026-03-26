const QDRANT_ENDPOINT = process.env.Qdrant_Cluster_Endpoint
const QDRANT_API_KEY = process.env.Qdrant_API_Key
const DEFAULT_COLLECTION = "pic_9ee91b08-448b-4cf4-8b3d-79c6f1c71fef"
const COLLECTION_PREFIX = "pic_"

async function collectionExists(collectionName: string): Promise<boolean> {
  const url = `${QDRANT_ENDPOINT}/collections/${collectionName}`
  const res = await fetch(url, {
    method: "GET",
    headers: { "api-key": QDRANT_API_KEY! },
  })
  return res.ok
}

async function embedText(text: string): Promise<number[]> {
  const geminiHost = process.env.GEMINI_HOST || "https://generativelanguage.googleapis.com"
  const geminiApiKey = process.env.GEMINI_API_KEY

  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured")
  }

  const url = `${geminiHost}/v1beta/models/gemini-embedding-001:embedContent?key=${geminiApiKey}`

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text }] },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Gemini embedding failed (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  const values: number[] = data?.embedding?.values

  if (!values || !Array.isArray(values)) {
    throw new Error("Unexpected Gemini embedding response format")
  }

  return values
}

async function searchQdrant(collectionName: string, vector: number[], limit: number) {
  const url = `${QDRANT_ENDPOINT}/collections/${collectionName}/points/search`

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": QDRANT_API_KEY!,
    },
    body: JSON.stringify({
      vector,
      limit,
      with_payload: true,
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Qdrant search failed (${response.status}): ${errorText}`)
  }

  const data = await response.json()
  return data?.result || []
}

/**
 * Search RAG with pic_id and chat content.
 * Returns raw results from Qdrant.
 */
export async function searchPicRAG(picId: string | null, chatContent: string, limit: number = 5) {
  if (!QDRANT_ENDPOINT || !QDRANT_API_KEY) {
    console.warn("[PIC RAG] Qdrant not configured, skipping")
    return []
  }

  let collectionName = DEFAULT_COLLECTION
  if (picId) {
    const targetCollection = `${COLLECTION_PREFIX}${picId}`
    const exists = await collectionExists(targetCollection)
    if (exists) {
      collectionName = targetCollection
    }
    console.log(`[PIC RAG] pic_id=${picId}, collection=${collectionName}, exists=${exists}`)
  }

  const truncatedContent = chatContent.slice(0, 8000)
  const vector = await embedText(truncatedContent)
  return searchQdrant(collectionName, vector, limit)
}

/**
 * Extract last customer message from messages_zalo array.
 * Customer messages have fromMe = false (or uidFrom != 0).
 */
export function getLastCustomerMessage(messagesZalo: any[]): string | null {
  if (!messagesZalo || !Array.isArray(messagesZalo) || messagesZalo.length === 0) {
    return null
  }

  for (let i = messagesZalo.length - 1; i >= 0; i--) {
    const msg = messagesZalo[i]
    const isCustomer = msg.fromMe === false || (msg.uidFrom && msg.uidFrom !== 0 && msg.uidFrom !== "0")
    if (isCustomer) {
      return typeof msg === "string" ? msg : (msg.text || msg.body || JSON.stringify(msg))
    }
  }

  return null
}

/**
 * Format RAG results as numbered examples for the worker agent.
 * Returns a string like:
 * example_1: "payload content"
 * example_2: "payload content"
 */
export function formatRAGExamples(results: any[]): string {
  if (!results || results.length === 0) return ""

  const lines: string[] = []
  results.forEach((result: any, idx: number) => {
    const payload = result.payload
    const content = payload?.full_document || payload?.chunk_text || payload?.text || JSON.stringify(payload || {})
    lines.push(`example_${idx + 1}: "${content}"`)
  })

  return lines.join("\n")
}
