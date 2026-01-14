import { NextResponse } from "next/server"
import { e2eQuery } from "@/lib/db"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const carId = searchParams.get("carId")

    if (!carId) {
      return NextResponse.json({ error: "carId is required" }, { status: 400 })
    }

    // Fetch all workflow instances for this car with workflow details
    const instancesResult = await e2eQuery(
      `SELECT
        wi.id,
        wi.car_id,
        wi.workflow_id,
        wi.parent_instance_id,
        wi.current_step_id,
        wi.status,
        wi.final_outcome,
        wi.started_at,
        wi.sla_deadline,
        wi.completed_at,
        w.name as workflow_name,
        w.description as workflow_description,
        w.sla_hours,
        ws.name as stage_name
      FROM workflow_instances wi
      LEFT JOIN workflows w ON w.id = wi.workflow_id
      LEFT JOIN workflow_stages ws ON ws.id = w.stage_id
      WHERE wi.car_id = $1
      ORDER BY wi.started_at ASC`, // Changed to ASC for chronological tree building
      [carId]
    )

    const instances = instancesResult.rows

    // Fetch all workflows
    const allWorkflowsResult = await e2eQuery(`SELECT id, name, description, tooltip FROM workflows WHERE is_active = true`)
    const allWorkflows = allWorkflowsResult.rows

    // Fetch all workflow transitions
    const allTransitionsResult = await e2eQuery(`
      SELECT vt.*, w.name as to_workflow_name
      FROM workflow_transitions vt
      JOIN workflows w ON w.id = vt.to_workflow_id
    `)
    const allTransitions = allTransitionsResult.rows

    // Fetch steps for ALL workflows (even those without instances)
    const allWorkflowStepsMap: Record<string, any[]> = {}
    for (const workflow of allWorkflows) {
      const stepsResult = await e2eQuery(
        `SELECT
          id,
          workflow_id,
          step_name,
          step_order,
          is_automated,
          template
        FROM workflow_steps
        WHERE workflow_id = $1
        ORDER BY step_order ASC`,
        [workflow.id]
      )
      allWorkflowStepsMap[workflow.id] = stepsResult.rows
    }

    // For each instance, fetch its workflow steps and executions
    const instancesWithDetails = await Promise.all(
      instances.map(async (instance: any) => {
        // Get workflow steps
        const stepsResult = await e2eQuery(
          `SELECT
            id,
            workflow_id,
            step_name,
            step_order,
            is_automated,
            template
          FROM workflow_steps
          WHERE workflow_id = $1
          ORDER BY step_order ASC`,
          [instance.workflow_id]
        )

        const steps = stepsResult.rows

        // Get step executions for this instance
        const executionsResult = await e2eQuery(
          `SELECT
            se.id,
            se.instance_id,
            se.step_id,
            se.status,
            se.error_message,
            se.executed_at,
            ws.step_name,
            ws.step_order,
            ws.is_automated
          FROM step_executions se
          LEFT JOIN workflow_steps ws ON ws.id = se.step_id
          WHERE se.instance_id = $1
          ORDER BY se.executed_at ASC`,
          [instance.id]
        )

        const executions = executionsResult.rows

        // Merge executions into steps
        const stepsWithExecutions = steps.map((step: any) => {
          const execution = executions.find((e: any) => e.step_id === step.id)
          return {
            ...step,
            execution: execution || null,
          }
        })

        // Identify potential next workflows if this instance is completed
        const nextWorkflows = instance.status === "completed"
          ? allTransitions
            .filter(t => t.from_workflow_id === instance.workflow_id)
            .map(t => ({
              id: t.to_workflow_id,
              name: t.to_workflow_name
            }))
          : []

        return {
          instance: { ...instance },
          steps: stepsWithExecutions,
          potentialNextWorkflows: nextWorkflows
        }
      })
    )

    // Backward compatibility: maintain canActivateWF2 and wf2Id logic
    const wf2 = instancesWithDetails.find(i => i.instance.workflow_name === "WF2")
    const wf2IdResult = await e2eQuery("SELECT id FROM workflows WHERE name = 'WF2' LIMIT 1")
    const wf2Id = wf2IdResult.rows[0]?.id

    // Check if WF2 can be activated (any completed instance has a transition to WF2)
    const canActivateWF2 = instancesWithDetails.some(i =>
      i.instance.status === "completed" && i.potentialNextWorkflows?.some((nw: any) => nw.name === "WF2")
    )

    return NextResponse.json({
      success: true,
      data: instancesWithDetails,
      allWorkflows,
      allTransitions,
      allWorkflowSteps: allWorkflowStepsMap,
      canActivateWF2,
      wf2Id,
      summary: {
        total: instances.length,
        running: instances.filter((i: any) => i.status === "running").length,
        completed: instances.filter((i: any) => i.status === "completed").length,
        terminated: instances.filter((i: any) => i.status === "terminated").length,
      },
    })
  } catch (error) {
    console.error("[E2E API] Error fetching workflow instances:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch workflow instances",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
