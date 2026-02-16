import { NextResponse } from "next/server"
import { e2eQuery } from "@/lib/db"

const DEFAULT_STAGE_ID = "456e0d0b-bd97-4ef6-893e-8674447ed882"

interface StepInput {
  stepName: string
  stepOrder: number
  connectorId: string
  inputMapping: Record<string, string>  // generic template e.g. {"duration": "{{duration}}"}
  requestPayload: Record<string, any>   // actual filled-in values
  scheduledAt?: string                  // ISO datetime string
  description?: string                  // AI metadata description
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, description, carId, steps } = body as {
      name: string
      description?: string
      carId: string
      steps: StepInput[]
    }

    // Validation
    if (!name || !carId || !steps || steps.length === 0) {
      return NextResponse.json(
        { success: false, error: "Missing required fields: name, carId, steps[]" },
        { status: 400 }
      )
    }

    // --- 1. Create workflow ---
    const workflowResult = await e2eQuery(
      `INSERT INTO workflows (name, stage_id, is_active, description, type)
       VALUES ($1, $2, true, $3, 'AI')
       RETURNING *`,
      [name, DEFAULT_STAGE_ID, description || null]
    )
    const workflow = workflowResult.rows[0]
    console.log("[Create AI Workflow] Created workflow:", workflow.id)

    // --- 2. Create workflow_steps ---
    const createdSteps: any[] = []
    for (const step of steps) {
      const stepResult = await e2eQuery(
        `INSERT INTO workflow_steps (workflow_id, step_name, step_order, connector_id, input_mapping, is_automated, description)
         VALUES ($1, $2, $3, $4, $5, true, $6)
         RETURNING *`,
        [
          workflow.id,
          step.stepName,
          step.stepOrder,
          step.connectorId,
          JSON.stringify(step.inputMapping),
          step.description || null,
        ]
      )
      createdSteps.push(stepResult.rows[0])
    }
    console.log("[Create AI Workflow] Created", createdSteps.length, "steps")

    // --- 3. Create workflow_instance ---
    const instanceResult = await e2eQuery(
      `INSERT INTO workflow_instances (car_id, workflow_id, current_step_id, status, started_at)
       VALUES ($1, $2, $3, 'running', NOW())
       RETURNING *`,
      [carId, workflow.id, createdSteps[0].id]
    )
    const instance = instanceResult.rows[0]
    console.log("[Create AI Workflow] Created instance:", instance.id)

    // --- 4. Create step_executions ---
    const createdExecutions: any[] = []
    for (let i = 0; i < createdSteps.length; i++) {
      const step = createdSteps[i]
      const stepInput = steps[i]

      const execResult = await e2eQuery(
        `INSERT INTO step_executions (instance_id, step_id, status, scheduled_at, request_payload)
         VALUES ($1, $2, 'pending', $3, $4)
         RETURNING *`,
        [
          instance.id,
          step.id,
          stepInput.scheduledAt || null,
          JSON.stringify(stepInput.requestPayload),
        ]
      )
      createdExecutions.push(execResult.rows[0])
    }
    console.log("[Create AI Workflow] Created", createdExecutions.length, "step executions")

    return NextResponse.json({
      success: true,
      workflow,
      steps: createdSteps,
      instance,
      executions: createdExecutions,
    })
  } catch (error) {
    console.error("[Create AI Workflow] Error:", error)
    return NextResponse.json(
      { success: false, error: "Failed to create AI workflow", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
