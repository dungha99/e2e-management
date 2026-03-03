import { NextResponse } from "next/server";
import { e2eQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/e2e/ai-agents/outputs/[carId]
 * 
 * Fetches the timeline of AI agent executions for a specific car/lead.
 * Returns the outputs sorted by newest first, joined with agent names and note versions.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ carId: string }> }
) {
  try {
    const { carId } = await params;

    if (!carId) {
      return NextResponse.json({ success: false, error: "Missing carId" }, { status: 400 });
    }

    const result = await e2eQuery(
      `SELECT 
        o.id,
        o.agent_id,
        a.name as agent_name,
        o.note_version_id,
        n.version as note_version,
        n.note_content,
        o.source_instance_id,
        o.input_payload,
        o.output_payload,
        o.created_at
       FROM ai_agent_outputs o
       JOIN ai_agents a ON o.agent_id = a.id
       LEFT JOIN ai_agent_notes n ON o.note_version_id = n.id
       WHERE o.car_id = $1
       ORDER BY o.created_at DESC`,
      [carId]
    );

    return NextResponse.json({ success: true, outputs: result.rows });
  } catch (error) {
    console.error(`[AI Agent Outputs API] Error fetching outputs:`, error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
