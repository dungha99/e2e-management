interface LeadRow {
  brand?: string;
  model?: string;
  variant?: string;
  year?: number;
  location?: string;
  mileage?: number;
  price_customer?: number;
  price_highest_bid?: number;
  stage?: string;
  qualified?: string;
  intention?: string;
  negotiation_ability?: string;
  source?: string;
  notes?: string;
  customer_feedback?: string;
}

interface QdrantResult {
  id: string | number;
  score: number;
  payload?: {
    lead_id?: string;
    chunk_text?: string;
    chunk_index?: number;
    full_document?: string;
    car_info?: string;
    outcome?: string;
  };
}

function buildTemplateSentence(lead: LeadRow): string {
  const parts: string[] = [];

  const carParts = [lead.brand, lead.model, lead.variant].filter(Boolean).join(" ");
  if (carParts) {
    parts.push(`Xe ${carParts}${lead.year ? ` ${lead.year}` : ""}`);
  }

  if (lead.mileage) parts.push(`${lead.mileage} km`);
  if (lead.location) parts.push(`tại ${lead.location}`);
  if (lead.price_customer) parts.push(`giá khách ${lead.price_customer} triệu`);
  if (lead.price_highest_bid) parts.push(`giá dealer cao nhất ${lead.price_highest_bid} triệu`);
  if (lead.qualified) parts.push(`qualified: ${lead.qualified}`);
  if (lead.intention) parts.push(`intention: ${lead.intention}`);
  if (lead.negotiation_ability) parts.push(`negotiation: ${lead.negotiation_ability}`);
  if (lead.stage) parts.push(`stage: ${lead.stage}`);
  if (lead.source) parts.push(`source: ${lead.source}`);

  return parts.join(", ");
}

async function embedText(text: string): Promise<number[]> {
  const geminiHost = process.env.GEMINI_HOST || "https://generativelanguage.googleapis.com";
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
    throw new Error(`Gemini embedding failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const values: number[] = data?.embedding?.values;

  if (!values || !Array.isArray(values)) {
    throw new Error("Unexpected Gemini embedding response format");
  }

  console.log(`[Vector Search] Embedding dimension: ${values.length}`);
  return values;
}

async function searchQdrant(vector: number[], limit: number = 20): Promise<QdrantResult[]> {
  const endpoint = process.env.Qdrant_Cluster_Endpoint;
  const apiKey = process.env.Qdrant_API_Key;
  const collectionName = process.env.Qdrant_Cluster_Name || "vucar_deals_v3";

  if (!endpoint || !apiKey) {
    throw new Error("Qdrant configuration is missing (Qdrant_Cluster_Endpoint or Qdrant_API_Key)");
  }

  const url = `${endpoint}/collections/${collectionName}/points/search`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": apiKey,
    },
    body: JSON.stringify({
      vector,
      limit,
      with_payload: true,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Qdrant search failed (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const results: QdrantResult[] = data?.result || [];

  console.log(`[Vector Search] Qdrant returned ${results.length} results`);
  return results;
}

function buildSimilarLeadsContext(results: QdrantResult[]): string {
  if (!results || results.length === 0) return "";

  // Deduplicate by lead_id, keeping the highest-score chunk per lead
  const bestByLeadId = new Map<string, QdrantResult>();
  for (const result of results) {
    const leadId = result.payload?.lead_id;
    if (!leadId) continue;

    const existing = bestByLeadId.get(leadId);
    if (!existing || result.score > existing.score) {
      bestByLeadId.set(leadId, result);
    }
  }

  // Sort deduped results by score descending (already sorted from Qdrant, but ensure after dedup)
  const deduped = Array.from(bestByLeadId.values()).sort((a, b) => b.score - a.score);

  // Classify by outcome field: COMPLETED = WIN, FAILED = FAILED
  const failed: QdrantResult[] = [];
  const win: QdrantResult[] = [];

  for (const result of deduped) {
    const outcome = (result.payload?.outcome || "").toUpperCase();

    if (outcome === "FAILED") {
      if (failed.length < 3) failed.push(result);
    } else if (outcome === "COMPLETED") {
      if (win.length < 3) win.push(result);
    }

    // Stop early if we have enough
    if (failed.length >= 3 && win.length >= 3) break;
  }

  console.log(`[Vector Search] Classified ${win.length} WIN, ${failed.length} FAILED from ${deduped.length} unique leads`);

  if (win.length === 0 && failed.length === 0) return "";

  // Build formatted text
  const sections: string[] = [];

  if (win.length > 0) {
    sections.push("=== WIN CASES (Successful Outcomes) ===\n");
    win.forEach((result, idx) => {
      const leadId = result.payload?.lead_id || "unknown";
      const fullDoc = result.payload?.full_document || "";
      sections.push(`--- Case ${idx + 1} [WIN] (Lead ID: ${leadId}) ---`);
      sections.push(fullDoc);
      sections.push("");
    });
  }

  if (failed.length > 0) {
    sections.push("=== FAILED CASES (Unsuccessful Outcomes) ===\n");
    failed.forEach((result, idx) => {
      const leadId = result.payload?.lead_id || "unknown";
      const fullDoc = result.payload?.full_document || "";
      sections.push(`--- Case ${idx + 1} [FAILED] (Lead ID: ${leadId}) ---`);
      sections.push(fullDoc);
      sections.push("");
    });
  }

  return sections.join("\n").trim();
}

export async function findSimilarLeads(lead: LeadRow): Promise<{ currentContext: string; similarLeadsContext: string }> {
  try {
    // Step 1: Build template sentence
    const sentence = buildTemplateSentence(lead);
    console.log(`[Vector Search] Template: ${sentence}`);

    if (!sentence) {
      console.log("[Vector Search] Empty template sentence, skipping");
      return { currentContext: "", similarLeadsContext: "" };
    }

    // Step 2: Embed the sentence
    const vector = await embedText(sentence);

    // Step 3: Search Qdrant
    const results = await searchQdrant(vector);

    // Step 4: Build formatted context
    return { currentContext: sentence, similarLeadsContext: buildSimilarLeadsContext(results) };
  } catch (err) {
    console.error("[Vector Search] Failed (non-blocking):", err);
    return { currentContext: "", similarLeadsContext: "" };
  }
}
