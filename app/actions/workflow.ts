"use server"

import { persistWorkflow, StepInput } from "@/lib/workflow-service"
import { revalidatePath } from "next/cache"

/**
 * Server action to create a workflow from the UI.
 * Replaces the call to /api/e2e/create-ai-workflow
 */
export async function createAiWorkflowAction(params: {
  name: string
  description?: string
  carId: string
  steps: StepInput[]
}) {
  try {
    const result = await persistWorkflow(params)

    // Clear cache for pages that show workflows
    revalidatePath("/e2e")

    return { success: true, data: result }
  } catch (error: any) {
    console.error("[Action] createAiWorkflowAction error:", error)
    return { success: false, error: error.message || "Failed to create workflow" }
  }
}
