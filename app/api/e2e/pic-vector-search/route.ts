import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const QDRANT_ENDPOINT = process.env.Qdrant_Cluster_Endpoint;
const QDRANT_API_KEY = process.env.Qdrant_API_Key;
const DEFAULT_COLLECTION = "pic_9ee91b08-448b-4cf4-8b3d-79c6f1c71fef";
const COLLECTION_PREFIX = "pic_";

async function collectionExists(collectionName: string): Promise<boolean> {
  const url = `${QDRANT_ENDPOINT}/collections/${collectionName}`;
  const res = await fetch(url, {
    method: "GET",
    headers: { "api-key": QDRANT_API_KEY! },
  });
  return res.ok;
}

async function embedText(text: string): Promise<number[]> {
  const geminiHost =
    process.env.GEMINI_HOST || "https://generativelanguage.googleapis.com";
  const geminiApiKey = process.env.GEMINI_API_KEY;

  if (!geminiApiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const url = `${geminiHost}/v1beta/models/gemini-embedding-001:embedContent?key=${geminiApiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: { parts: [{ text }] },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Gemini embedding failed (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();
  const values: number[] = data?.embedding?.values;

  if (!values || !Array.isArray(values)) {
    throw new Error("Unexpected Gemini embedding response format");
  }

  return values;
}

async function searchQdrant(
  collectionName: string,
  vector: number[],
  limit: number
) {
  const url = `${QDRANT_ENDPOINT}/collections/${collectionName}/points/search`;

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
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Qdrant search failed (${response.status}): ${errorText}`
    );
  }

  const data = await response.json();
  return data?.result || [];
}

export async function POST(request: Request) {
  try {
    if (!QDRANT_ENDPOINT || !QDRANT_API_KEY) {
      return NextResponse.json(
        { success: false, error: "Qdrant configuration is missing" },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { pic_id, chat_content } = body;

    if (!chat_content || typeof chat_content !== "string") {
      return NextResponse.json(
        { success: false, error: "Missing or invalid chat_content" },
        { status: 400 }
      );
    }

    // Determine collection: pic_<pic_id> if it exists, otherwise default
    let collectionName = DEFAULT_COLLECTION;
    if (pic_id) {
      const targetCollection = `${COLLECTION_PREFIX}${pic_id}`;
      const exists = await collectionExists(targetCollection);
      if (exists) {
        collectionName = targetCollection;
      }
      console.log(
        `[PIC Vector Search] pic_id=${pic_id}, collection=${collectionName}, exists=${exists}`
      );
    } else {
      console.log(
        `[PIC Vector Search] No pic_id provided, using default collection`
      );
    }

    // Truncate to 8000 chars as per embedding config
    const truncatedContent = chat_content.slice(0, 8000);

    // Embed and search
    const vector = await embedText(truncatedContent);
    const results = await searchQdrant(collectionName, vector, 5);

    return NextResponse.json({
      success: true,
      collection: collectionName,
      results,
    });
  } catch (error) {
    console.error("[PIC Vector Search] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Vector search failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
