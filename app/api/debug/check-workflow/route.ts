import { NextResponse } from "next/server"
import { e2eQuery } from "@/lib/db"
import { vucarV2Query } from "@/lib/db"

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const phone = searchParams.get('phone') || '0938923979'

        console.log('\n=== Checking workflow status for phone:', phone, '===\n')

        // 1. Find the lead and car
        const leadResult = await vucarV2Query(`
            SELECT 
                l.id as lead_id,
                l.name,
                l.phone,
                c.id as car_id,
                c.brand,
                c.model,
                c.year
            FROM leads l
            LEFT JOIN cars c ON c.lead_id = l.id
            WHERE l.phone = $1
            ORDER BY l.created_at DESC
            LIMIT 1
        `, [phone])

        if (leadResult.rows.length === 0) {
            return NextResponse.json({ error: 'Lead not found' }, { status: 404 })
        }

        const lead = leadResult.rows[0]
        const result: any = {
            lead: {
                name: lead.name,
                phone: lead.phone,
                car: `${lead.brand} ${lead.model} ${lead.year}`,
                car_id: lead.car_id
            },
            instances: []
        }

        if (!lead.car_id) {
            return NextResponse.json({ ...result, error: 'No car found for this lead' })
        }

        // 2. Find workflow instances for this car
        const instancesResult = await e2eQuery(`
            SELECT 
                wi.id,
                wi.workflow_id,
                wi.status,
                wi.started_at,
                wi.completed_at,
                wi.sla_deadline,
                w.name as workflow_name
            FROM workflow_instances wi
            LEFT JOIN workflows w ON w.id = wi.workflow_id
            WHERE wi.car_id = $1
            ORDER BY wi.started_at DESC
        `, [lead.car_id])

        // 3. For each instance, check step executions
        for (const inst of instancesResult.rows) {
            // Get all steps for this workflow
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
            `, [inst.id, inst.workflow_id])

            const completedSteps = stepsResult.rows.filter((s: any) => s.execution_id && s.execution_status === 'success').length
            const totalSteps = stepsResult.rows.length
            const pendingStep = stepsResult.rows.find((s: any) => !s.execution_id)

            result.instances.push({
                workflow_name: inst.workflow_name,
                status: inst.status,
                instance_id: inst.id,
                started_at: inst.started_at,
                completed_at: inst.completed_at,
                total_steps: totalSteps,
                completed_steps: completedSteps,
                pending_step: pendingStep ? {
                    order: pendingStep.step_order,
                    name: pendingStep.step_name
                } : null,
                steps: stepsResult.rows.map((s: any) => ({
                    order: s.step_order,
                    name: s.step_name,
                    executed: !!s.execution_id,
                    status: s.execution_status,
                    executed_at: s.executed_at
                }))
            })
        }

        return NextResponse.json(result)

    } catch (error) {
        console.error('[Check Workflow Status] Error:', error)
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal server error' },
            { status: 500 }
        )
    }
}
