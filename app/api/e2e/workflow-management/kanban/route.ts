import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"

export const dynamic = 'force-dynamic'

// Types for Kanban data
export interface WorkflowInstanceForKanban {
    id: string
    car_id: string
    workflow_id: string
    workflow_name: string
    workflow_order: number
    status: string
    started_at: string
    sla_deadline: string | null
    completed_at: string | null
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
    sla_hours: number
    instances: WorkflowInstanceForKanban[]
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const picId = searchParams.get("pic_id")

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

        // Fetch all running workflow instances with pending step info
        // Use LATERAL subquery to find the first step without successful execution
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
                -- Get the first pending step (step with no successful execution)
                pending_step.step_name as pending_step_name,
                pending_step.step_id as pending_step_id,
                pending_step.step_order as pending_step_order,
                -- Get total steps count
                (SELECT COUNT(*) FROM workflow_steps ws WHERE ws.workflow_id = wi.workflow_id) as total_steps,
                -- Check if ALL steps have been executed successfully (workflow truly complete)
                CASE 
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
            WHERE wi.status = 'running'
            ORDER BY wi.started_at DESC
        `)

        let instances = instancesResult.rows

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

        // Get unique car_ids to fetch car/lead details from vucar
        const carIds = instances
            .map((inst: any) => inst.car_id)
            .filter((id: string) => id)

        // Fetch car and lead details from vucar database
        // If pic_id is provided, filter by it
        let carLeadMap: Record<string, any> = {}
        let filteredCarIds: Set<string> = new Set()

        if (carIds.length > 0) {
            try {
                let carLeadQuery = `
                    SELECT 
                        c.id as car_id,
                        c.brand,
                        c.model,
                        c.year,
                        c.plate,
                        c.mileage,
                        c.location,
                        c.additional_images,
                        l.id as lead_id,
                        l.name as lead_name,
                        l.phone as lead_phone,
                        l.pic_id,
                        ss.qualified as lead_status,
                        ss.notes,
                        ss.price_customer as expected_price,
                        ss.price_highest_bid as dealer_price
                    FROM cars c
                    LEFT JOIN leads l ON l.id = c.lead_id
                    LEFT JOIN sale_status ss ON ss.car_id = c.id
                    WHERE c.id = ANY($1::uuid[])
                `

                // Add pic_id filter if provided
                const queryParams: any[] = [carIds]
                if (picId) {
                    carLeadQuery += ` AND l.pic_id = $2::uuid`
                    queryParams.push(picId)
                }

                const carLeadResult = await vucarV2Query(carLeadQuery, queryParams)

                carLeadResult.rows.forEach((row: any) => {
                    carLeadMap[row.car_id] = row
                    filteredCarIds.add(row.car_id)
                })

                // If pic_id filter is applied, filter instances to only include those with matching car_ids
                if (picId) {
                    instances = instances.filter((inst: any) => filteredCarIds.has(inst.car_id))
                }
            } catch (err) {
                console.error("[Workflow Kanban API] Error fetching car/lead details:", err)
                // Continue without car/lead details
            }
        }

        // Fetch last activity time for all leads from sale_activities
        let lastActivityMap: Record<string, string> = {}
        const leadIds = Object.values(carLeadMap)
            .map((cl: any) => cl.lead_id)
            .filter((id: string | null) => id)

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
                console.log("[Workflow Kanban API] Fetched", Object.keys(lastActivityMap).length, "last activity times")
            } catch (err) {
                console.warn("[Workflow Kanban API] Could not fetch last activities:", err)
            }
        }

        // Helper function to safely extract string values from potentially JSONB fields
        const safeString = (value: any): string | null => {
            if (value === null || value === undefined) return null
            if (typeof value === 'string') return value
            // If it's an object, return null to prevent React rendering errors
            return null
        }

        // Group instances by workflow and add transitions + car/lead data
        const kanbanWorkflows: KanbanWorkflow[] = workflows.map((wf: any) => {
            const workflowInstances = instances
                .filter((inst: any) => inst.workflow_id === wf.id)
                .map((inst: any) => {
                    const carLead = carLeadMap[inst.car_id] || {}
                    // Only include transitions if all steps are complete
                    const canTransition = inst.all_steps_complete === true

                    // Extract first car image from additional_images (like LeadDetailPanel)
                    // additional_images has categories: outside, inside, paper with objects having .url property
                    let carImage: string | null = null

                    // Parse additional_images if it's a string
                    let additionalImages = carLead.additional_images || {}
                    if (typeof additionalImages === 'string') {
                        try {
                            additionalImages = JSON.parse(additionalImages)
                        } catch {
                            additionalImages = {}
                        }
                    }

                    // Try outside images first (usually exterior shots), then other categories
                    const categoryOrder = ['outside', 'inside', 'paper']
                    for (const category of categoryOrder) {
                        const categoryImages = additionalImages[category]
                        if (categoryImages && Array.isArray(categoryImages) && categoryImages.length > 0) {
                            const firstImg = categoryImages[0]
                            if (firstImg && firstImg.url) {
                                carImage = firstImg.url
                                break
                            }
                        }
                    }

                    return {
                        id: inst.id,
                        car_id: inst.car_id,
                        workflow_id: inst.workflow_id,
                        workflow_name: inst.workflow_name,
                        workflow_order: parseInt(wf.order_num),
                        status: inst.status,
                        started_at: inst.started_at,
                        sla_deadline: inst.sla_deadline,
                        completed_at: inst.completed_at,
                        pending_step_name: inst.pending_step_name || null,
                        pending_step_order: inst.pending_step_order ? parseInt(inst.pending_step_order) : null,
                        total_steps: inst.total_steps ? parseInt(inst.total_steps) : null,
                        all_steps_complete: inst.all_steps_complete || false,
                        car_brand: safeString(carLead.brand),
                        car_model: safeString(carLead.model),
                        car_year: carLead.year ? parseInt(carLead.year) : null,
                        car_plate: safeString(carLead.plate),
                        car_mileage: carLead.mileage ? parseInt(carLead.mileage) : null,
                        car_location: safeString(carLead.location),
                        car_image: carImage,
                        lead_id: safeString(carLead.lead_id),
                        lead_name: safeString(carLead.lead_name),
                        lead_phone: safeString(carLead.lead_phone),
                        lead_status: safeString(carLead.lead_status),
                        last_activity_at: carLead.lead_id ? lastActivityMap[carLead.lead_id] || null : null,
                        notes: safeString(carLead.notes),
                        expected_price: carLead.expected_price ? parseFloat(carLead.expected_price) : null,
                        dealer_price: carLead.dealer_price ? parseFloat(carLead.dealer_price) : null,
                        // Only include transitions if all steps are complete
                        available_transitions: canTransition
                            ? transitions
                                .filter((t: any) => t.from_workflow_id === wf.id)
                                .map((t: any) => ({
                                    id: t.id,
                                    to_workflow_id: t.to_workflow_id,
                                    to_workflow_name: t.to_workflow_name,
                                    condition_logic: t.condition_logic
                                }))
                            : []
                    }
                })

            return {
                id: wf.id,
                name: wf.name,
                order: parseInt(wf.order_num),
                sla_hours: wf.sla_hours,
                instances: workflowInstances
            }
        })

        // Calculate stats
        const totalInstances = instances.length
        const activeInstances = instances.filter((i: any) => i.status === 'running').length

        return NextResponse.json({
            success: true,
            workflows: kanbanWorkflows,
            stats: {
                total: totalInstances,
                active: activeInstances
            }
        })
    } catch (error) {
        console.error("[Workflow Kanban API] Error:", error)
        return NextResponse.json(
            {
                success: false,
                error: "Failed to fetch workflow kanban data",
                details: error instanceof Error ? error.message : String(error)
            },
            { status: 500 }
        )
    }
}
