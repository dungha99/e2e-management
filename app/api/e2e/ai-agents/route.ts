import { NextResponse } from "next/server";
import { e2eQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * GET /api/e2e/ai-agents
 * 
 * Fetches all registered AI Agents.
 */
export async function GET() {
  try {
    const result = await e2eQuery(
      `SELECT id, name, description FROM ai_agents ORDER BY name ASC`
    );

    return NextResponse.json({ success: true, agents: result.rows });
  } catch (error) {
    console.error(`[AI Agents API] Error fetching agents:`, error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
