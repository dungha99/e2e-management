import { NextResponse } from "next/server"
import { vucarV2Query } from "@/lib/db"
import { runTaskDispatcher } from "@/lib/task-dispatcher-service"

export const dynamic = "force-dynamic"

/**
 * POST /api/e2e/ai-agents/task-dispatcher
 * Body: { carId?: string, phone?: string, picId?: string, trigger?: string }
 */
export async function POST(request: Request) {
  const startTime = Date.now()

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body" }, { status: 400 })
  }

  const { trigger = "manual" } = body
  if (!body.carId && !body.phone) {
    return NextResponse.json({ success: false, error: "Missing carId or phone" }, { status: 400 })
  }

  try {
    // --- Resolve carId, picId, phone ---
    let carId: string = body.carId || ""
    let picId: string = body.picId || ""
    let customerPhone: string = ""

    if (body.phone && !carId) {
      const byPhone = await vucarV2Query(
        `SELECT c.id AS car_id, l.pic_id, l.phone, l.additional_phone
         FROM cars c
         JOIN leads l ON l.id = c.lead_id
         WHERE l.phone = $1 OR l.additional_phone = $1
         ORDER BY c.created_at DESC LIMIT 1`,
        [body.phone]
      )
      if (byPhone.rows.length === 0) {
        return NextResponse.json({ success: false, error: `No lead found for phone ${body.phone}` }, { status: 404 })
      }
      carId = byPhone.rows[0].car_id
      picId = picId || byPhone.rows[0].pic_id || ""
      customerPhone = byPhone.rows[0].additional_phone || byPhone.rows[0].phone || body.phone
    } else {
      const contactResult = await vucarV2Query(
        `SELECT l.phone, l.additional_phone, l.pic_id
         FROM cars c
         JOIN leads l ON l.id = c.lead_id
         WHERE c.id = $1 LIMIT 1`,
        [carId]
      )
      const contact = contactResult.rows[0]
      picId = picId || contact?.pic_id || ""
      customerPhone = contact?.additional_phone || contact?.phone || ""
    }

    // --- Delegate to shared pipeline ---
    const result = await runTaskDispatcher({ carId, picId, customerPhone, trigger })

    if (!result) {
      return NextResponse.json(
        { success: false, error: `No prompt configured for Task Dispatcher. Call GET /api/e2e/ai-agents/seed to initialise.` },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      carId,
      trigger,
      steps: result.steps,
      variables: result.variables,
      durationMs: Date.now() - startTime,
    })
  } catch (err) {
    console.error("[TaskDispatcher] Fatal error:", err)
    return NextResponse.json(
      {
        success: false,
        error: "Task dispatcher failed",
        details: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - startTime,
      },
      { status: 500 }
    )
  }
}
