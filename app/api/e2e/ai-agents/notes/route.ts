import { NextResponse } from "next/server";
import { e2eQuery } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * POST /api/e2e/ai-agents/notes
 * 
 * Submits a new configuration note for a specific AI Agent.
 * This sets the new note as active and deactivates the previous ones.
 */
export async function POST(request: Request) {
  try {
    const { agentId, content } = await request.json();

    if (!agentId || !content) {
      return NextResponse.json(
        { success: false, error: "Missing agentId or content" },
        { status: 400 }
      );
    }

    // 1. Get the latest version number for this agent
    const versionResult = await e2eQuery(
      `SELECT COALESCE(MAX(version), 0) + 1 as new_version 
       FROM ai_agent_notes 
       WHERE agent_id = $1`,
      [agentId]
    );
    const newVersion = versionResult.rows[0].new_version;

    // 2. Fetch the current active note content to append to
    const activeNoteResult = await e2eQuery(
      `SELECT note_content FROM ai_agent_notes 
       WHERE agent_id = $1 AND is_active = true 
       ORDER BY version DESC LIMIT 1`,
      [agentId]
    );
    const previousContent = activeNoteResult.rows[0]?.note_content || "";

    // 3. Append new content to previous content
    const combinedContent = previousContent
      ? `${previousContent}\n\n---\n\n${content}`
      : content;

    // 4. Set all existing notes for this agent to inactive
    await e2eQuery(
      `UPDATE ai_agent_notes SET is_active = false WHERE agent_id = $1`,
      [agentId]
    );

    // 5. Insert the new note (with accumulated content) as active
    const insertResult = await e2eQuery(
      `INSERT INTO ai_agent_notes (agent_id, version, note_content, is_active, created_at)
       VALUES ($1, $2, $3, true, NOW())
       RETURNING id`,
      [agentId, newVersion, combinedContent]
    );

    return NextResponse.json({
      success: true,
      noteId: insertResult.rows[0].id,
      version: newVersion
    });
  } catch (error) {
    console.error(`[AI Agent Notes API] Error creating note:`, error);
    return NextResponse.json(
      { success: false, error: String(error) },
      { status: 500 }
    );
  }
}
