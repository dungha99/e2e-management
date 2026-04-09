import { NextResponse } from "next/server"
import { e2eQuery } from "@/lib/db"

export const dynamic = "force-dynamic"

/**
 * GET /api/e2e/ai-workflows/monitor/[carId]
 *
 * Returns all AI workflow instances for a car, with each step's execution details.
 * Used by the Workflow Monitor UI to display upcoming sends, failed steps, and messages.
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

    const result = await e2eQuery(
      `SELECT
        wi.id              AS instance_id,
        wi.status          AS instance_status,
        wi.started_at,
        wi.completed_at,
        wi.triggered_by,
        w.id               AS workflow_id,
        w.name             AS workflow_name,
        ws.id              AS step_id,
        ws.step_name,
        ws.step_order,
        ws.connector_id,
        ws.description     AS step_description,
        se.id              AS exec_id,
        se.status          AS exec_status,
        se.scheduled_at,
        se.executed_at,
        se.completed_at    AS exec_completed_at,
        se.request_payload,
        se.response_payload,
        se.error_message,
        se.retry_count
       FROM workflow_instances wi
       JOIN workflows w ON w.id = wi.workflow_id
       LEFT JOIN workflow_steps ws ON ws.workflow_id = wi.workflow_id
       LEFT JOIN step_executions se ON se.instance_id = wi.id AND se.step_id = ws.id
       WHERE wi.car_id = $1 AND w.type = 'AI'
       ORDER BY wi.started_at DESC, ws.step_order ASC`,
      [carId]
    )

    const VN_7H = 0 * 60 * 60 * 1000

    /**
     * scheduled_at is stored as VN local time (Gemini raw output or NOW()+7h),
     * so pg reads it as UTC but the value already represents VN time.
     * The component adds VN_OFFSET_MS (14h) to display correctly, so these
     * timestamps need no adjustment here.
     */
    function toIso(raw: any): string | null {
      if (!raw) return null
      if (raw instanceof Date) return raw.toISOString()
      const d = new Date(String(raw))
      return isNaN(d.getTime()) ? null : d.toISOString()
    }

    /**
     * started_at / completed_at / executed_at come from NOW() on Vercel — true UTC.
     * Shift +7h here so they match the scheduled_at format (VN local time stored as UTC),
     * making the component's +14h consistent across all timestamps.
     */
    function toUtcShiftedIso(raw: any): string | null {
      const iso = toIso(raw)
      if (!iso) return null
      return new Date(new Date(iso).getTime() + VN_7H).toISOString()
    }


    // Group rows into instances → steps
    const instanceMap = new Map<string, any>()

    for (const row of result.rows) {
      if (!instanceMap.has(row.instance_id)) {
        instanceMap.set(row.instance_id, {
          id: row.instance_id,
          status: row.instance_status,
          workflowName: row.workflow_name,
          startedAt: toUtcShiftedIso(row.started_at),
          completedAt: toUtcShiftedIso(row.completed_at),
          triggeredBy: row.triggered_by,
          steps: [],
        })
      }

      if (row.step_id) {
        let requestPayload = row.request_payload
        if (typeof requestPayload === "string") {
          try { requestPayload = JSON.parse(requestPayload) } catch { /* keep */ }
        }

        instanceMap.get(row.instance_id).steps.push({
          stepId: row.step_id,
          stepName: row.step_name,
          stepOrder: row.step_order,
          connectorId: row.connector_id,
          description: row.step_description,
          execution: row.exec_id ? {
            id: row.exec_id,
            status: row.exec_status,
            scheduledAt: toIso(row.scheduled_at),
            executedAt: toUtcShiftedIso(row.executed_at),
            completedAt: toUtcShiftedIso(row.exec_completed_at),
            messages: Array.isArray(requestPayload?.messages) ? requestPayload.messages : [],
            errorMessage: row.error_message,
            retryCount: row.retry_count ?? 0,
          } : null,
        })
      }
    }

    const instances = Array.from(instanceMap.values()).filter(i => i.steps.length > 0)

    return NextResponse.json({ success: true, instances })
  } catch (error) {
    console.error("[AI Workflow Monitor] Error:", error)
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 })
  }
}
