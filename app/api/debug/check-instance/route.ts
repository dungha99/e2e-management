import { NextResponse } from "next/server"
import { e2eQuery } from "@/lib/db"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const instanceId = searchParams.get('id')

        if (!instanceId) {
            return NextResponse.json({ error: 'Missing instance id parameter' }, { status: 400 })
        }

        // Get instance details
        const instanceResult = await e2eQuery(`
            SELECT 
                wi.*,
                w.name as workflow_name
            FROM workflow_instances wi
            LEFT JOIN workflows w ON w.id = wi.workflow_id
            WHERE wi.id = $1
        `, [instanceId])

        if (instanceResult.rows.length === 0) {
            return NextResponse.json({ error: 'Instance not found' }, { status: 404 })
        }

        const instance = instanceResult.rows[0]

        // Get step executions
        const stepsResult = await e2eQuery(`
            SELECT 
                ws.id as step_id,
                ws.step_name,
                ws.step_order,
                se.id as execution_id,
                se.status as execution_status,
                se.executed_at
            FROM workflow_steps ws
            LEFT JOIN step_executions se ON se.step_id = ws.id AND se.instance_id = $1
            WHERE ws.workflow_id = $2
            ORDER BY ws.step_order
        `, [instanceId, instance.workflow_id])

        const completedSteps = stepsResult.rows.filter((s: any) => s.execution_id && s.execution_status === 'success').length
        const totalSteps = stepsResult.rows.length
        const pendingStep = stepsResult.rows.find((s: any) => !s.execution_id)

        return NextResponse.json({
            instance: {
                id: instance.id,
                workflow_id: instance.workflow_id,
                workflow_name: instance.workflow_name,
                car_id: instance.car_id,
                status: instance.status,
                started_at: instance.started_at,
                completed_at: instance.completed_at,
                sla_deadline: instance.sla_deadline
            },
            progress: {
                total_steps: totalSteps,
                completed_steps: completedSteps,
                pending_step: pendingStep ? {
                    order: pendingStep.step_order,
                    name: pendingStep.step_name
                } : null
            },
            steps: stepsResult.rows.map((s: any) => ({
                order: s.step_order,
                name: s.step_name,
                executed: !!s.execution_id,
                status: s.execution_status,
                executed_at: s.executed_at
            }))
        })

    } catch (error) {
        console.error('[Check Instance] Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        )
    }
}
