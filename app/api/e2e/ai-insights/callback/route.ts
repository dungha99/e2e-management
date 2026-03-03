import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"
import { handleAutoUseFlow } from "@/lib/workflow-service"
import { storeAgentOutput } from "@/lib/ai-agent-service"

export const dynamic = "force-dynamic"

/**
 * POST /api/e2e/ai-insights/callback
 *
 * Callback endpoint for n8n webhook to POST results after processing.
 * This avoids Cloudflare 524 timeouts by decoupling request/response.
 *
 * Expected body from n8n:
 * {
 *   insightIdToUpdate: string,
 *   carId: string,
 *   sourceInstanceId: string,
 *   ...aiResponse (the analysis result)
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    // n8n may wrap the response in an array
    let data = Array.isArray(body) ? body[0] : body

    const { insightIdToUpdate, carId, sourceInstanceId } = data

    if (!insightIdToUpdate || !carId) {
      console.error("[AI Insights Callback] Missing insightIdToUpdate or carId:", data)
      return NextResponse.json(
        { success: false, error: "Missing insightIdToUpdate or carId" },
        { status: 400 }
      )
    }

    console.log(`[AI Insights Callback] Received callback for insight=${insightIdToUpdate}, car=${carId}`)

    // Remove our metadata fields to get the pure AI response
    const { insightIdToUpdate: _iid, carId: _cid, sourceInstanceId: _sid, callbackUrl: _cb, ...aiResponse } = data

    // --- 1. Parse the AI response ---
    const findNestedValue = (obj: any, targetKey: string): any => {
      if (!obj || typeof obj !== "object") return undefined
      if (targetKey in obj) return obj[targetKey]
      for (const key in obj) {
        const found = findNestedValue(obj[key], targetKey)
        if (found !== undefined) return found
      }
      return undefined
    }

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
    const toUuidOrNull = (v: any): string | null =>
      typeof v === "string" && UUID_RE.test(v) ? v : null

    const selectedTransitionId = toUuidOrNull(findNestedValue(aiResponse, "selected_transition_id"))
    const targetWorkflowId = toUuidOrNull(findNestedValue(aiResponse, "target_workflow_id"))
    const storageSummary = aiResponse.analysis || aiResponse

    // --- 2. Update ai_insights record ---
    await e2eQuery(
      `UPDATE ai_insights
       SET ai_insight_summary = $1, selected_transition_id = $2, target_workflow_id = $3
       WHERE id = $4`,
      [JSON.stringify(storageSummary), selectedTransitionId, targetWorkflowId, insightIdToUpdate]
    )

    console.log(`[AI Insights Callback] Updated insight ${insightIdToUpdate}`)

    // --- 3. Track Feedback agent output ---
    storeAgentOutput({
      agentName: "Feedback",
      carId,
      sourceInstanceId,
      inputPayload: { insightIdToUpdate },
      outputPayload: storageSummary,
    }).catch(err => console.error("[AI Insights Callback] Failed to store agent output:", err))

    // --- 4. Auto Use Flow for test Car IDs ---
    const testCarIds = [
      "4f4aba46-9e76-4100-87f9-26a37c141d04",
      "faaaac34-1fcb-4bb3-99d8-4f1597251bb7",
      "6f38b1e4-4708-4547-bc04-46d5b9c6082b",
      "41a305f9-1742-4712-940b-fd84e714384c",
      "f360a4f8-5539-4a0e-9a9d-47e453058d58",
      "eb268d8a-1763-460f-b773-4687d356879b",
      "b51dafce-845f-4cae-a55f-c5a7b8e7b2bf"
    ]
    try {
      const leadCheck = await vucarV2Query(
        `SELECT l.pic_id FROM cars c JOIN leads l ON l.id = c.lead_id WHERE c.id = $1 LIMIT 1`,
        [carId]
      )
      const currentPicId = leadCheck.rows[0]?.pic_id

      if (testCarIds.includes(carId)) {
        console.log(`[AI Insights Callback] Auto Use Flow triggered for test car ${carId}`)
        try {
          await handleAutoUseFlow({
            carId,
            aiInsightSummary: storageSummary,
            picId: currentPicId,
          })
          console.log(`[AI Insights Callback] handleAutoUseFlow finished for car ${carId}`)
        } catch (err) {
          console.error(`[AI Insights Callback] handleAutoUseFlow FAILED for car ${carId}:`, err)
        }
      }
    } catch (autoFlowErr) {
      console.error("[AI Insights Callback] Auto Use Flow check error:", autoFlowErr)
    }

    return NextResponse.json({ success: true, insightId: insightIdToUpdate })
  } catch (error) {
    console.error("[AI Insights Callback] Error:", error)
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    )
  }
}
