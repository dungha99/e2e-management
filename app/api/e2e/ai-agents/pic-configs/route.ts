import { NextResponse } from "next/server";
import { e2eQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/e2e/ai-agents/pic-configs?agentId=xxx&picId=yyy
 *
 * Returns the active prompt config for a specific (agent, PIC) pair.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const picId = searchParams.get("picId");

    if (!agentId || !picId) {
      return NextResponse.json(
        { success: false, error: "Missing agentId or picId" },
        { status: 400 }
      );
    }

    const result = await e2eQuery(
      `SELECT id, version, prompt, created_at,
              (pic_id IS NOT NULL) AS is_pic_specific
       FROM ai_agent_pic_configs
       WHERE agent_id = $1 AND is_active = true
         AND (pic_id = $2 OR pic_id IS NULL)
       ORDER BY (pic_id IS NOT NULL) DESC, version DESC
       LIMIT 1`,
      [agentId, picId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json({ success: true, config: null });
    }

    const row = result.rows[0];
    return NextResponse.json({
      success: true,
      config: {
        id: row.id,
        version: row.version,
        prompt: row.prompt,
        createdAt: row.created_at,
        isPicSpecific: row.is_pic_specific,
      },
    });
  } catch (error) {
    console.error("[AI Agent PIC Configs] GET error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/e2e/ai-agents/pic-configs
 * Body: { agentId, picId, prompt }
 *
 * Deactivates all previous versions for this (agent, PIC) pair and inserts
 * the new prompt as the active version.
 */
export async function POST(request: Request) {
  try {
    const { agentId, picId, prompt } = await request.json();

    if (!agentId || !picId || !prompt) {
      return NextResponse.json(
        { success: false, error: "Missing agentId, picId, or prompt" },
        { status: 400 }
      );
    }

    // 1. Get next version number for this (agent, pic) pair
    const versionResult = await e2eQuery(
      `SELECT COALESCE(MAX(version), 0) + 1 AS new_version
       FROM ai_agent_pic_configs
       WHERE agent_id = $1 AND pic_id = $2`,
      [agentId, picId]
    );
    const newVersion = versionResult.rows[0].new_version;

    // 2. Deactivate existing versions for this (agent, pic) pair
    await e2eQuery(
      `UPDATE ai_agent_pic_configs SET is_active = false
       WHERE agent_id = $1 AND pic_id = $2`,
      [agentId, picId]
    );

    // 3. Insert new version as active
    const insertResult = await e2eQuery(
      `INSERT INTO ai_agent_pic_configs (agent_id, pic_id, version, prompt, is_active, created_at)
       VALUES ($1, $2, $3, $4, true, NOW())
       RETURNING id`,
      [agentId, picId, newVersion, prompt]
    );

    return NextResponse.json({
      success: true,
      configId: insertResult.rows[0].id,
      version: newVersion,
    });
  } catch (error) {
    console.error("[AI Agent PIC Configs] POST error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * DELETE /api/e2e/ai-agents/pic-configs?agentId=xxx&picId=yyy
 *
 * Deactivates the current active config for a (agent, PIC) pair
 * (effectively resetting the PIC to the global default).
 */
export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const picId = searchParams.get("picId");

    if (!agentId || !picId) {
      return NextResponse.json(
        { success: false, error: "Missing agentId or picId" },
        { status: 400 }
      );
    }

    await e2eQuery(
      `UPDATE ai_agent_pic_configs SET is_active = false
       WHERE agent_id = $1 AND pic_id = $2`,
      [agentId, picId]
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[AI Agent PIC Configs] DELETE error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
