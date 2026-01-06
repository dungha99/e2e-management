import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"

export const dynamic = 'force-dynamic'

// Types for Kanban data
export interface WorkflowInstanceForKanban {
    id: string
    car_id: string
    workflow_id: string | null
    workflow_name: string | null
    workflow_order: number | null
    status: string | null
    started_at: string | null
    sla_deadline: string | null
    completed_at: string | null
    pending_step_name: string | null
    pending_step_order: number | null
    total_steps: number | null
    all_steps_complete: boolean
    // Car info
    car_brand: string | null
    car_model: string | null
    car_year: number | null
    car_plate: string | null
    car_mileage: number | null
    car_location: string | null
    car_image: string | null
    // Lead info
    lead_id: string | null
    lead_name: string | null
    lead_phone: string | null
    lead_status: string | null
    last_activity_at: string | null
    notes: string | null
    // Pricing
    expected_price: number | null
    dealer_price: number | null
    // Transitions
    available_transitions: {
        id: string
        to_workflow_id: string
        to_workflow_name: string
        condition_logic: string | null
    }[]
}

export interface KanbanWorkflow {
    id: string
    name: string
    order: number
    sla_hours: number | null
    instances: WorkflowInstanceForKanban[]
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { pic_id } = body

        if (!pic_id) {
            return NextResponse.json({ error: "pic_id is required" }, { status: 400 })
        }

        console.log("[Campaigns Kanban API] Fetching kanban data for pic_id:", pic_id)

        // Fetch all active workflows ordered by their stage
        const workflowsResult = await e2eQuery(`
            SELECT 
                w.id,
                w.name,
                w.sla_hours,
                w.stage_id,
                ws.name as stage_name,
                ROW_NUMBER() OVER (ORDER BY ws.name, w.name) as order_num
            FROM workflows w
            LEFT JOIN workflow_stages ws ON ws.id = w.stage_id
            WHERE w.is_active = true
            ORDER BY ws.name, w.name
        `)

        const workflows = workflowsResult.rows

        // Fetch all leads for this PIC with their cars
        const leadsResult = await vucarV2Query(`
            SELECT DISTINCT ON (l.phone)
                l.id as lead_id,
                l.name as lead_name,
                l.phone as lead_phone,
                c.id as car_id,
                c.brand,
                c.model,
                c.year,
                c.plate,
                c.mileage,
                c.location,
                c.additional_images,
                ss.qualified as lead_status,
                ss.notes,
                ss.price_customer as expected_price,
                ss.price_highest_bid as dealer_price,
                l.created_at
            FROM leads l
            LEFT JOIN cars c ON c.lead_id = l.id
            LEFT JOIN sale_status ss ON ss.car_id = c.id
            WHERE l.pic_id = $1
              AND (c.created_at > NOW() - INTERVAL '2 months' OR c.id IS NULL)
            ORDER BY l.phone, l.created_at DESC, c.created_at DESC NULLS LAST
        `, [pic_id])

        const leads = leadsResult.rows

        console.log("[Campaigns Kanban API] Found", leads.length, "leads for pic_id:", pic_id)

        // Fetch all workflow instances (all statuses - running, completed, terminated)
        const instancesResult = await e2eQuery(`
            SELECT 
                wi.id,
                wi.car_id,
                wi.workflow_id,
                wi.status,
                wi.started_at,
                wi.sla_deadline,
                wi.completed_at,
                w.name as workflow_name,
                w.sla_hours,
                -- Get the first pending step
                pending_step.step_name as pending_step_name,
                pending_step.step_id as pending_step_id,
                pending_step.step_order as pending_step_order,
                -- Get total steps count
                (SELECT COUNT(*) FROM workflow_steps ws WHERE ws.workflow_id = wi.workflow_id) as total_steps,
                -- Check if ALL steps have been executed successfully OR if workflow is already completed
                CASE 
                    WHEN wi.status = 'completed' THEN true
                    WHEN pending_step.step_id IS NULL THEN true 
                    ELSE false 
                END as all_steps_complete
            FROM workflow_instances wi
            LEFT JOIN workflows w ON w.id = wi.workflow_id
            LEFT JOIN LATERAL (
                SELECT ws.id as step_id, ws.step_name, ws.step_order
                FROM workflow_steps ws
                WHERE ws.workflow_id = wi.workflow_id
                  AND NOT EXISTS (
                      SELECT 1 FROM step_executions se 
                      WHERE se.instance_id = wi.id 
                        AND se.step_id = ws.id 
                        AND se.status = 'success'
                  )
                ORDER BY ws.step_order ASC
                LIMIT 1
            ) pending_step ON true
            ORDER BY wi.started_at DESC
        `)

        const instances = instancesResult.rows

        // Create a map of car_id -> workflow instance
        const carWorkflowMap: Record<string, any> = {}
        instances.forEach((inst: any) => {
            carWorkflowMap[inst.car_id] = inst
        })

        // Fetch all transitions
        const transitionsResult = await e2eQuery(`
            SELECT 
                wt.id,
                wt.from_workflow_id,
                wt.to_workflow_id,
                wt.condition_logic,
                w.name as to_workflow_name
            FROM workflow_transitions wt
            LEFT JOIN workflows w ON w.id = wt.to_workflow_id
        `)

        const transitions = transitionsResult.rows

        // Fetch last activity time for all leads
        let lastActivityMap: Record<string, string> = {}
        const leadIds = leads.map((l: any) => l.lead_id).filter((id: string | null) => id)

        if (leadIds.length > 0) {
            try {
                const activityResult = await vucarV2Query(
                    `SELECT
                        lead_id,
                        MAX(created_at) as last_activity_at
                     FROM sale_activities
                     WHERE lead_id = ANY($1::uuid[])
                     GROUP BY lead_id`,
                    [leadIds]
                )
                activityResult.rows.forEach((row: any) => {
                    lastActivityMap[row.lead_id] = row.last_activity_at
                })
                console.log("[Campaigns Kanban API] Fetched", Object.keys(lastActivityMap).length, "last activity times")
            } catch (err) {
                console.warn("[Campaigns Kanban API] Could not fetch last activities:", err)
            }
        }

        // Helper function to safely extract string values
        const safeString = (value: any): string | null => {
            if (value === null || value === undefined) return null
            if (typeof value === 'string') return value
            return null
        }

        // Helper to extract car image
        const extractCarImage = (additionalImages: any): string | null => {
            let images = additionalImages || {}
            if (typeof images === 'string') {
                try {
                    images = JSON.parse(images)
                } catch {
                    images = {}
                }
            }

            const categoryOrder = ['outside', 'inside', 'paper']
            for (const category of categoryOrder) {
                const categoryImages = images[category]
                if (categoryImages && Array.isArray(categoryImages) && categoryImages.length > 0) {
                    const firstImg = categoryImages[0]
                    if (firstImg && firstImg.url) {
                        return firstImg.url
                    }
                }
            }
            return null
        }

        // Convert leads to workflow instances format
        const allInstances: WorkflowInstanceForKanban[] = leads.map((lead: any) => {
            const workflowInstance = carWorkflowMap[lead.car_id] || null
            const hasWorkflow = workflowInstance !== null

            // Show transitions only when ALL steps have been COMPLETED
            const canTransition = hasWorkflow && workflowInstance.all_steps_complete === true

            return {
                id: hasWorkflow ? workflowInstance.id : `no-wf-${lead.car_id}`,
                car_id: lead.car_id,
                workflow_id: hasWorkflow ? workflowInstance.workflow_id : null,
                workflow_name: hasWorkflow ? workflowInstance.workflow_name : null,
                workflow_order: null,
                status: hasWorkflow ? workflowInstance.status : null,
                started_at: hasWorkflow ? workflowInstance.started_at : null,
                sla_deadline: hasWorkflow ? workflowInstance.sla_deadline : null,
                completed_at: hasWorkflow ? workflowInstance.completed_at : null,
                pending_step_name: hasWorkflow ? workflowInstance.pending_step_name : null,
                pending_step_order: hasWorkflow ? (workflowInstance.pending_step_order ? parseInt(workflowInstance.pending_step_order) : null) : null,
                total_steps: hasWorkflow ? (workflowInstance.total_steps ? parseInt(workflowInstance.total_steps) : null) : null,
                all_steps_complete: hasWorkflow ? (workflowInstance.all_steps_complete || false) : false,
                car_brand: safeString(lead.brand),
                car_model: safeString(lead.model),
                car_year: lead.year ? parseInt(lead.year) : null,
                car_plate: safeString(lead.plate),
                car_mileage: lead.mileage ? parseInt(lead.mileage) : null,
                car_location: safeString(lead.location),
                car_image: extractCarImage(lead.additional_images),
                lead_id: safeString(lead.lead_id),
                lead_name: safeString(lead.lead_name),
                lead_phone: safeString(lead.lead_phone),
                lead_status: safeString(lead.lead_status),
                last_activity_at: lead.lead_id ? lastActivityMap[lead.lead_id] || null : null,
                notes: safeString(lead.notes),
                expected_price: lead.expected_price ? parseFloat(lead.expected_price) : null,
                dealer_price: lead.dealer_price ? parseFloat(lead.dealer_price) : null,
                available_transitions: canTransition
                    ? transitions
                        .filter((t: any) => t.from_workflow_id === workflowInstance.workflow_id)
                        .map((t: any) => ({
                            id: t.id,
                            to_workflow_id: t.to_workflow_id,
                            to_workflow_name: t.to_workflow_name,
                            condition_logic: t.condition_logic
                        }))
                    : []
            }
        })

        // Group instances by workflow
        const kanbanWorkflows: KanbanWorkflow[] = []

        // Add "No Workflow" column first
        const noWorkflowInstances = allInstances.filter(inst => inst.workflow_id === null)
        if (noWorkflowInstances.length > 0 || allInstances.length === 0) {
            kanbanWorkflows.push({
                id: 'no-workflow',
                name: 'Chưa có Workflow',
                order: 0,
                sla_hours: null,
                instances: noWorkflowInstances
            })
        }

        // Add actual workflow columns
        workflows.forEach((wf: any, index: number) => {
            const workflowInstances = allInstances.filter(inst => inst.workflow_id === wf.id)

            kanbanWorkflows.push({
                id: wf.id,
                name: wf.name,
                order: index + 1,
                sla_hours: wf.sla_hours,
                instances: workflowInstances
            })
        })

        // Calculate stats
        const totalInstances = allInstances.length
        const activeInstances = allInstances.filter((i: any) => i.status === 'running').length

        console.log("[Campaigns Kanban API] Grouped into", kanbanWorkflows.length, "workflows with", totalInstances, "total instances")

        return NextResponse.json({
            success: true,
            workflows: kanbanWorkflows,
            stats: {
                total: totalInstances,
                active: activeInstances
            }
        })
    } catch (error) {
        console.error("[Campaigns Kanban API] Error:", error)
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch campaigns for kanban",
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        )
    }
}
