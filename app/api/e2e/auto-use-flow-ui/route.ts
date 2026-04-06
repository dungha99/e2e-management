import { NextResponse } from "next/server"
import { runAutoUseFlow } from "@/lib/auto-use-flow-service"

export const dynamic = "force-dynamic"

/**
 * POST /api/e2e/auto-use-flow-ui
 *
 * UI-facing endpoint for the "Kích hoạt Flow tự động" button.
 * No external auth required — relies on same-origin browser calls.
 * Delegates all logic to the shared auto-use-flow-service.
 *
 * Body: { carId, aiInsightSummary, picId? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { carId, aiInsightSummary, picId } = body

    if (!carId || !aiInsightSummary) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: carId, aiInsightSummary" },
        { status: 400 }
      )
    }

    const result = await runAutoUseFlow(carId, aiInsightSummary, picId, 'user')

    return NextResponse.json(result, { status: result.success ? 200 : 500 })
  } catch (error) {
    console.error("[Auto Use Flow UI] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to process request",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
