import { e2eQuery } from "@/lib/db";

export interface StoreAgentOutputParams {
  agentName: string;
  carId: string;
  sourceInstanceId?: string | null;
  inputPayload?: any;
  outputPayload: any;
}

export interface StoreAgentOutputResult {
  success: boolean;
  outputId?: string;
  error?: string;
}

/**
 * Service to store AI Agent execution outputs.
 * Looks up the agent by name, finds the currently active prompt/note version,
 * and records the execution result.
 */
export async function storeAgentOutput(params: StoreAgentOutputParams): Promise<StoreAgentOutputResult> {
  const { agentName, carId, sourceInstanceId, inputPayload, outputPayload } = params;

  try {
    // 1. Find the agent by name
    const agentResult = await e2eQuery(
      `SELECT id FROM ai_agents WHERE name = $1 LIMIT 1`,
      [agentName]
    );

    if (agentResult.rows.length === 0) {
      return { success: false, error: `Agent with name "${agentName}" not found` };
    }
    const agentId = agentResult.rows[0].id;

    // 2. Find the active note version (if any)
    const noteResult = await e2eQuery(
      `SELECT id FROM ai_agent_notes WHERE agent_id = $1 AND is_active = true LIMIT 1`,
      [agentId]
    );
    const activeNoteId = noteResult.rows.length > 0 ? noteResult.rows[0].id : null;

    // 3. Insert the output
    const insertResult = await e2eQuery(
      `INSERT INTO ai_agent_outputs (
        agent_id, note_version_id, car_id, source_instance_id, input_payload, output_payload, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW()) RETURNING id`,
      [
        agentId,
        activeNoteId,
        carId,
        sourceInstanceId || null,
        inputPayload ? JSON.stringify(inputPayload) : null,
        outputPayload ? JSON.stringify(outputPayload) : null
      ]
    );

    return { success: true, outputId: insertResult.rows[0].id };
  } catch (error) {
    console.error(`[AI Agent Service] Error storing output for agent ${agentName}:`, error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}
