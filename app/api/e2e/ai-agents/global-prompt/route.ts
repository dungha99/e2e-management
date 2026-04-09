import { NextResponse } from "next/server";
import { e2eQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

/** PICs allowed to read/write the global (pic_id = NULL) prompt */
const ADMIN_PIC_IDS = new Set([
  "9ee91b08-448b-4cf4-8b3d-79c6f1c71fef",
  "2ffa8389-2641-4d8b-98a6-5dc2dd2d20a4",
]);

/**
 * GET /api/e2e/ai-agents/global-prompt?agentId=xxx&requestingPicId=yyy
 *
 * Returns the active global prompt (pic_id IS NULL) for an agent.
 * Only admin PICs may call this.
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const agentId = searchParams.get("agentId");
    const requestingPicId = searchParams.get("requestingPicId") ?? "";

    if (!agentId) {
      return NextResponse.json({ success: false, error: "Missing agentId" }, { status: 400 });
    }
    if (!ADMIN_PIC_IDS.has(requestingPicId)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    const result = await e2eQuery(
      `SELECT id, version, prompt, created_at
       FROM ai_agent_pic_configs
       WHERE agent_id = $1 AND pic_id IS NULL AND is_active = true
       ORDER BY version DESC
       LIMIT 1`,
      [agentId]
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
      },
    });
  } catch (error) {
    console.error("[Global Prompt] GET error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}

/**
 * POST /api/e2e/ai-agents/global-prompt
 * Body: { agentId, prompt, requestingPicId }
 *
 * Deactivates the current global prompt and inserts a new version.
 * Only admin PICs may call this.
 */
export async function POST(request: Request) {
  try {
    const { agentId, prompt, requestingPicId } = await request.json();

    if (!agentId || !prompt) {
      return NextResponse.json({ success: false, error: "Missing agentId or prompt" }, { status: 400 });
    }
    if (!ADMIN_PIC_IDS.has(requestingPicId)) {
      return NextResponse.json({ success: false, error: "Forbidden" }, { status: 403 });
    }

    // Next version number for the global (NULL) slot
    const versionResult = await e2eQuery(
      `SELECT COALESCE(MAX(version), 0) + 1 AS new_version
       FROM ai_agent_pic_configs
       WHERE agent_id = $1 AND pic_id IS NULL`,
      [agentId]
    );
    const newVersion = versionResult.rows[0].new_version;

    // Deactivate all existing global versions
    await e2eQuery(
      `UPDATE ai_agent_pic_configs SET is_active = false
       WHERE agent_id = $1 AND pic_id IS NULL`,
      [agentId]
    );

    // Insert new active global version
    const insertResult = await e2eQuery(
      `INSERT INTO ai_agent_pic_configs (agent_id, pic_id, version, prompt, is_active, created_at)
       VALUES ($1, NULL, $2, $3, true, NOW())
       RETURNING id`,
      [agentId, newVersion, prompt]
    );

    return NextResponse.json({
      success: true,
      configId: insertResult.rows[0].id,
      version: newVersion,
    });
  } catch (error) {
    console.error("[Global Prompt] POST error:", error);
    return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
  }
}
