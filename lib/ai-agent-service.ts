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

/**
 * Fetches the currently active PIC-specific prompt for a given agent + PIC pair.
 * Returns null if no active config exists.
 */
export async function getPicAgentConfig(agentName: string, picId: string): Promise<string | null> {
  try {
    const result = await e2eQuery(
      `SELECT c.prompt
       FROM ai_agent_pic_configs c
       JOIN ai_agents a ON a.id = c.agent_id
       WHERE a.name = $1 AND c.is_active = true
         AND (c.pic_id = $2 OR c.pic_id IS NULL)
       ORDER BY (c.pic_id IS NOT NULL) DESC, c.version DESC
       LIMIT 1`,
      [agentName, picId]
    );
    return result.rows.length > 0 ? result.rows[0].prompt : null;
  } catch (error) {
    console.error(`[AI Agent Service] Error fetching PIC config for agent=${agentName} pic=${picId}:`, error);
    return null;
  }
}

/**
 * Fetches the AI agent session for a car as a structured chat conversation.
 * Each entry is one agent "message" using only output_payload.
 */
export async function getCarAgentSession(carId: string, limit: number = 50): Promise<any[]> {
  try {
    const result = await e2eQuery(
      `SELECT o.id, o.output_payload, o.created_at, o.source_instance_id, a.name AS agent_name
       FROM ai_agent_outputs o
       JOIN ai_agents a ON o.agent_id = a.id
       WHERE o.car_id = $1
       ORDER BY o.created_at ASC
       LIMIT $2`,
      [carId, limit]
    )

    return result.rows.map((row) => {
      let content = row.output_payload
      if (typeof content === "string") {
        try { content = JSON.parse(content) } catch { /* keep as string */ }
      }

      // Strip _prompt from content
      if (Array.isArray(content)) {
        content = content.map(({ _prompt, ...rest }: any) => rest)
      } else if (content && typeof content === "object") {
        const { _prompt, ...rest } = content
        content = rest
      }

      return {
        id: row.id,
        role: row.agent_name,
        content,
        sourceInstanceId: row.source_instance_id,
        timestamp: row.created_at,
      }
    })
  } catch (error) {
    console.error(`[AI Agent Service] Error fetching agent session for car ${carId}:`, error)
    return []
  }
}

/**
 * Fetches the AI agent session memory for a car as a compact chat timeline string.
 * Used to inject prior agent decisions into new agent prompts as memory context.
 */
export async function getCarAgentMemory(carId: string, limit: number = 20): Promise<string | null> {
  try {
    const result = await e2eQuery(
      `SELECT o.output_payload, o.created_at, a.name AS agent_name
       FROM ai_agent_outputs o
       JOIN ai_agents a ON o.agent_id = a.id
       WHERE o.car_id = $1
       ORDER BY o.created_at ASC
       LIMIT $2`,
      [carId, limit]
    )

    if (result.rows.length === 0) return null

    const lines: string[] = [
      "╔══════════════════════════════════════╗",
      "║         AGENT SESSION MEMORY         ║",
      "║   (Lịch sử quyết định AI cho xe)     ║",
      "╚══════════════════════════════════════╝",
    ]

    for (const row of result.rows) {
      const vnTime = new Date(new Date(row.created_at).getTime() + 7 * 60 * 60 * 1000)
      const ts = vnTime.toISOString().replace("T", " ").slice(0, 16)
      const name: string = row.agent_name

      let payload = row.output_payload
      if (typeof payload === "string") {
        try { payload = JSON.parse(payload) } catch { /* keep */ }
      }

      let summary = ""
      if (name === "Router (Plan)" && payload?.extractedSteps) {
        const stepNames = (payload.extractedSteps as any[]).map((s) => `"${s.stepName}"`).join(" → ")
        summary = `Extracted ${payload.extractedSteps.length} steps: ${stepNames}`
      } else if (name === "Worker (Parameter/Rule)" && Array.isArray(payload)) {
        summary = (payload as any[]).map((step, i) => {
          const scheduledAt = step.scheduled_at ? `scheduled: ${step.scheduled_at}` : "immediate"
          const params = step.parameters ? JSON.stringify(step.parameters).slice(0, 200) : "{}"
          return `Step ${i + 1}: ${scheduledAt}, params: ${params}`
        }).join(" | ")
      } else if (name === "Review Messages Scheduled") {
        const status = payload?.status || "unknown"
        const reasoning = typeof payload?.reasoning === "string" ? payload.reasoning.slice(0, 150) : ""
        summary = `${status}${reasoning ? ` — ${reasoning}` : ""}`
      } else if (name === "Task Dispatcher") {
        const steps: any[] = Array.isArray(payload?.steps) ? payload.steps : []
        const actionNames = steps.map((s) => s.actionName).join(" → ")
        summary = `${steps.length} step(s)${actionNames ? `: ${actionNames}` : ""}`
      } else {
        summary = JSON.stringify(payload).slice(0, 200)
      }

      lines.push(`[${ts}] ${name}: ${summary}`)
    }

    lines.push("╚══════════════════════════════════════╝")
    return lines.join("\n")
  } catch (error) {
    console.error(`[AI Agent Service] Error fetching agent memory for car ${carId}:`, error)
    return null
  }
}

/**
 * Fetches the currently active note content (markdown configuration) for a given agent.
 * Returns null if no active note exists or if the agent is not found.
 */
export async function getActiveAgentNote(agentName: string): Promise<string | null> {
  try {
    const result = await e2eQuery(
      `SELECT n.note_content 
       FROM ai_agent_notes n
       JOIN ai_agents a ON a.id = n.agent_id
       WHERE a.name = $1 AND n.is_active = true 
       LIMIT 1`,
      [agentName]
    );
    return result.rows.length > 0 ? result.rows[0].note_content : null;
  } catch (error) {
    console.error(`[AI Agent Service] Error fetching active note for ${agentName}:`, error);
    return null;
  }
}
