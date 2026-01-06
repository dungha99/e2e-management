import { NextResponse } from "next/server"
import { e2eQuery } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { carId, targetWorkflowId, parentInstanceId, finalOutcome, transitionProperties, aiInsightId, isAlignedWithAi, phoneNumber, workflowPayload } = body

    // Validation
    if (!carId || !targetWorkflowId || !parentInstanceId || !finalOutcome || !transitionProperties) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Validate finalOutcome
    if (!["discount", "original_price", "lost"].includes(finalOutcome)) {
      return NextResponse.json(
        { error: "Invalid final_outcome value" },
        { status: 400 }
      )
    }

    // Validate transitionProperties structure
    if (!transitionProperties.insight || typeof transitionProperties.insight !== "string") {
      return NextResponse.json(
        { error: "transitionProperties.insight is required and must be a string" },
        { status: 400 }
      )
    }

    if (!transitionProperties.car_snapshot || typeof transitionProperties.car_snapshot !== "object") {
      return NextResponse.json(
        { error: "transitionProperties.car_snapshot is required and must be an object" },
        { status: 400 }
      )
    }

    if (!transitionProperties.custom_fields || typeof transitionProperties.custom_fields !== "object") {
      return NextResponse.json(
        { error: "transitionProperties.custom_fields is required and must be an object" },
        { status: 400 }
      )
    }

    // Step 1: Update parent workflow instance with final_outcome
    await e2eQuery(
      `UPDATE workflow_instances
       SET final_outcome = $1
       WHERE id = $2`,
      [finalOutcome, parentInstanceId]
    )

    // Step 2: Fetch target workflow to get SLA hours
    const workflowResult = await e2eQuery(
      `SELECT id, name, sla_hours FROM workflows WHERE id = $1`,
      [targetWorkflowId]
    )

    if (workflowResult.rows.length === 0) {
      return NextResponse.json(
        { error: "Target workflow not found" },
        { status: 404 }
      )
    }

    const workflow = workflowResult.rows[0]

    // Step 3: Calculate SLA deadline
    const startedAt = new Date()
    const slaDeadline = workflow.sla_hours
      ? new Date(startedAt.getTime() + workflow.sla_hours * 60 * 60 * 1000)
      : null

    // Step 4: Create new workflow instance
    const insertResult = await e2eQuery(
      `INSERT INTO workflow_instances (
        car_id,
        workflow_id,
        parent_instance_id,
        status,
        started_at,
        sla_deadline,
        transition_properties,
        ai_insight_id,
        is_aligned_with_ai
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING id`,
      [
        carId,
        targetWorkflowId,
        parentInstanceId,
        "running",
        startedAt,
        slaDeadline,
        JSON.stringify(transitionProperties),
        aiInsightId || null,
        isAlignedWithAi !== undefined ? isAlignedWithAi : null,
      ]
    )

    const newInstanceId = insertResult.rows[0].id

    // Step 5: Call workflow webhook with instance ID
    if (phoneNumber && workflowPayload) {
      try {
        // Get webhook URL based on workflow name
        // For now, hardcoded for WF2 - will be made dynamic later
        let webhookUrl = null
        let transformedPayload = { ...workflowPayload }

        if (workflow.name === "WF2") {
          webhookUrl = "https://n8n.vucar.vn/webhook/8214cf7a-8c4f-1dc07b17c2ec-449d-83d5"

          // Transform WF2 payload to match handleActivateWorkflow2 format
          transformedPayload = {
            duration: parseInt(workflowPayload.duration) || 0,
            minPrice: workflowPayload.minPrice ? workflowPayload.minPrice * 1000000 : 0, // Convert triệu to VND
            maxPrice: workflowPayload.maxPrice ? workflowPayload.maxPrice * 1000000 : 0,
            comment: workflowPayload.comment === "true" || workflowPayload.comment === true,
            numberOfComments: parseInt(workflowPayload.numberOfComments) || 0,
            bid: workflowPayload.bid === "true" || workflowPayload.bid === true,
          }
        } else if (workflow.name === "WFD5") {
          webhookUrl = "https://n8n.vucar.vn/webhook/f3568461-bf9f-4cf1-9709-8644e0d9c291"

          // Transform WFD5 payload (same format as WF2)
          transformedPayload = {
            duration: parseInt(workflowPayload.duration) || 0,
            minPrice: workflowPayload.minPrice ? workflowPayload.minPrice * 1000000 : 0, // Convert triệu to VND
            maxPrice: workflowPayload.maxPrice ? workflowPayload.maxPrice * 1000000 : 0,
            comment: workflowPayload.comment === "true" || workflowPayload.comment === true,
            numberOfComments: parseInt(workflowPayload.numberOfComments) || 0,
            bid: workflowPayload.bid === "true" || workflowPayload.bid === true,
          }
        }
        // Add more workflow webhooks here as needed
        // else if (workflow.name === "WF2.1") {
        //   webhookUrl = "https://n8n.vucar.vn/webhook/..."
        // }

        if (webhookUrl) {
          const webhookPayload = {
            workflowInstanceId: newInstanceId,
            phone: phoneNumber,
            ...transformedPayload, // Spread transformed workflow-specific fields
          }

          const webhookResponse = await fetch(webhookUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(webhookPayload),
          })

          if (!webhookResponse.ok) {
            console.error("[Activate Workflow] Webhook call failed:", webhookResponse.status)
            // Don't fail the entire request - instance is already created
          } else {
            console.log("[Activate Workflow] Webhook called successfully for", workflow.name)
          }
        }
      } catch (webhookError) {
        console.error("[Activate Workflow] Error calling webhook:", webhookError)
        // Don't fail the entire request - instance is already created
      }
    }

    return NextResponse.json({
      success: true,
      instanceId: newInstanceId,
      message: `Workflow ${workflow.name} đã được kích hoạt thành công`,
    })
  } catch (error) {
    console.error("[E2E API] Error activating workflow:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Failed to activate workflow",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
