import { NextResponse } from "next/server"
import { e2eQuery, vucarV2Query } from "@/lib/db"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { carId, targetWorkflowId, parentInstanceId, finalOutcome, transitionProperties, aiInsightId, isAlignedWithAi, phoneNumber, workflowPayload } = body

    // Validation - parentInstanceId and finalOutcome can be null for WF0
    if (!carId || !targetWorkflowId || !transitionProperties) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      )
    }

    // Validate finalOutcome only if parentInstanceId exists
    if (parentInstanceId && finalOutcome && !["discount", "original_price", "lost"].includes(finalOutcome)) {
      return NextResponse.json(
        { error: "Invalid final_outcome value" },
        { status: 400 }
      )
    }

    // Validate transitionProperties structure - only require these if parentInstanceId exists
    if (parentInstanceId) {
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
    }

    if (!transitionProperties.custom_fields || typeof transitionProperties.custom_fields !== "object") {
      return NextResponse.json(
        { error: "transitionProperties.custom_fields is required and must be an object" },
        { status: 400 }
      )
    }

    // Step 1: Update parent workflow instance with final_outcome (only if parent exists)
    if (parentInstanceId && finalOutcome) {
      await e2eQuery(
        `UPDATE workflow_instances
         SET final_outcome = $1
         WHERE id = $2`,
        [finalOutcome, parentInstanceId]
      )
    }

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

    // Step 2.5: For WFB2, validate that inspection exists for this car
    if (workflow.id === "fc43e876-0948-4d5a-b16d-a717e891fd57") { // WFB2
      const inspectionResult = await vucarV2Query(
        `SELECT id FROM inspection WHERE car_id = $1 LIMIT 1`,
        [carId]
      )

      if (inspectionResult.rows.length === 0) {
        return NextResponse.json(
          { error: "Không tìm thấy báo cáo kiểm định cho xe này. Vui lòng tạo báo cáo kiểm định trước khi kích hoạt WFB2." },
          { status: 400 }
        )
      }
    }

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
        parentInstanceId || null, // Allow null for WF0
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
    // WFB2 doesn't require phoneNumber/workflowPayload, so we check for it specifically
    const isWFB2 = workflow.id === "fc43e876-0948-4d5a-b16d-a717e891fd57"
    if ((phoneNumber && workflowPayload) || isWFB2) {
      try {
        // Get webhook URL based on workflow name
        // For now, hardcoded for WF2 - will be made dynamic later
        let webhookUrl = null
        let transformedPayload = workflowPayload ? { ...workflowPayload } : {}
        let inspectionId = null

        if (workflow.id === "3b78a161-116e-43a2-8b7f-61fcf9ba9930") { //WF2
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
        } else if (workflow.id === "e06d0d0b-be03-45f9-97f1-38964ee7e231") { //WFD5
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
        } else if (workflow.id === "9f130676-a416-418f-bae9-a581096f6426") { //WFD1
          webhookUrl = "https://n8n.vucar.vn/webhook/57039721-04a9-42a1-945c-fdd24250e6a8"

          // Transform WFD1 payload with fixed and dynamic fields
          transformedPayload = {
            phone: workflowPayload.phone || phoneNumber || "",
            shop_id: "68f5f0f9-0703-9cf6-ae45-81e800000000",
            first_message: workflowPayload.first_message || "Em được giới thiệu mình có nhu cầu bán xe em kết bạn để hỏi thêm ít thông tin được không ạ? Xe còn ko a",
            account: "MA",
            segment: "negotiation",
          }
        } else if (workflow.id === "fc43e876-0948-4d5a-b16d-a717e891fd57") { //WFB2
          webhookUrl = "https://n8n.vucar.vn/webhook/693554e5-40ef-4739-be48-bc3ec770c529"

          // Fetch inspectionId from vucar-v2 database
          const inspectionResult = await vucarV2Query(
            `SELECT id FROM inspection WHERE car_id = $1 LIMIT 1`,
            [carId]
          )

          if (inspectionResult.rows.length > 0) {
            inspectionId = inspectionResult.rows[0].id

            // WFB2 payload: only inspectionId and workflowInstanceId
            transformedPayload = {
              inspectionId: inspectionId,
              workflowInstanceId: newInstanceId,
            }
          } else {
            // This should not happen because we already validated in Step 2.5
            console.error("[Activate Workflow] WFB2: No inspection found for car_id:", carId)
          }
        }
        // Add more workflow webhooks here as needed
        // else if (workflow.name === "WF2.1") {
        //   webhookUrl = "https://n8n.vucar.vn/webhook/..."
        // }

        if (webhookUrl) {
          // For WFD1 and WFB2, use only the transformed payload (already includes required fields)
          const isWFD1 = workflow.id === "9f130676-a416-418f-bae9-a581096f6426"
          const isWFB2 = workflow.id === "fc43e876-0948-4d5a-b16d-a717e891fd57"

          const webhookPayload = (isWFD1 || isWFB2)
            ? { ...transformedPayload, carId }
            : {
              workflowInstanceId: newInstanceId,
              phone: phoneNumber,
              carId,
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

          // Additional webhook for WFD1: send phone and shop_id to separate endpoint
          if (isWFD1) {
            const wfd1AdditionalWebhook = "https://n8n.vucar.vn/webhook/406e60de-3bd6-443d-8052-a38d0166069e"
            const wfd1AdditionalPayload = {
              phone: workflowPayload?.phone || phoneNumber || "",
              shop_id: "68f5f0f9-0703-9cf6-ae45-81e800000000",
            }

            const additionalResponse = await fetch(wfd1AdditionalWebhook, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify(wfd1AdditionalPayload),
            })

            if (!additionalResponse.ok) {
              console.error("[Activate Workflow] WFD1 additional webhook call failed:", additionalResponse.status)
            } else {
              console.log("[Activate Workflow] WFD1 additional webhook called successfully")
            }
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
