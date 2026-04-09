import { NextResponse } from "next/server"
import { getCarAgentSession } from "@/lib/ai-agent-service"

export const dynamic = "force-dynamic"

/**
 * GET /api/e2e/ai-agents/session/[carId]
 *
 * Returns the AI agent conversation for a car as a chat-like session.
 * Each entry is one agent "message" (role + content from output_payload only),
 * ordered oldest → newest for natural reading order.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ carId: string }> }
) {
  try {
    const { carId } = await params

    if (!carId) {
      return NextResponse.json({ success: false, error: "Missing carId" }, { status: 400 })
    }

    const session = await getCarAgentSession(carId)

    return NextResponse.json({ success: true, carId, session })
  } catch (error) {
    console.error(`[Agent Session API] Error:`, error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
