import { NextResponse } from "next/server"
import { e2eQuery } from "@/lib/db"

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { instance_id, transition_id, to_workflow_id } = body

        if (!instance_id || !to_workflow_id) {
            return NextResponse.json(
                { success: false, error: "Missing required fields: instance_id, to_workflow_id" },
                { status: 400 }
            )
        }

        // Get current instance details
        const instanceResult = await e2eQuery(`
            SELECT wi.*, w.name as workflow_name, w.sla_hours
            FROM workflow_instances wi
            LEFT JOIN workflows w ON w.id = wi.workflow_id
            WHERE wi.id = $1
        `, [instance_id])

        if (instanceResult.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: "Workflow instance not found" },
                { status: 404 }
            )
        }

        const currentInstance = instanceResult.rows[0]

        // Get the target workflow details
        const targetWorkflowResult = await e2eQuery(`
            SELECT id, name, sla_hours
            FROM workflows
            WHERE id = $1 AND is_active = true
        `, [to_workflow_id])

        if (targetWorkflowResult.rows.length === 0) {
            return NextResponse.json(
                { success: false, error: "Target workflow not found or inactive" },
                { status: 404 }
            )
        }

        const targetWorkflow = targetWorkflowResult.rows[0]

        // Mark current instance as completed
        await e2eQuery(`
            UPDATE workflow_instances
            SET status = 'completed', completed_at = NOW()
            WHERE id = $1
        `, [instance_id])

        // Calculate SLA deadline for new instance
        const slaHours = targetWorkflow.sla_hours || 24

        // Create new workflow instance for the target workflow
        const newInstanceResult = await e2eQuery(`
            INSERT INTO workflow_instances (
                car_id,
                workflow_id,
                status,
                started_at,
                sla_deadline,
                created_by
            ) VALUES (
                $1,
                $2,
                'running',
                NOW(),
                NOW() + INTERVAL '1 hour' * $3,
                'system'
            )
            RETURNING id
        `, [currentInstance.car_id, to_workflow_id, slaHours])

        const newInstanceId = newInstanceResult.rows[0]?.id

        // Log the transition
        console.log(`[Transition API] Transitioned instance ${instance_id} from ${currentInstance.workflow_name} to ${targetWorkflow.name}. New instance: ${newInstanceId}`)

        return NextResponse.json({
            success: true,
            message: `Đã chuyển từ "${currentInstance.workflow_name}" sang "${targetWorkflow.name}"`,
            data: {
                old_instance_id: instance_id,
                new_instance_id: newInstanceId,
                from_workflow: currentInstance.workflow_name,
                to_workflow: targetWorkflow.name
            }
        })

    } catch (error) {
        console.error("[Transition API] Error:", error)
        return NextResponse.json(
            { success: false, error: error instanceof Error ? error.message : "Internal server error" },
            { status: 500 }
        )
    }
}
